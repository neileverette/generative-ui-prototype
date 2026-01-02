/**
 * Datadog API Types
 */

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

// Predefined metric queries for common observability signals
export const METRIC_QUERIES = {
  // CPU metrics
  cpuUser: 'avg:system.cpu.user{host:i-040ac6026761030ac}',
  cpuSystem: 'avg:system.cpu.system{host:i-040ac6026761030ac}',
  cpuTotal: 'avg:system.cpu.user{host:i-040ac6026761030ac} + avg:system.cpu.system{host:i-040ac6026761030ac}',
  
  // Memory metrics
  memUsable: 'avg:system.mem.usable{host:i-040ac6026761030ac}',
  memTotal: 'avg:system.mem.total{host:i-040ac6026761030ac}',
  memUsedPercent: '100 * (avg:system.mem.total{host:i-040ac6026761030ac} - avg:system.mem.usable{host:i-040ac6026761030ac}) / avg:system.mem.total{host:i-040ac6026761030ac}',
  
  // Load metrics
  loadAvg1: 'avg:system.load.1{host:i-040ac6026761030ac}',
  loadAvg5: 'avg:system.load.5{host:i-040ac6026761030ac}',
  loadAvg15: 'avg:system.load.15{host:i-040ac6026761030ac}',
  
  // Docker/Container metrics
  containersRunning: 'avg:docker.containers.running{host:i-040ac6026761030ac}',
  dockerCpuUser: 'avg:docker.cpu.user{host:i-040ac6026761030ac} by {docker_image}',
  dockerMemRss: 'avg:docker.mem.rss{host:i-040ac6026761030ac} by {docker_image}',
  
  // Network metrics
  networkBytesIn: 'avg:system.net.bytes_rcvd{host:i-040ac6026761030ac}',
  networkBytesOut: 'avg:system.net.bytes_sent{host:i-040ac6026761030ac}',
  
  // Disk metrics
  diskUsedPercent: 'avg:system.disk.in_use{host:i-040ac6026761030ac} * 100',
  
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
    warningThreshold: 70,
    criticalThreshold: 90,
    description: 'Combined user and system CPU utilization',
  },
  memUsedPercent: {
    query: METRIC_QUERIES.memUsedPercent,
    displayName: 'Memory Usage',
    unit: '%',
    warningThreshold: 80,
    criticalThreshold: 95,
    description: 'Percentage of memory in use',
  },
  loadAvg1: {
    query: METRIC_QUERIES.loadAvg1,
    displayName: 'Load Average (1m)',
    unit: '',
    warningThreshold: 2,
    criticalThreshold: 4,
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
    warningThreshold: 80,
    criticalThreshold: 95,
    description: 'Percentage of disk space used',
  },
};
