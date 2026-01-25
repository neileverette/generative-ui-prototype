# Phase 32: EC2 GET Endpoint - PLAN

## Objective

Create a GET endpoint on EC2 that serves the stored Console usage data to clients. The endpoint should support optional query parameters for accessing historical versions by timestamp or version number, and include metadata about data freshness and versioning.

## Execution Context

**Current State:**
- Phase 31 complete: Versioned storage layer implemented with filesystem-based retention
- Storage module: `server/console-storage.ts` with `initializeStorage()`, `saveVersion()`, `listVersions()`, `getStorageMetadata()`
- Storage directory: `server/claude-scraper/console-usage-history/` with timestamped JSON files
- File naming: `YYYY-MM-DDTHH-mm-ss-{uuid}.json` for chronological sorting
- POST endpoint exists at `/api/claude/console-usage` (authenticated, stores data)
- Existing GET endpoint at `/api/claude-usage/console` (reads local scraper file, not synced data)
- Latest version maintained at: `server/claude-scraper/console-usage-synced.json`

**Architecture:**
- Scraper POSTs data to EC2 after each scrape
- EC2 stores versioned data in `console-usage-history/`
- Need: GET endpoint to serve this data to clients (Widget will use this in Phase 33)

**TypeScript Interfaces:**
- `ConsoleUsageDataSync` - the data structure (from `claude-console-sync-types.ts`)
- `StorageMetadata` - version count, timestamps, cleanup stats

## Context

**Data Flow:**
1. Scraper (laptop) → POST /api/claude/console-usage → Versioned storage
2. Widget (anywhere) → GET /api/claude/console-usage → Latest or historical data
3. Clients need to know: data freshness, staleness, version info

**Storage Layer Functions Available:**
- `listVersions(limit?: number): string[]` - Get version file paths sorted by timestamp
- `getStorageMetadata(): StorageMetadata` - Get metadata about versions
- `parseTimestampFromFilename(filename: string): Date | null` - Extract timestamp from filename

**Requirements from Roadmap:**
- GET /api/claude/usage endpoint (Note: Actual path should match POST: `/api/claude/console-usage`)
- Return latest usage data as JSON
- Optional query params for timestamp/version access
- Include metadata (lastUpdated, dataAge, version info)
- CORS configuration for frontend access
- Cache headers for performance optimization

**Considerations:**
- Existing `/api/claude-usage/console` endpoint reads from local scraper file (`usage-data.json`)
- New endpoint should read from synced storage (`console-usage-synced.json` or versioned files)
- May need different endpoint path to avoid confusion: `/api/claude/console-usage` (GET) matches POST
- Widget currently uses `/api/claude-usage/console` - will migrate in Phase 33

## Tasks

### 1. Design GET Endpoint Interface

**Objective:** Define the endpoint contract, query parameters, and response schema

**Actions:**
- Define endpoint path: `GET /api/claude/console-usage` (matches POST endpoint)
- Define query parameters:
  - `version` (optional): Version number (1-based index, 1 = oldest, -1 = latest)
  - `timestamp` (optional): ISO 8601 timestamp to find nearest version
  - If both omitted, return latest version
- Define response interface:
  ```typescript
  interface ConsoleUsageResponse extends ConsoleUsageDataSync {
    // Metadata fields
    isStale: boolean;           // true if data age > 10 minutes
    ageMinutes: number;         // age since lastUpdated
    source: 'ec2-sync';         // distinguish from local scraper
    versionInfo: {
      current: number;          // 1-based version number
      total: number;            // total versions available
      timestamp: string;        // file creation timestamp
      filename: string;         // version filename
    };
  }
  ```

**Success Criteria:**
- Clear interface documented in code comments
- TypeScript interface for response defined

### 2. Implement Latest Version Retrieval

**Objective:** GET without query params returns latest synced data

**Actions:**
- Read from `console-usage-synced.json` (updated by POST endpoint on each save)
- Fall back to `listVersions(1)[0]` if symlink file missing
- Calculate staleness: `ageMinutes = (now - lastUpdated) / 60000`
- Mark as stale if `ageMinutes > 10`
- Get version metadata from `getStorageMetadata()`
- Determine current version number (total versions in metadata)
- Extract timestamp from filename using `parseTimestampFromFilename()`
- Return data with metadata

