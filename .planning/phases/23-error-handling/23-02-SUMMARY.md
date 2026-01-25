---
phase: 23-error-handling
plan: 02
subsystem: scraper
tags: [error-handling, partial-data, graceful-degradation, resilience]
requires: [23-01]
provides: [partial-data-extraction, section-level-errors, graceful-degradation]
affects: [24, 25]
tech-stack:
  added: []
  patterns: [partial-success-handling, section-independent-extraction]
key-files:
  created: []
  modified:
    - server/claude-scraper/scrape.ts
    - server/claude-scraper/auto-scraper.ts
key-decisions:
  - Extract each data section (currentSession, allModels, sonnetOnly) independently with individual try/catch blocks
  - Treat partial success (1-2 sections extracted) as success in retry logic to prevent unnecessary retries
  - Only fail completely if all sections fail to extract, otherwise save whatever data is available
  - Use 5-second timeout per section to fail fast on missing elements
  - Provide empty string defaults for missing sections in weeklyLimits to maintain type consistency
issues-created: []
metrics:
  duration: 12 minutes
  completed: 2026-01-25
---

# Phase 23 Plan 2: Graceful Degradation Summary

Transformed scraper from all-or-nothing extraction to graceful degradation with section-level error handling, enabling partial data saves when some Console sections fail while others succeed.

## Accomplishments

Implemented section-independent extraction where each data section (current session, weekly all models, weekly Sonnet only) is extracted in its own try/catch block with a 5-second timeout. If any section fails, the scraper logs the specific error and continues extracting remaining sections. The resulting data structure includes an `isPartial` flag and `extractionErrors` record documenting exactly which sections failed and why. The auto-scraper treats partial success (1-2 sections) the same as complete success, resetting retry state and circuit breaker to prevent unnecessary retries when partial data is still valuable to users.

### Interface Changes (scrape.ts, 40 lines modified)

Modified `ConsoleUsageData` interface to support partial extraction:
- Made `currentSession` optional (currentSession?)
- Made `weeklyLimits` optional (weeklyLimits?)
- Added `extractionErrors?: Record<string, string>` to document missing sections
- Added `isPartial?: boolean` flag to indicate partial extraction
- Kept `lastUpdated` and `error` fields for backward compatibility

Example partial data structure:
```json
{
  "currentSession": {
    "resetsIn": "3 hr 55 min",
    "percentageUsed": 29
  },
  "lastUpdated": "2026-01-25T02:15:00Z",
  "isPartial": true,
  "extractionErrors": {
    "allModels": "Timeout waiting for element",
    "sonnetOnly": "Data not found in DOM"
  }
}
```

### Section-Independent Extraction (scrape.ts, 153 additions/45 deletions)

Refactored page.evaluate() into three independent extraction blocks:
1. **Extract current session**: 5s timeout for "Current session" selector
   - On success: Assigns to currentSession, increments sectionsExtracted
   - On failure: Logs warning, adds error to extractionErrors
2. **Extract weekly all models**: 5s timeout for "All models" selector
   - On success: Assigns to allModels, increments sectionsExtracted
   - On failure: Logs warning, adds error to extractionErrors
3. **Extract weekly Sonnet only**: 5s timeout for "Sonnet only" selector
   - On success: Assigns to sonnetOnly, increments sectionsExtracted
   - On failure: Logs warning, adds error to extractionErrors

After all extractions:
- If sectionsExtracted === 0: Throws error (completely broken scrape)
- If sectionsExtracted < 3: Sets isPartial = true, saves available data
- If sectionsExtracted === 3: Sets isPartial = false, complete success
- Logs clear message: "Partial data extracted (2/3 sections). Missing: X"

### Auto-Scraper Integration (auto-scraper.ts, 35 additions/1 deletion)

Modified auto-scraper to recognize partial vs complete success:
- After scrape completes, reads usage-data.json and checks isPartial flag
- Counts extracted sections by checking presence of currentSession, allModels, sonnetOnly
- **Partial success (1-2 sections)**:
  - Resets retry state (like complete success)
  - Resets circuit breaker (like complete success)
  - Logs: "Scrape completed with partial data (N/3 sections). Missing: X"
  - In verbose mode: Shows extractionErrors details
