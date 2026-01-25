# Phase 31: EC2 Data Storage - Implementation Plan

<objective>
Implement a robust storage layer on EC2 for Claude Console usage data with versioning, retention policies, and atomic writes. Enable historical data access and prevent disk bloat through automatic cleanup.
</objective>

<execution_context>
**Files to modify:**
- `/Users/neileverette/Desktop/generative-ui-prototype/server/index.ts` - Add storage layer and update POST endpoint
- `/Users/neileverette/Desktop/generative-ui-prototype/server/claude-console-sync-types.ts` - Add storage metadata types

**Files to create:**
- `/Users/neileverette/Desktop/generative-ui-prototype/server/console-storage.ts` - Storage layer module with versioning

**Current state:**
- POST endpoint writes to single file: `console-usage-synced.json`
- No versioning or history
- No retention policy or cleanup
- Simple `fs.writeFileSync` (atomic but overwrites)
</execution_context>

<context>
## Current Implementation

The Phase 29 POST endpoint (`/api/claude/console-usage`) currently:
- Validates incoming sync data
- Writes directly to `console-usage-synced.json` using `fs.writeFileSync`
- No versioning - each write overwrites previous data
- No retention policy - single file persists indefinitely

## Phase Goal

Build a storage layer that:
1. Keeps timestamped versions of all synced data
2. Implements retention policy (last 7 days or 100 records, whichever is larger)
3. Auto-cleanup old versions to prevent disk bloat
4. Atomic writes with error recovery
5. Storage metadata (version count, oldest/newest timestamps)

## Architecture Decision

**Storage approach:** Filesystem-based versioned storage
- Directory: `server/claude-scraper/console-usage-history/`
- File naming: `{timestamp}-{uuid}.json` (e.g., `2026-01-25T10-30-00-abc123.json`)
- Metadata file: `_metadata.json` tracks version count and cleanup state
- Latest symlink: `../console-usage-synced.json` points to newest version

**Retention policy:**
- Keep last 100 versions OR all data from last 7 days (whichever results in more data)
- Run cleanup after each write (async, non-blocking)
- Track cleanup stats in metadata

**Rationale:**
- Simple filesystem approach (no database needed)
- Easy to inspect and debug (JSON files)
- Git-like versioning pattern (familiar)
- Symlink for backward compatibility with existing consumers
</context>

<tasks>
## Task 1: Create storage layer module

**File:** `/Users/neileverette/Desktop/generative-ui-prototype/server/console-storage.ts`

Create a new module with the following functions:

### 1.1 Storage configuration
```typescript
interface StorageConfig {
  historyDir: string;
  maxVersions: number;
  retentionDays: number;
  latestSymlink: string;
}

const DEFAULT_CONFIG: StorageConfig = {
  historyDir: path.join(__dirname, 'claude-scraper/console-usage-history'),
  maxVersions: 100,
  retentionDays: 7,
  latestSymlink: path.join(__dirname, 'claude-scraper/console-usage-synced.json'),
};
```

### 1.2 Storage metadata interface
```typescript
interface StorageMetadata {
  versionCount: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  lastCleanup: string | null;
  totalVersionsCreated: number;
  totalVersionsDeleted: number;
}
```

### 1.3 Core functions to implement

**`initializeStorage(config?: Partial<StorageConfig>): void`**
- Create history directory if it doesn't exist
- Initialize metadata file if missing
- Validate directory is writable

**`saveVersion(data: ConsoleUsageDataSync): Promise<string>`**
- Generate timestamped filename: `YYYY-MM-DDTHH-mm-ss-{shortUuid}.json`
- Write data atomically to history directory
- Update latest symlink (or copy on Windows where symlinks may fail)
- Update metadata (increment version count, update newest timestamp)
- Return filepath of saved version
- Handle errors gracefully (log and throw)

