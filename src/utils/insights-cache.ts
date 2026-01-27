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

/**
 * Fallback insights when AI-generated insights fail to load.
 * These provide basic, helpful context for each metric type.
 */
const FALLBACK_INSIGHTS: Record<string, { interpretation: string; actionableInsights?: string[] }> = {
  // System metrics
  cpu_total: {
    interpretation: 'CPU usage reflects the percentage of processor capacity being utilized across all cores.',
    actionableInsights: ['Monitor for sustained high usage above 80%'],
  },
  cpu_idle: {
    interpretation: 'CPU idle time shows available processing capacity. Higher values indicate more headroom.',
    actionableInsights: ['Low idle time may indicate resource constraints'],
  },
  memory_used_percent: {
    interpretation: 'Memory usage shows the percentage of RAM currently in use by applications and system processes.',
    actionableInsights: ['Consider scaling if consistently above 85%'],
  },
  load_1min: {
    interpretation: 'Load average represents the average number of processes waiting for CPU time over the last minute.',
    actionableInsights: ['Values above CPU count may indicate bottlenecks'],
  },
  disk_used_percent: {
    interpretation: 'Disk usage shows the percentage of storage capacity currently in use.',
    actionableInsights: ['Plan for expansion when usage exceeds 80%'],
  },
  cpu_iowait: {
    interpretation: 'I/O wait time indicates how often the CPU is waiting for disk or network operations.',
    actionableInsights: ['High I/O wait may indicate slow storage'],
  },
  network_bytes_recv: {
    interpretation: 'Incoming network traffic measures data received by the system from external sources.',
    actionableInsights: ['Monitor for unexpected traffic spikes'],
  },
  network_bytes_sent: {
    interpretation: 'Outgoing network traffic measures data sent from the system to external destinations.',
    actionableInsights: ['Large outbound traffic may indicate data transfers'],
  },
  swap_used_percent: {
    interpretation: 'Swap usage indicates when the system is using disk space as virtual memory.',
    actionableInsights: ['High swap usage suggests memory pressure'],
  },
  system_uptime: {
    interpretation: 'System uptime shows how long the server has been running since its last restart.',
    actionableInsights: ['Regular restarts help apply security patches'],
  },
  network_errors: {
    interpretation: 'Network errors track failed network transmissions that may indicate connectivity issues.',
    actionableInsights: ['Investigate if error rate increases suddenly'],
  },
  // Container metrics
  'running-containers-count': {
    interpretation: 'Shows the number of Docker containers currently running in your environment.',
    actionableInsights: ['Verify expected containers are running'],
  },
};

/**
 * Get fallback insight for a metric when AI insights fail to load.
 * Returns a basic, helpful interpretation based on the metric type.
 */
export function getFallbackInsight(metricId: string): { interpretation: string; actionableInsights?: string[] } | null {
  return FALLBACK_INSIGHTS[metricId] || null;
}

/**
 * Get all fallback insights for multiple metric IDs
 */
export function getFallbackInsights(metricIds: string[]): Record<string, { interpretation: string; actionableInsights?: string[] }> {
  const result: Record<string, { interpretation: string; actionableInsights?: string[] }> = {};
  for (const id of metricIds) {
    const fallback = FALLBACK_INSIGHTS[id];
    if (fallback) {
      result[id] = fallback;
    }
  }
  return result;
}