- **Complete success (3 sections)**:
  - Resets retry state and circuit breaker
  - Logs: "Scrape completed successfully (3/3 sections)"
- **Complete failure (0 sections)**:
  - Increments consecutiveErrors
  - Applies retry strategy with exponential backoff
  - Triggers circuit breaker as before

This ensures the scraper doesn't enter retry/backoff mode when partial data is successfully extracted, while still providing monitoring visibility into what's missing.

## Files Created/Modified

### Modified
- `server/claude-scraper/scrape.ts` (258 lines, +153/-45)
  - Modified ConsoleUsageData interface with optional sections and error tracking
  - Section-independent extraction with individual try/catch blocks
  - Partial success handling with isPartial flag and extractionErrors
  - Clear logging of section counts and missing data

- `server/claude-scraper/auto-scraper.ts` (209 lines, +35/-1)
  - Import ConsoleUsageData type and fs module
  - Read usage-data.json after scrape to check partial status
  - Count extracted sections to show completeness
  - Treat partial success as success in retry/circuit breaker logic
  - Enhanced logging to show partial vs complete scrapes

## Technical Details

### Extraction Flow
```
Start extraction
  ├─ Try currentSession (5s timeout)
  │   ├─ Success → sectionsExtracted++
  │   └─ Failure → extractionErrors['currentSession'] = error
  ├─ Try allModels (5s timeout)
  │   ├─ Success → sectionsExtracted++
  │   └─ Failure → extractionErrors['allModels'] = error
  └─ Try sonnetOnly (5s timeout)
      ├─ Success → sectionsExtracted++
      └─ Failure → extractionErrors['sonnetOnly'] = error

Check sectionsExtracted:
  ├─ 0 sections → Throw error (complete failure)
  ├─ 1-2 sections → Save partial data with isPartial=true
  └─ 3 sections → Save complete data with isPartial=false
```

### Partial Success Criteria
- At least 1 section extracted successfully
- isPartial flag set to true
- extractionErrors documents missing sections
- Auto-scraper treats as success (no retry)
- Frontend receives whatever data is available

### Complete Failure Criteria
- All 3 sections failed to extract
- Throws error with aggregated extractionErrors
- Auto-scraper treats as failure (triggers retry logic)
- Circuit breaker and exponential backoff apply

## Commits

1. `7bf7500` - feat(23-error-handling-23-02): implement section-level error handling with partial data extraction
2. `7658d8b` - feat(23-error-handling-23-02): update auto-scraper to handle partial data results

## Decisions Made

1. **5-second timeout per section**: Chose 5 seconds as a balance between allowing slow DOM rendering and failing fast on missing elements. Total extraction time is at most 15 seconds (3 sections × 5s) vs previous 10-second wait for all data.

2. **Partial success resets retry state**: Decided that partial data (1-2 sections) should be treated as success in the retry logic because:
   - Partial data is still valuable to users (better than nothing)
   - Missing sections might indicate Console UI changes, not transient failures
   - Prevents retry loop when 2/3 sections consistently succeed
   - Still logs warnings for monitoring and debugging

3. **Empty string defaults for partial weeklyLimits**: When only one of allModels or sonnetOnly extracts, fill the other with empty string defaults to maintain type consistency. Alternative would be to make weeklyLimits.allModels and weeklyLimits.sonnetOnly optional, but that would require frontend changes.

4. **Section extraction order**: Extract in user-visible order (currentSession → allModels → sonnetOnly) rather than likelihood of success, making logs easier to correlate with UI.

## Issues Encountered

None. All verification checks passed on first build. TypeScript compilation succeeded with no errors or warnings.

## Next Phase Readiness

Phase 23 complete (2/2 plans finished). Ready for Phase 24: Data Extraction Enhancement.

**Note for Phase 24**: The partial data structure is now in place with optional sections, extractionErrors tracking, and isPartial flag. Phase 24 can add new data sections (billing info, plan details, historical data) using the same section-independent extraction pattern to maintain graceful degradation. Each new section should:
- Extract in its own try/catch block
- Add errors to extractionErrors on failure
- Include in sectionsExtracted count
- Update totalSections count

This ensures future enhancements maintain the same resilience characteristics.