**`cleanupOldVersions(): Promise<void>`**
- Read all version files from history directory
- Sort by timestamp (oldest first)
- Calculate retention threshold: max(last 100 versions, versions from last 7 days)
- Delete files older than threshold
- Update metadata (increment deleted count, update oldest timestamp, set lastCleanup)
- Run asynchronously (don't block save operations)
- Log cleanup results (deleted count, retained count)

**`getStorageMetadata(): StorageMetadata`**
- Read and return current metadata
- If metadata file missing or corrupt, return default values

**`listVersions(limit?: number): string[]`**
- List all version files sorted by timestamp (newest first)
- Return filepath array, optionally limited to N most recent

### 1.4 Helper functions

**`parseTimestampFromFilename(filename: string): Date | null`**
- Extract timestamp from filename format
- Return Date object or null if invalid

**`generateVersionFilename(): string`**
- Create timestamped filename with short UUID
- Format: `YYYY-MM-DDTHH-mm-ss-{8-char-uuid}.json`

## Task 2: Update TypeScript interfaces

**File:** `/Users/neileverette/Desktop/generative-ui-prototype/server/claude-console-sync-types.ts`

Add storage metadata type (export for potential future API endpoints):

```typescript
export interface StorageMetadata {
  versionCount: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  lastCleanup: string | null;
  totalVersionsCreated: number;
  totalVersionsDeleted: number;
}
```

## Task 3: Integrate storage layer into POST endpoint

**File:** `/Users/neileverette/Desktop/generative-ui-prototype/server/index.ts`

### 3.1 Import storage module
```typescript
import { initializeStorage, saveVersion, cleanupOldVersions } from './console-storage.js';
```

### 3.2 Initialize storage on server startup
Add after environment variable checks, before defining endpoints:
```typescript
// Initialize Console usage storage layer
try {
  initializeStorage();
  console.log('[Console Storage] Initialized with versioning and retention policies');
} catch (error) {
  console.error('[Console Storage] Failed to initialize:', error);
  // Non-fatal - server can continue but sync will fail
}
```

### 3.3 Update POST endpoint storage logic

**Replace current write logic** (lines 2273-2283):
```typescript
// OLD (remove):
try {
  fs.writeFileSync(CONSOLE_USAGE_SYNCED_FILE, JSON.stringify(data, null, 2));
} catch (writeError) {
  console.error('[Console Sync] Filesystem error:', writeError);
  return res.status(500).json({
    success: false,
    message: 'Failed to save synced data',
    timestamp: new Date().toISOString(),
  } as SyncResponse);
}
```

**NEW (replace with):**
```typescript
// Save versioned data and update latest symlink
let savedFilepath: string;
try {
  savedFilepath = await saveVersion(data);
} catch (writeError) {
  console.error('[Console Sync] Storage error:', writeError);
  return res.status(500).json({
    success: false,
    message: 'Failed to save synced data',
    timestamp: new Date().toISOString(),
  } as SyncResponse);
}

// Trigger cleanup asynchronously (non-blocking)
cleanupOldVersions().catch(err => {
  console.error('[Console Storage] Cleanup failed:', err);
  // Don't fail the request if cleanup fails
});
```

### 3.4 Update success log to include version info
Update log statement (line 2288-2292) to include saved filepath:
```typescript
console.log(
  `[Console Sync] Data synced successfully (age: ${ageMinutes}min, ` +
  `partial: ${data.isPartial || false}, ` +
  `sections: ${data.currentSession ? 'session' : ''}${data.currentSession && data.weeklyLimits ? '+' : ''}${data.weeklyLimits ? 'limits' : ''}, ` +
  `saved: ${path.basename(savedFilepath)})`
);
```

## Task 4: Create history directory structure

Run initialization to create directories:
```bash
mkdir -p server/claude-scraper/console-usage-history
```

## Task 5: Testing and verification

### 5.1 Test storage initialization
- Start server and verify:
  - `console-usage-history/` directory created
  - `_metadata.json` initialized with default values
  - Server log shows "[Console Storage] Initialized..."

### 5.2 Test version creation
- Trigger a scraper sync (run scraper or use curl to POST test data)
- Verify:
  - New version file created in `console-usage-history/`
  - Filename matches timestamp format
  - `console-usage-synced.json` updated/created with latest data
  - Metadata updated with incremented version count

### 5.3 Test retention and cleanup
**Option A: Create test versions manually**
```bash
cd server/claude-scraper/console-usage-history
# Create 110 test files with old timestamps
for i in {1..110}; do
  echo '{"lastUpdated":"2026-01-01T00:00:00Z"}' > "2026-01-$(printf "%02d" $((i % 28 + 1)))T00-00-00-test$i.json"
done
```

**Option B: Wait for natural accumulation**
- Let scraper run for 9+ hours (110 syncs at 5min intervals)

Trigger cleanup and verify:
- Cleanup runs automatically after next sync
- Check logs for cleanup results: "[Console Storage] Cleanup deleted X versions, retained Y"
- Verify only ~100 most recent files remain (or 7 days worth if more)
- Metadata updated with deletion count

### 5.4 Test error handling
- Make history directory read-only: `chmod 444 server/claude-scraper/console-usage-history`
- Attempt sync and verify:
  - 500 error returned to client
  - Error logged with details
  - Server doesn't crash
- Restore permissions: `chmod 755 server/claude-scraper/console-usage-history`

### 5.5 Verify backward compatibility
- Existing GET endpoint (`/api/claude-usage`) should still work
- Widget should still read from `console-usage-synced.json` (latest data)
</tasks>

<verification>
## Success Criteria

1. **Storage module created and functional**
   - `console-storage.ts` exports all required functions
   - No TypeScript errors or warnings
   - Unit-testable functions with clear interfaces

2. **Versioned storage working**
   - Each sync creates new timestamped file
   - Latest data accessible via `console-usage-synced.json`
   - History directory accumulates versions

3. **Retention policy enforced**
   - Cleanup automatically runs after writes
   - Old versions deleted according to policy (100 versions OR 7 days)
   - Metadata tracks cleanup statistics

4. **Error handling robust**
   - Storage errors don't crash server
   - Appropriate HTTP status codes returned
   - Errors logged with context

5. **Backward compatibility maintained**
   - Existing consumers of `console-usage-synced.json` continue working
   - No breaking changes to API responses

## Validation Commands

```bash
# Check storage structure
ls -la server/claude-scraper/console-usage-history/
cat server/claude-scraper/console-usage-history/_metadata.json

# Verify latest data symlink/file
ls -la server/claude-scraper/console-usage-synced.json

# Watch for new versions during scraper operation
watch -n 5 'ls -lt server/claude-scraper/console-usage-history/ | head -10'

# Check metadata evolution
watch -n 5 'cat server/claude-scraper/console-usage-history/_metadata.json'

# Verify cleanup (after accumulating 100+ versions)
echo "Version count before cleanup:"
ls server/claude-scraper/console-usage-history/*.json | wc -l
# Trigger sync (wait for cleanup)
echo "Version count after cleanup:"
ls server/claude-scraper/console-usage-history/*.json | wc -l
```
</verification>

<success_criteria>
1. Storage layer module created with versioning and retention
2. All syncs create timestamped version files
3. Retention policy (100 versions OR 7 days) automatically enforced
4. Metadata tracks storage statistics
5. Latest data accessible via `console-usage-synced.json` for backward compatibility
6. Server startup initializes storage directory and metadata
7. No breaking changes to existing endpoints or consumers
8. Comprehensive error handling prevents storage issues from crashing server
</success_criteria>

<output>
## Deliverables

1. **New module:** `server/console-storage.ts` (storage layer implementation)
2. **Updated types:** `server/claude-console-sync-types.ts` (metadata interface)
3. **Updated server:** `server/index.ts` (integrated storage layer)
4. **Storage directory:** `server/claude-scraper/console-usage-history/` (version files)
5. **Metadata file:** `server/claude-scraper/console-usage-history/_metadata.json`

## Next Phase

After Phase 31 completion:
- **Phase 32: EC2 GET Endpoint** - Create endpoint to serve stored usage data with optional version/timestamp queries
</output>