**File Locations:**
- Latest file: `server/claude-scraper/console-usage-synced.json`
- Fallback: Call `listVersions(1)` to get most recent versioned file

**Error Handling:**
- 404 if no data exists (storage empty)
- 500 on file read errors
- Clear error messages guide users to run scraper

**Success Criteria:**
- `GET /api/claude/console-usage` returns latest data with metadata
- Response includes staleness info and version details
- Handles missing data gracefully

### 3. Implement Version-Based Retrieval

**Objective:** Support `?version=N` query parameter for historical access

**Actions:**
- Parse `version` query param as integer
- Support negative indexing: `-1` = latest, `-2` = second-latest
- Convert to positive index if needed
- Call `listVersions()` to get all versions (sorted newest-first)
- Calculate array index:
  - Positive version N → array index `totalVersions - N`
  - Negative version -N → array index `N - 1`
- Read file at calculated index
- Return data with version metadata
- Handle out-of-range versions (400 error)

**Examples:**
- `?version=1` → oldest version
- `?version=-1` → latest version (same as no params)
- `?version=50` when 100 versions exist → 50th oldest

**Error Handling:**
- 400 if version is invalid (non-integer, out of range)
- 404 if no versions exist
- Clear error message with available version range

**Success Criteria:**
- `?version=N` returns correct historical version
- Negative indexing works correctly
- Error messages include valid version range

### 4. Implement Timestamp-Based Retrieval

**Objective:** Support `?timestamp=ISO8601` query parameter for time-based lookup

**Actions:**
- Parse `timestamp` query param as ISO 8601 string
- Validate timestamp format and range
- Call `listVersions()` to get all versions
- For each version file, extract timestamp using `parseTimestampFromFilename()`
- Find version with timestamp closest to requested time (nearest neighbor)
- Algorithm:
  ```typescript
  const targetTime = new Date(timestamp).getTime();
  let closestFile = null;
  let smallestDiff = Infinity;

  for (const filepath of versions) {
    const fileTime = parseTimestampFromFilename(path.basename(filepath))?.getTime();
    if (fileTime) {
      const diff = Math.abs(fileTime - targetTime);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestFile = filepath;
      }
    }
  }
  ```
- Read closest file
- Return data with metadata including time difference

**Error Handling:**
- 400 if timestamp format is invalid
- 404 if no versions exist
- Include time difference in response (how far from requested timestamp)

**Success Criteria:**
- `?timestamp=2025-01-24T10:00:00Z` returns nearest version
- Response indicates time difference from requested timestamp
- Handles edge cases (before oldest, after newest)

### 5. Add CORS and Cache Headers

**Objective:** Configure response headers for frontend access and performance

