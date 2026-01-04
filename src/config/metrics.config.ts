/**
 * Metrics Configuration
 *
 * External configuration for Datadog metrics queries.
 * Update these values to change hosts, thresholds, or add new metrics.
 */

// Host filter - use '{*}' for all hosts or 'host:your-host-id' for specific host
export const DATADOG_HOST_FILTER = '{*}';

// Alternatively, use a specific host:
// export const DATADOG_HOST_FILTER = 'host:i-040ac6026761030ac';

// Metric thresholds - adjust these based on your infrastructure
export const METRIC_THRESHOLDS = {
  cpu: {
    warning: 70,
    critical: 90,
  },
  memory: {
    warning: 80,
    critical: 95,
  },
  load: {
    warning: 2.0,
    critical: 4.0,
  },
  disk: {
    warning: 80,
    critical: 95,
  },
} as const;

// Metric display names
export const METRIC_DISPLAY_NAMES = {
  cpuUser: 'CPU User Time',
  cpuSystem: 'CPU System Time',
  cpuTotal: 'CPU Usage',
  memUsable: 'Available Memory',
  memTotal: 'Total Memory',
  memUsedPercent: 'Memory Usage',
  loadAvg1: 'Load Average (1m)',
  loadAvg5: 'Load Average (5m)',
  loadAvg15: 'Load Average (15m)',
  containersRunning: 'Running Containers',
  diskUsedPercent: 'Disk Usage',
  networkBytesIn: 'Network In',
  networkBytesOut: 'Network Out',
} as const;

// Units for each metric type
export const METRIC_UNITS = {
  cpu: '%',
  memory: '%',
  memoryBytes: 'bytes',
  load: '',
  containers: '',
  disk: '%',
  network: 'B/s',
} as const;

// Helper to build a metric query with the configured host filter
export function buildMetricQuery(metric: string, hostFilter = DATADOG_HOST_FILTER): string {
  return `avg:${metric}{${hostFilter}}`;
}

// Helper to build combined metric queries
export function buildCombinedQuery(metrics: string[], operation = '+', hostFilter = DATADOG_HOST_FILTER): string {
  return metrics.map(m => `avg:${m}{${hostFilter}}`).join(` ${operation} `);
}
