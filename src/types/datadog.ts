/**
 * Datadog API Types
 */

import {
  DATADOG_HOST_FILTER,
  METRIC_THRESHOLDS,
  buildMetricQuery,
} from '../config/metrics.config';

export interface DatadogMetricQuery {
  query: string;
  from: number;  // Unix timestamp (seconds)
  to: number;    // Unix timestamp (seconds)
}

export interface DatadogMetricPoint {
  timestamp: number;
  value: number;
}

export interface DatadogMetricSeries {
  metric: string;
  pointlist: [number, number][];  // [timestamp_ms, value]
  scope: string;
  expression: string;
}

export interface DatadogMetricResponse {
  status: string;
  series: DatadogMetricSeries[];
  from_date: number;
  to_date: number;
  query: string;
}

// Simplified metrics we'll work with
export interface MetricData {
  name: string;
  displayName: string;
  currentValue: number;
  previousValue?: number;
  unit: string;
  timeSeries: DatadogMetricPoint[];
  scope?: string;
}

// Re-export config for convenience
export { DATADOG_HOST_FILTER, METRIC_THRESHOLDS };

// Predefined metric queries for common observability signals
// Uses host filter from config (default: '{*}' for all hosts)
export const METRIC_QUERIES = {
  // CPU metrics
  cpuUser: buildMetricQuery('system.cpu.user'),
  cpuSystem: buildMetricQuery('system.cpu.system'),
  cpuTotal: `${buildMetricQuery('system.cpu.user')} + ${buildMetricQuery('system.cpu.system')}`,

  // Memory metrics
  memUsable: buildMetricQuery('system.mem.usable'),
  memTotal: buildMetricQuery('system.mem.total'),
  memUsedPercent: `100 * (${buildMetricQuery('system.mem.total')} - ${buildMetricQuery('system.mem.usable')}) / ${buildMetricQuery('system.mem.total')}`,

  // Load metrics
  loadAvg1: buildMetricQuery('system.load.1'),
  loadAvg5: buildMetricQuery('system.load.5'),
  loadAvg15: buildMetricQuery('system.load.15'),

  // Docker/Container metrics
  containersRunning: buildMetricQuery('docker.containers.running'),
  dockerCpuUser: `avg:docker.cpu.user{${DATADOG_HOST_FILTER}} by {docker_image}`,
  dockerMemRss: `avg:docker.mem.rss{${DATADOG_HOST_FILTER}} by {docker_image}`,

  // Network metrics
  networkBytesIn: buildMetricQuery('system.net.bytes_rcvd'),
  networkBytesOut: buildMetricQuery('system.net.bytes_sent'),

  // Disk metrics
  diskUsedPercent: `${buildMetricQuery('system.disk.in_use')} * 100`,

  // n8n workflow metrics (if available)
  n8nExecutions: 'sum:n8n.workflow.execution{*}.as_count()',

} as const;

// Metric display configuration
export interface MetricConfig {
  query: string;
  displayName: string;
  unit: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  higherIsBetter?: boolean;
  description?: string;
}

export const METRIC_CONFIGS: Record<string, MetricConfig> = {
  cpuTotal: {
    query: METRIC_QUERIES.cpuTotal,
    displayName: 'CPU Usage',
    unit: '%',
    warningThreshold: METRIC_THRESHOLDS.cpu.warning,
    criticalThreshold: METRIC_THRESHOLDS.cpu.critical,
    description: 'Combined user and system CPU utilization',
  },
  memUsedPercent: {
    query: METRIC_QUERIES.memUsedPercent,
    displayName: 'Memory Usage',
    unit: '%',
    warningThreshold: METRIC_THRESHOLDS.memory.warning,
    criticalThreshold: METRIC_THRESHOLDS.memory.critical,
    description: 'Percentage of memory in use',
  },
  loadAvg1: {
    query: METRIC_QUERIES.loadAvg1,
    displayName: 'Load Average (1m)',
    unit: '',
    warningThreshold: METRIC_THRESHOLDS.load.warning,
    criticalThreshold: METRIC_THRESHOLDS.load.critical,
    description: '1-minute load average',
  },
  containersRunning: {
    query: METRIC_QUERIES.containersRunning,
    displayName: 'Running Containers',
    unit: '',
    description: 'Number of Docker containers currently running',
  },
  networkBytesIn: {
    query: METRIC_QUERIES.networkBytesIn,
    displayName: 'Network In',
    unit: 'B/s',
    description: 'Bytes received per second',
  },
  networkBytesOut: {
    query: METRIC_QUERIES.networkBytesOut,
    displayName: 'Network Out',
    unit: 'B/s',
    description: 'Bytes sent per second',
  },
  diskUsedPercent: {
    query: METRIC_QUERIES.diskUsedPercent,
    displayName: 'Disk Usage',
    unit: '%',
    warningThreshold: METRIC_THRESHOLDS.disk.warning,
    criticalThreshold: METRIC_THRESHOLDS.disk.critical,
    description: 'Percentage of disk space used',
  },
};
