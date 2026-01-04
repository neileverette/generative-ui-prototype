/**
 * Centralized Datadog Metrics Configuration
 *
 * This file defines all infrastructure metrics that can be queried from Datadog.
 * Add/remove metrics here to configure what data the LangFlow agent can access.
 */

export interface MetricDefinition {
  /** Unique identifier for this metric */
  id: string;
  /** Display name shown in UI */
  displayName: string;
  /** Datadog query string */
  query: string;
  /** Unit of measurement (%, GB, ms, etc.) */
  unit: string;
  /** Category for grouping (system, docker, network, etc.) */
  category: 'system' | 'docker' | 'network' | 'custom';
  /** Keywords for natural language matching */
  keywords: string[];
  /** Warning threshold (optional) */
  warning?: number;
  /** Critical threshold (optional) */
  critical?: number;
  /** Description for the agent */
  description: string;
}

/**
 * Default host filter
 * Use '*' for all hosts, or 'host:your-host-id' for a specific host
 */
export const DEFAULT_HOST = '*';

/**
 * All available metrics configuration
 * Add new metrics here to make them available to the LangFlow agent
 */
export const METRICS_CONFIG: MetricDefinition[] = [
  // ============================================
  // SYSTEM METRICS
  // ============================================
  {
    id: 'cpu_total',
    displayName: 'CPU Usage',
    query: `avg:system.cpu.user{host:${DEFAULT_HOST}} + avg:system.cpu.system{host:${DEFAULT_HOST}}`,
    unit: '%',
    category: 'system',
    keywords: ['cpu', 'processor', 'compute'],
    warning: 70,
    critical: 90,
    description: 'Total CPU usage combining user and system time. Healthy: <50%, Warning: 50-80%, Critical: >80%'
  },
  {
    id: 'cpu_user',
    displayName: 'CPU User Time',
    query: `avg:system.cpu.user{host:${DEFAULT_HOST}}`,
    unit: '%',
    category: 'system',
    keywords: ['cpu user', 'user cpu', 'application cpu'],
    description: 'CPU time spent running user processes and applications'
  },
  {
    id: 'cpu_system',
    displayName: 'CPU System Time',
    query: `avg:system.cpu.system{host:${DEFAULT_HOST}}`,
    unit: '%',
    category: 'system',
    keywords: ['cpu system', 'system cpu', 'kernel cpu'],
    description: 'CPU time spent in kernel/system operations'
  },
  {
    id: 'memory_used_percent',
    displayName: 'Memory Usage',
    query: `100 * (avg:system.mem.total{host:${DEFAULT_HOST}} - avg:system.mem.usable{host:${DEFAULT_HOST}}) / avg:system.mem.total{host:${DEFAULT_HOST}}`,
    unit: '%',
    category: 'system',
    keywords: ['memory', 'ram', 'mem'],
    warning: 80,
    critical: 95,
    description: 'Percentage of memory in use. Healthy: <80%, Warning: 80-95%, Critical: >95%'
  },
  {
    id: 'memory_usable',
    displayName: 'Available Memory',
    query: `avg:system.mem.usable{host:${DEFAULT_HOST}}`,
    unit: 'bytes',
    category: 'system',
    keywords: ['available memory', 'free memory', 'usable memory'],
    description: 'Amount of memory available for use'
  },
  {
    id: 'memory_total',
    displayName: 'Total Memory',
    query: `avg:system.mem.total{host:${DEFAULT_HOST}}`,
    unit: 'bytes',
    category: 'system',
    keywords: ['total memory', 'memory capacity'],
    description: 'Total installed memory capacity'
  },
  {
    id: 'load_1min',
    displayName: 'Load Average (1m)',
    query: `avg:system.load.1{host:${DEFAULT_HOST}}`,
    unit: '',
    category: 'system',
    keywords: ['load', 'load average', '1 minute load'],
    warning: 2,
    critical: 4,
    description: '1-minute load average. Healthy: <2, Warning: 2-4, Critical: >4'
  },
  {
    id: 'load_5min',
    displayName: 'Load Average (5m)',
    query: `avg:system.load.5{host:${DEFAULT_HOST}}`,
    unit: '',
    category: 'system',
    keywords: ['5 minute load', '5min load'],
    description: '5-minute load average'
  },
  {
    id: 'load_15min',
    displayName: 'Load Average (15m)',
    query: `avg:system.load.15{host:${DEFAULT_HOST}}`,
    unit: '',
    category: 'system',
    keywords: ['15 minute load', '15min load'],
    description: '15-minute load average'
  },
  {
    id: 'disk_used_percent',
    displayName: 'Disk Usage',
    query: `avg:system.disk.in_use{host:${DEFAULT_HOST}} * 100`,
    unit: '%',
    category: 'system',
    keywords: ['disk', 'storage', 'disk space'],
    warning: 80,
    critical: 95,
    description: 'Percentage of disk space in use. Healthy: <80%, Warning: 80-95%, Critical: >95%'
  },

  // ============================================
  // DOCKER CONTAINER METRICS
  // ============================================
  {
    id: 'docker_cpu_all',
    displayName: 'All Containers CPU',
    query: `avg:docker.cpu.usage{host:${DEFAULT_HOST}} by {container_name}`,
    unit: '%',
    category: 'docker',
    keywords: ['containers cpu', 'all containers', 'docker cpu'],
    description: 'CPU usage for all Docker containers grouped by container name'
  },
  {
    id: 'docker_mem_all',
    displayName: 'All Containers Memory',
    query: `avg:docker.mem.rss{host:${DEFAULT_HOST}} by {container_name}`,
    unit: 'bytes',
    category: 'docker',
    keywords: ['containers memory', 'docker memory', 'container ram'],
    description: 'Memory (RSS) usage for all Docker containers grouped by container name'
  },

  // ============================================
  // NETWORK METRICS (examples - uncomment if available)
  // ============================================
  // {
  //   id: 'network_bytes_sent',
  //   displayName: 'Network Bytes Sent',
  //   query: `avg:system.net.bytes_sent{host:${DEFAULT_HOST}}`,
  //   unit: 'bytes/s',
  //   category: 'network',
  //   keywords: ['network out', 'bytes sent', 'upload'],
  //   description: 'Network bytes sent per second'
  // },
  // {
  //   id: 'network_bytes_recv',
  //   displayName: 'Network Bytes Received',
  //   query: `avg:system.net.bytes_rcvd{host:${DEFAULT_HOST}}`,
  //   unit: 'bytes/s',
  //   category: 'network',
  //   keywords: ['network in', 'bytes received', 'download'],
  //   description: 'Network bytes received per second'
  // },
];

