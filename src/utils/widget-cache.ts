/**
 * Widget Cache Utility
 *
 * Caches widget data in localStorage for instant rendering on subsequent page loads.
 * When fresh data is loading, cached versions are shown with a stale indicator.
 *
 * Extends the insights-cache.ts pattern to support multiple widget types with
 * flexible cache keys and versioning.
 */

const CACHE_KEY = 'widget-cache-v1';
const CACHE_VERSION = 1;

/**
 * Generic cache entry for any widget data type
 */
export interface WidgetCacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  version: number;
  widgetType: string;
}

/**
 * Top-level cache structure
 */
export interface WidgetCache {
  version: number;
  entries: Record<string, WidgetCacheEntry>;
}

/**
 * Get the entire cache from localStorage
 * @internal
 */
function getCache(): WidgetCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return { version: CACHE_VERSION, entries: {} };
    }
    const cache = JSON.parse(raw) as WidgetCache;
    // Reset cache if version mismatch
    if (cache.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, entries: {} };
    }
    return cache;
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

/**
 * Save the cache to localStorage
 * @internal
 */
function saveCache(cache: WidgetCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
    // Phase 47 will add quota management
  }
}

/**
 * Get cached widget data for a specific widget type and cache key
 *
 * @param widgetType - Type of widget (e.g., 'anthropic-usage', 'aws-costs')
 * @param cacheKey - Specific cache key for this widget (e.g., 'api-tokens', 'monthly-summary')
 * @returns Cached entry if exists, null otherwise
 *
 * @example
 * ```ts
 * const cached = getCachedWidget<ApiTokenUsage>('anthropic-usage', 'api-tokens');
 * if (cached) {
 *   console.log('Cached data:', cached.data);
 *   console.log('Age:', Date.now() - cached.timestamp);
 * }
 * ```
 */
export function getCachedWidget<T = unknown>(
  widgetType: string,
  cacheKey: string
): WidgetCacheEntry<T> | null {
  const cache = getCache();
  const key = `${widgetType}:${cacheKey}`;
  return (cache.entries[key] as WidgetCacheEntry<T>) || null;
}

/**
 * Save widget data to cache
 *
 * @param widgetType - Type of widget (e.g., 'anthropic-usage', 'aws-costs')
 * @param cacheKey - Specific cache key for this widget (e.g., 'api-tokens', 'monthly-summary')
 * @param data - Data to cache (will be serialized to JSON)
 *
 * @example
 * ```ts
 * setCachedWidget('anthropic-usage', 'api-tokens', {
 *   tokens: 150000,
 *   limit: 200000,
 *   resetDate: '2026-02-01'
 * });
 * ```
 */
export function setCachedWidget<T = unknown>(
  widgetType: string,
  cacheKey: string,
  data: T
): void {
  const cache = getCache();
  const key = `${widgetType}:${cacheKey}`;
  cache.entries[key] = {
    data,
    timestamp: Date.now(),
    version: CACHE_VERSION,
    widgetType,
  };
  saveCache(cache);
}

/**
 * Delete a specific cached widget entry
 *
 * @param widgetType - Type of widget
 * @param cacheKey - Specific cache key
 */
export function deleteCachedWidget(widgetType: string, cacheKey: string): void {
  const cache = getCache();
  const key = `${widgetType}:${cacheKey}`;
  delete cache.entries[key];
  saveCache(cache);
}

/**
 * Clear all widget cache entries
 *
 * Useful for debugging and force refresh scenarios.
 */
export function clearWidgetCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Check if a cache entry is stale (older than specified age)
 *
 * @param entry - Cache entry to check
 * @param maxAgeMs - Maximum age in milliseconds
 * @returns true if entry is older than maxAgeMs
 *
 * @example
 * ```ts
 * const entry = getCachedWidget('anthropic-usage', 'api-tokens');
 * if (entry && isCacheStale(entry, 5 * 60 * 1000)) {
 *   console.log('Cache is older than 5 minutes');
 * }
 * ```
 */
export function isCacheStale(entry: WidgetCacheEntry, maxAgeMs: number): boolean {
  return Date.now() - entry.timestamp > maxAgeMs;
}

/**
 * Get the age of a cache entry in milliseconds
 *
 * @param entry - Cache entry to check
 * @returns Age in milliseconds
 *
 * @example
 * ```ts
 * const entry = getCachedWidget('anthropic-usage', 'api-tokens');
 * if (entry) {
 *   const ageMinutes = Math.floor(getCacheAge(entry) / 1000 / 60);
 *   console.log(`Updated ${ageMinutes} minutes ago`);
 * }
 * ```
 */
export function getCacheAge(entry: WidgetCacheEntry): number {
  return Date.now() - entry.timestamp;
}

/**
 * Remove stale cache entries (older than specified hours)
 *
 * Follows the insights-cache.ts pattern for automatic cache cleanup.
 * Should be called on app startup to prevent cache bloat.
 *
 * @param maxAgeHours - Maximum age in hours (default: 24)
 *
 * @example
 * ```ts
 * // In app initialization
 * pruneStaleWidgetCache(24); // Remove entries older than 24 hours
 * ```
 */
export function pruneStaleWidgetCache(maxAgeHours: number = 24): void {
  const cache = getCache();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  let pruned = false;
  for (const key of Object.keys(cache.entries)) {
    if (now - cache.entries[key].timestamp > maxAge) {
      delete cache.entries[key];
      pruned = true;
    }
  }

  if (pruned) {
    saveCache(cache);
  }
}

/**
 * Clear all cache entries for a specific widget type
 *
 * Useful for selective invalidation when a widget's data structure changes.
 *
 * @param widgetType - Type of widget to clear (e.g., 'aws-costs')
 *
 * @example
 * ```ts
 * // Force refresh all AWS cost widget cache entries
 * clearWidgetCacheByType('aws-costs');
 * ```
 */
export function clearWidgetCacheByType(widgetType: string): void {
  const cache = getCache();
  let cleared = false;

  for (const key of Object.keys(cache.entries)) {
    if (key.startsWith(`${widgetType}:`)) {
      delete cache.entries[key];
      cleared = true;
    }
  }

  if (cleared) {
    saveCache(cache);
  }
}
