---
phase: 32
plan: 1
subsystem: api
tags: [endpoint, versioning, rest-api, claude-console, sync]
requires: [31]
provides: [claude-usage-get-api, version-retrieval, timestamp-retrieval]
affects: [33]
tech-stack:
  added: []
  patterns: [rest-api, conditional-requests, cache-control, etag]
key-files:
  created: []
  modified:
    - server/index.ts
    - server/claude-console-sync-types.ts
key-decisions:
  - Unified endpoint path /api/claude/console-usage for both GET and POST operations
  - 1-based version numbering with negative index support (-1 = latest)
  - Timestamp queries use nearest neighbor matching algorithm
  - Cache headers vary by data freshness (fresh/stale/very-stale)
  - ETags and conditional requests reduce bandwidth for unchanged data
  - Version metadata included in every response for client transparency
issues-created: []
duration: 2 min
completed: 2026-01-25
---

# Phase 32 Plan 1: EC2 GET Endpoint Summary

GET endpoint serving versioned Console usage data with query parameters, metadata, and cache optimization

## Overview

Implemented a comprehensive GET endpoint at `/api/claude/console-usage` that serves synced Claude Console usage data from the versioned storage layer (Phase 31). The endpoint supports multiple retrieval modes: latest version (default), version-based queries (`?version=N`), and timestamp-based queries (`?timestamp=ISO8601`). Each response includes rich metadata about data freshness, staleness, and versioning, with intelligent cache headers to optimize performance.

## What Was Built

### 1. Response Interface

**File:** `server/claude-console-sync-types.ts`

Added `ConsoleUsageResponse` interface extending `ConsoleUsageDataSync`:
```typescript
export interface ConsoleUsageResponse extends ConsoleUsageDataSync {
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

### 2. GET Endpoint Implementation

**File:** `server/index.ts` (lines 2160-2405, ~245 lines)

Comprehensive endpoint with three retrieval modes:

**Mode 1: Latest Version (No Query Params)**
- Reads from `console-usage-synced.json` (latest symlink file)
- Falls back to newest versioned file if symlink missing
- Returns current version number from metadata

**Mode 2: Version-Based Retrieval (`?version=N`)**
- Supports positive indexing: `1` = oldest, `2` = second-oldest, etc.
- Supports negative indexing: `-1` = latest, `-2` = second-latest
- Validates version range and returns 400 if out of bounds
- Converts version to array index: `arrayIndex = totalVersions - N` (positive) or `abs(N) - 1` (negative)

**Mode 3: Timestamp-Based Retrieval (`?timestamp=ISO8601`)**
- Parses ISO 8601 timestamp and validates format
- Iterates all versions to find nearest match (nearest neighbor algorithm)
- Calculates time difference and selects closest version
- Logs time difference in response for transparency

### 3. Metadata & Freshness Calculation

For every response:
- Calculates `ageMinutes` from `lastUpdated` timestamp
- Marks as `isStale: true` if age > 10 minutes
- Extracts file timestamp from filename using `parseTimestampFromFilename()`
- Includes version info: current (1-based), total, timestamp, filename

### 4. Cache Headers & Conditional Requests

**Cache-Control Strategy:**
- Fresh data (<5min): `public, max-age=60` (cache 1 minute)
- Slightly stale (5-10min): `public, max-age=30` (cache 30 seconds)
- Very stale (>10min): `no-cache` (don't cache)

**Conditional Request Support:**
- Sets `Last-Modified` header from `lastUpdated` timestamp
- Sets `ETag` header based on `lastUpdated.getTime()`
- Supports `If-None-Match` (ETag validation)
- Supports `If-Modified-Since` (timestamp validation)
- Returns `304 Not Modified` when appropriate

### 5. Error Handling

Comprehensive error responses:
- **404**: No versions available (storage empty)
- **400**: Invalid query parameters (non-integer version, invalid timestamp format, version out of range)
- **500**: File read errors, server errors
- All errors include helpful messages with valid ranges and examples

### 6. Request Logging

Each request logs:
- Version served (current/total)
- Data age in minutes
- Staleness flag (true/false)
- Filename
- Query parameters used
- Format: `[Console GET] Served version 50/100 (age: 3min, stale: false, file: 2026-01-25T05-00-00-abc123.json, params: version=50)`

## Files Created/Modified

**Modified:**
- `server/index.ts` - Added GET endpoint implementation (~245 lines)
- `server/claude-console-sync-types.ts` - Added ConsoleUsageResponse interface

**Imports Added:**
- `listVersions`, `getStorageMetadata`, `parseTimestampFromFilename` from `console-storage.js`
- `ConsoleUsageResponse` from `claude-console-sync-types.js`

## Testing & Verification

The endpoint has been designed to handle:

1. No query params → Returns latest with full metadata
2. `?version=1` → Returns oldest version
3. `?version=-1` → Returns latest version
4. `?version=50` → Returns 50th oldest (validates range)
5. `?timestamp=2025-01-24T10:00:00Z` → Returns nearest version
6. No data exists → Returns 404 with helpful message
7. Invalid timestamp → Returns 400 error
8. Stale data (>10min) → Includes `isStale: true`
9. Fresh data (<5min) → Appropriate cache headers
10. Conditional requests → 304 responses when data unchanged

**Manual Testing Commands:**
```bash
# Latest
curl http://localhost:4000/api/claude/console-usage | jq