**Actions:**
- Add CORS headers for frontend origin (if needed in production)
- Set cache headers based on data freshness:
  - Fresh data (<5 min): `Cache-Control: public, max-age=60` (cache 1 min)
  - Stale data (5-10 min): `Cache-Control: public, max-age=30` (cache 30s)
  - Very stale (>10 min): `Cache-Control: no-cache` (don't cache)
- Add `Last-Modified` header from file timestamp
- Add `ETag` based on lastUpdated timestamp
- Support conditional requests (`If-None-Match`, `If-Modified-Since`)

**Cache Strategy:**
- Latest data changes every 5 minutes (scraper interval)
- Short cache duration prevents stale data
- Conditional requests reduce bandwidth for unchanged data

**Success Criteria:**
- CORS headers present (if cross-origin needed)
- Cache headers vary based on data age
- ETags and conditional requests work correctly

### 6. Add Endpoint Logging and Monitoring

**Objective:** Log requests for debugging and monitoring

**Actions:**
- Log each request with:
  - Query parameters (version, timestamp)
  - Version served (filename, age)
  - Data staleness
  - Response time
- Format: `[Console GET] Served version {filename} (age: {age}min, stale: {bool}, params: {params})`
- Log errors with full context
- Track request count in metadata (optional)

**Success Criteria:**
- Clear, searchable logs for debugging
- Request patterns visible in logs
- Errors include full context

### 7. Testing and Validation

**Objective:** Verify endpoint works correctly under various scenarios

**Test Cases:**
1. **No query params** - Returns latest version with metadata
2. **?version=1** - Returns oldest version
3. **?version=-1** - Returns latest version
4. **?version=50** (out of range) - Returns 400 error with range info
5. **?timestamp=2025-01-24T10:00:00Z** - Returns nearest version
6. **No data exists** - Returns 404 with helpful error
7. **Invalid timestamp** - Returns 400 error
8. **Stale data (>10min)** - Response includes `isStale: true`
9. **Fresh data (<5min)** - Appropriate cache headers
10. **Concurrent requests** - No race conditions

**Manual Testing:**
```bash
# Test latest
curl http://localhost:4000/api/claude/console-usage

# Test version
curl http://localhost:4000/api/claude/console-usage?version=1
curl http://localhost:4000/api/claude/console-usage?version=-1

# Test timestamp
curl http://localhost:4000/api/claude/console-usage?timestamp=2025-01-24T10:00:00Z

# Test with headers
curl -i http://localhost:4000/api/claude/console-usage

# Test conditional request
curl -H "If-None-Match: \"<etag>\"" http://localhost:4000/api/claude/console-usage
```

**Automated Testing:**
- Consider adding unit tests for version/timestamp logic
- Integration tests for endpoint behavior
- Not required for this phase (can defer to Phase 34 error handling)

**Success Criteria:**
- All test cases pass
- Edge cases handled gracefully
- Response format consistent across all query types

## Verification

**After Implementation:**

1. Start server: `npm run dev`
2. Ensure POST endpoint has created versions (check `console-usage-history/`)
3. Test GET endpoint with various parameters:
   ```bash
   # Latest
   curl http://localhost:4000/api/claude/console-usage | jq

   # Specific version
   curl http://localhost:4000/api/claude/console-usage?version=1 | jq

   # By timestamp
   curl http://localhost:4000/api/claude/console-usage?timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ) | jq
   ```
4. Verify response includes all metadata fields
5. Check logs show request details
6. Verify cache headers are present
7. Test error cases (no data, invalid params)

**Success Indicators:**
- Endpoint returns latest data by default
- Version-based queries return correct historical data
- Timestamp queries find nearest version
- Metadata includes staleness, version info, source
- Cache headers optimize performance
- Error responses are helpful and actionable
- Logs provide debugging information

## Success Criteria

- GET /api/claude/console-usage endpoint implemented
- Returns latest data by default with full metadata
- Supports `?version=N` for version-based retrieval
- Supports `?timestamp=ISO8601` for time-based retrieval
- Response includes: isStale, ageMinutes, source, versionInfo
- CORS and cache headers configured appropriately
- Comprehensive error handling with clear messages
- Request logging for monitoring and debugging
- All test cases pass successfully

## Output

**Files Created/Modified:**
- `server/index.ts` - Add GET endpoint (approximately 100-150 lines)
- Potentially `server/claude-console-sync-types.ts` - Add ConsoleUsageResponse interface

**Response Schema:**
```typescript
{
  // ConsoleUsageDataSync fields
  currentSession?: { resetsIn: string, percentageUsed: number },
  weeklyLimits?: {
    allModels: { resetsIn: string, percentageUsed: number },
    sonnetOnly: { resetsIn: string, percentageUsed: number }
  },
  lastUpdated: string,
  isPartial?: boolean,
  extractionErrors?: Record<string, string>,

  // Metadata fields
  isStale: boolean,
  ageMinutes: number,
  source: 'ec2-sync',
  versionInfo: {
    current: number,
    total: number,
    timestamp: string,
    filename: string
  }
}
```

**Next Steps:**
- After Phase 32: Run Phase 33 (Widget Migration) to update ClaudeUsageCard to use this endpoint
- Widget will switch from `/api/claude-usage/console` (local scraper) to `/api/claude/console-usage` (EC2 sync)

---

**Ready to Execute:** Yes
**Estimated Scope:** Single plan (endpoint implementation ~150 lines, straightforward logic)
**Dependencies:** Phase 31 complete (storage layer exists)
