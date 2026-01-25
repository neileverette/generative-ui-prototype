---
phase: 42-cache-storage-architecture
plan: 01
subsystem: caching
tags: [localStorage, TypeScript, browser-storage, cache-management]
requires: []
provides: [widget-cache-utility, cache-versioning, staleness-detection]
affects: [43-widget-cache-hydration, 44-background-fetch, 46-cache-invalidation]
tech-stack:
  added: []
  patterns: [localStorage-abstraction, version-based-invalidation, generic-type-safety]
key-files:
  created: [src/utils/widget-cache.ts]
  modified: []
key-decisions:
  - decision: localStorage over IndexedDB
    rationale: Simpler synchronous API, sufficient capacity (5-10MB), matches insights-cache.ts pattern
  - decision: Cache key structure {widgetType}:{cacheKey}
    rationale: Enables multiple cache entries per widget type for different queries/timeframes
  - decision: Silent error handling for all localStorage operations
    rationale: Graceful degradation - cache failures should never break widgets
issues-created: []
duration: 8 min
completed: 2026-01-25
---

# Phase 42 Plan 1: Cache Storage Architecture Summary

**localStorage-based widget cache with TypeScript generics, versioning, and staleness detection utilities**

## Accomplishments

- Created widget-cache.ts module with complete TypeScript interfaces
- Implemented localStorage-based cache operations with error handling
- Added versioning support with automatic cache reset on version mismatch
- Built staleness detection utilities (isCacheStale, getCacheAge)
- Implemented cache pruning and selective invalidation by widget type
- Extended insights-cache.ts pattern to support multiple widget types

## Technical Implementation

**TypeScript Interfaces:**
- `WidgetCacheEntry<T>` - Generic cache entry with data, timestamp, version, widgetType
- `WidgetCache` - Top-level structure with version and entries Record

**Core Operations:**
- `getCachedWidget<T>(widgetType, cacheKey)` - Type-safe cache retrieval
- `setCachedWidget<T>(widgetType, cacheKey, data)` - Save data with timestamp
- `deleteCachedWidget(widgetType, cacheKey)` - Remove specific entry
- `clearWidgetCache()` - Clear all cached data

**Utility Functions:**
- `isCacheStale(entry, maxAgeMs)` - Check if entry exceeds age threshold
- `getCacheAge(entry)` - Get entry age in milliseconds
- `pruneStaleWidgetCache(maxAgeHours)` - Remove old entries automatically
- `clearWidgetCacheByType(widgetType)` - Selective invalidation by type

**Error Handling:**
- All localStorage operations wrapped in try/catch
- Parse errors return empty cache (no crashes)
- Quota exceeded errors silently ignored (Phase 47 will add quota management)
- Version mismatch triggers automatic cache reset

## Files Created/Modified

**Created:**
- `src/utils/widget-cache.ts` (242 lines) - Complete cache utility module

**Modified:**
- None

## Decisions Made

1. **localStorage over IndexedDB**
   - Rationale: Simpler synchronous API, no async complexity in render path
   - Capacity: 5-10MB sufficient for widget data (JSON responses ~5-50KB)
   - Proven pattern: insights-cache.ts already demonstrates localStorage viability
   - Debugging: Easier inspection via Chrome DevTools → Application → Local Storage

2. **Cache key structure: `{widgetType}:{cacheKey}`**
   - Rationale: Allows multiple cache entries per widget type
   - Examples: `anthropic-usage:api-tokens`, `aws-costs:monthly-summary`
   - Benefit: Flexible caching for different queries/timeframes within same widget

3. **Silent error handling for all localStorage operations**
   - Rationale: Cache failures should never break widget functionality
   - Pattern: Try/catch wraps all operations, errors logged but not thrown
   - Graceful degradation: Widget falls back to fetch-only mode if cache unavailable

4. **Version-based cache invalidation**
   - Rationale: Automatic schema migration when data structure changes
   - Mechanism: Bump CACHE_VERSION → old cache auto-reset on next access
   - Alternative considered: Manual migration functions (rejected as over-engineered for v1)

## Commits

- `107e55b` - feat(42-01): design cache storage architecture and TypeScript interfaces
- `afe5377` - feat(42-01): implement core cache operations (get, set, delete, clear)
- `cd816de` - feat(42-01): add cache utilities for staleness detection and pruning

## Issues Encountered

None - plan executed exactly as written.

## Next Phase Readiness

Phase 42 complete (1/1 plans). Ready for Phase 43 (Widget Cache Hydration Layer).

**Widget integration requirements:**
- Import `getCachedWidget` on component mount
- Display cached data immediately if available
- Show staleness indicator if `isCacheStale()` returns true
- Trigger background fetch after displaying cache
- Use `setCachedWidget` to update cache after successful fetch

**Example integration pattern:**
```typescript
const cached = getCachedWidget<UsageData>('anthropic-usage', 'api-tokens');
if (cached) {
  setData(cached.data);
  setIsStale(isCacheStale(cached, 5 * 60 * 1000)); // 5 min threshold
}
fetchFreshData().then(fresh => {
  setData(fresh);
  setIsStale(false);
  setCachedWidget('anthropic-usage', 'api-tokens', fresh);
});
```

All cache operations are non-blocking and fail gracefully. Phase 43 can safely integrate without error handling concerns.
