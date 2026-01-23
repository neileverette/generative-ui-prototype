/**
 * Insights Cache Utility
 *
 * Caches AI-generated insights in localStorage for faster initial rendering.
 * When fresh insights are loading, cached versions are shown with a stale indicator.
 */

const CACHE_KEY = 'insights-cache';
const CACHE_VERSION = 1;

interface CachedInsight {
  interpretation?: string;
  actionableInsights?: string[];
  insight?: string;  // For CardGroup
  timestamp: number;
}

interface InsightsCache {
  version: number;
  insights: Record<string, CachedInsight>;
}

/**
 * Get the entire cache from localStorage
 */
function getCache(): InsightsCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return { version: CACHE_VERSION, insights: {} };
    }
    const cache = JSON.parse(raw) as InsightsCache;
    // Reset cache if version mismatch
    if (cache.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, insights: {} };
    }
    return cache;
  } catch {
    return { version: CACHE_VERSION, insights: {} };
  }
}

/**
 * Save the cache to localStorage
 */
function saveCache(cache: InsightsCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Get cached insight for a specific component
 */
export function getCachedInsight(componentId: string): CachedInsight | null {
  const cache = getCache();
  return cache.insights[componentId] || null;
}

/**
 * Save insight to cache
 */
export function setCachedInsight(
  componentId: string,
  insight: {
    interpretation?: string;
    actionableInsights?: string[];
    insight?: string;
  }
): void {
  const cache = getCache();
  cache.insights[componentId] = {
    ...insight,
    timestamp: Date.now(),
  };
  saveCache(cache);
}

/**
 * Get all cached insights for multiple component IDs
 */
export function getCachedInsights(componentIds: string[]): Record<string, CachedInsight> {
  const cache = getCache();
  const result: Record<string, CachedInsight> = {};
  for (const id of componentIds) {
    if (cache.insights[id]) {
      result[id] = cache.insights[id];
    }
  }
  return result;
}

/**
 * Clear all cached insights
 */
export function clearInsightsCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Remove stale cache entries (older than specified hours)
 */
export function pruneStaleCache(maxAgeHours: number = 24): void {
  const cache = getCache();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  let pruned = false;
  for (const id of Object.keys(cache.insights)) {
    if (now - cache.insights[id].timestamp > maxAge) {
      delete cache.insights[id];
      pruned = true;
    }
  }

  if (pruned) {
    saveCache(cache);
  }
}