/**
 * Get metric by ID
 */
export function getMetricById(id: string): MetricDefinition | undefined {
  return METRICS_CONFIG.find(m => m.id === id);
}

/**
 * Get metrics by category
 */
export function getMetricsByCategory(category: string): MetricDefinition[] {
  return METRICS_CONFIG.filter(m => m.category === category);
}

/**
 * Find metrics matching keywords in natural language query
 */
export function findMetricsByKeywords(query: string): MetricDefinition[] {
  const lowerQuery = query.toLowerCase();
  const matches: Array<{ metric: MetricDefinition; score: number }> = [];

  for (const metric of METRICS_CONFIG) {
    let score = 0;

    // Check keyword matches
    for (const keyword of metric.keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    // Bonus for category match
    if (lowerQuery.includes(metric.category)) {
      score += 5;
    }

    // Bonus for display name match
    if (lowerQuery.includes(metric.displayName.toLowerCase())) {
      score += 8;
    }

    if (score > 0) {
      matches.push({ metric, score });
    }
  }

  // Sort by score (highest first) and return metrics
  return matches
    .sort((a, b) => b.score - a.score)
    .map(m => m.metric);
}

/**
 * Get all system overview metrics (for dashboard)
 */
export function getSystemOverviewMetrics(): MetricDefinition[] {
  return METRICS_CONFIG.filter(m =>
    ['cpu_total', 'memory_used_percent', 'load_1min', 'disk_used_percent'].includes(m.id)
  );
}

/**
 * Build a container-specific query
 */
export function getContainerMetricQuery(containerName: string, metricType: 'cpu' | 'memory'): string {
  if (metricType === 'cpu') {
    return `avg:docker.cpu.usage{container_name:${containerName}}`;
  } else {
    return `avg:docker.mem.rss{container_name:${containerName}}`;
  }
}

/**
 * Export configuration as JSON for LangFlow
 */
export function getMetricsConfigForAgent() {
  return {
    host: DEFAULT_HOST,
    metrics: METRICS_CONFIG.map(m => ({
      id: m.id,
      displayName: m.displayName,
      query: m.query,
      unit: m.unit,
      category: m.category,
      keywords: m.keywords,
      thresholds: {
        warning: m.warning,
        critical: m.critical
      },
      description: m.description
    })),
    categories: {
      system: getMetricsByCategory('system').map(m => m.id),
      docker: getMetricsByCategory('docker').map(m => m.id),
      network: getMetricsByCategory('network').map(m => m.id)
    }
  };
}
