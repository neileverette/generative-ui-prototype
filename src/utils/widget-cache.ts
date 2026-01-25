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