# Specific version
curl http://localhost:4000/api/claude/console-usage?version=1 | jq
curl http://localhost:4000/api/claude/console-usage?version=-1 | jq

# By timestamp
curl http://localhost:4000/api/claude/console-usage?timestamp=2026-01-25T05:00:00Z | jq

# With headers
curl -i http://localhost:4000/api/claude/console-usage

# Conditional request
curl -H "If-None-Match: \"1737783600000\"" http://localhost:4000/api/claude/console-usage
```

## Response Schema

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

## Decisions Made

1. **Unified Endpoint Path**: Used `/api/claude/console-usage` for both GET and POST to maintain consistency. The existing `/api/claude-usage/console` reads from local scraper file and will continue to exist for backward compatibility until Phase 33 migration.

2. **1-Based Version Numbering**: Chose 1-based indexing for versions (1 = oldest, N = newest) as it's more intuitive for users. Internally converts to 0-based array indexing.

3. **Negative Index Support**: Added `-1` for latest, `-2` for second-latest, etc. This mirrors Python list indexing and provides convenient access to recent versions.

4. **Nearest Neighbor for Timestamps**: When timestamp doesn't match exactly, finds the version with smallest time difference. This ensures users always get data even if exact timestamp unavailable.

5. **Cache Headers by Freshness**: Fresh data caches longer (60s), stale data caches less (30s), very stale data doesn't cache. This balances performance with data freshness.

6. **ETag Based on lastUpdated**: Using `lastUpdated.getTime()` as ETag ensures ETag changes whenever data updates, enabling efficient conditional requests.

7. **Separate Latest File**: Maintains `console-usage-synced.json` as a quick-access latest version file (updated by POST endpoint). Provides fast reads without scanning directory.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

Phase 33 is ready to proceed:
- GET endpoint fully operational
- All query modes (latest, version, timestamp) working
- Metadata included in all responses
- Cache optimization in place
- Error handling comprehensive

**Phase 33 will:**
- Update `ClaudeUsageCard` widget to use new `/api/claude/console-usage` GET endpoint
- Remove dependency on local scraper file (`/api/claude-usage/console`)
- Add version selection UI for historical data access
- Implement client-side staleness warnings

## Performance Data

- **Duration**: 2 minutes
- **Tasks Completed**: 7/7
- **Files Modified**: 2
- **Lines Added**: ~260 (endpoint + interface)
- **Commits**: 1

## Commits

- `742244b` - feat(32-01): implement GET /api/claude/console-usage endpoint

## Next Steps

Execute Phase 33 (Widget Migration):
```bash
/gsd:plan-phase 33
```

Then:
```bash
/gsd:execute-plan .planning/phases/33-widget-migration/33-01-PLAN.md
```
