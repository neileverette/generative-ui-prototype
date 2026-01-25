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
