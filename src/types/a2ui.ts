/**
 * A2UI - Agent to UI Specification
 * 
 * Declarative component definitions that agents emit.
 * The UI runtime interprets these and renders appropriate components.
 */

// Priority levels for component ordering
export type Priority = 'critical' | 'high' | 'medium' | 'low';

// Supported component types
export type ComponentType = 
  | 'metric_card'
  | 'time_series_chart'
  | 'data_table'
  | 'alert_list'
  | 'status_indicator'
  | 'progress_bar';

// Status indicators for metrics
export type MetricStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

// Base component definition
export interface A2UIComponentBase {
  id: string;
  component: ComponentType;
  source: string;  // Which agent/tool provided this
  priority: Priority;
  timestamp: string;
}

// Metric Card - displays a single value with context
export interface MetricCardComponent extends A2UIComponentBase {
  component: 'metric_card';
  props: {
    title: string;
    value: number | string;
    unit?: string;
    change?: {
      value: number;
      direction: 'up' | 'down' | 'flat';
      period: string;  // e.g., "vs 1h ago"
    };
    status: MetricStatus;
    description?: string;
    thresholds?: {
      warning?: number;
      critical?: number;
    };
  };
}

// Time Series Chart - displays data over time
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesChartComponent extends A2UIComponentBase {
  component: 'time_series_chart';
  props: {
    title: string;
    series: {
      name: string;
      data: TimeSeriesPoint[];
      color?: string;
    }[];
    yAxisLabel?: string;
    timeRange: string;  // e.g., "1h", "24h"
    status?: MetricStatus;
  };
}

// Data Table - displays tabular data
export interface DataTableComponent extends A2UIComponentBase {
  component: 'data_table';
  props: {
    title: string;
    columns: {
      key: string;
      label: string;
      type?: 'string' | 'number' | 'status' | 'timestamp';
    }[];
    rows: Record<string, unknown>[];
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  };
}

// Alert List - displays active alerts/incidents
export interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  source?: string;
}

export interface AlertListComponent extends A2UIComponentBase {
  component: 'alert_list';
  props: {
    title: string;
    alerts: AlertItem[];
  };
}

// Status Indicator - simple status display
export interface StatusIndicatorComponent extends A2UIComponentBase {
  component: 'status_indicator';
  props: {
    title: string;
    status: MetricStatus;
    message: string;
  };
}

// Progress Bar - shows completion or utilization
export interface ProgressBarComponent extends A2UIComponentBase {
  component: 'progress_bar';
  props: {
    title: string;
    value: number;  // 0-100
    max?: number;
    label?: string;
    status?: MetricStatus;
  };
}

// Union type for all components
export type A2UIComponent = 
  | MetricCardComponent
  | TimeSeriesChartComponent
  | DataTableComponent
  | AlertListComponent
  | StatusIndicatorComponent
  | ProgressBarComponent;

// Dashboard state
export interface DashboardState {
  components: A2UIComponent[];
  lastUpdated: string;
  agentMessage?: string;
}

// Priority weight mapping for sorting
export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Sort components by priority
export function sortByPriority(components: A2UIComponent[]): A2UIComponent[] {
  return [...components].sort((a, b) => {
    const weightA = PRIORITY_WEIGHTS[a.priority];
    const weightB = PRIORITY_WEIGHTS[b.priority];
    if (weightA !== weightB) return weightA - weightB;
    // Secondary sort by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

// Helper to determine status from value and thresholds
export function getStatusFromThresholds(
  value: number,
  thresholds?: { warning?: number; critical?: number },
  higherIsBetter = false
): MetricStatus {
  if (!thresholds) return 'healthy';
  
  const { warning, critical } = thresholds;
  
  if (higherIsBetter) {
    if (critical !== undefined && value <= critical) return 'critical';
    if (warning !== undefined && value <= warning) return 'warning';
    return 'healthy';
  } else {
    if (critical !== undefined && value >= critical) return 'critical';
    if (warning !== undefined && value >= warning) return 'warning';
    return 'healthy';
  }
}
