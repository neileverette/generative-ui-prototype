/**
 * A2UI - Agent to UI Specification
 *
 * Declarative component definitions that agents emit.
 * The UI runtime interprets these and renders appropriate components.
 */

import { ClaudeCodeUsage, ApiCreditsUsage, ApiTokenUsage } from './claude-usage';

// Priority levels for component ordering
export type Priority = 'critical' | 'high' | 'medium' | 'low';

// Supported component types
export type ComponentType =
  | 'metric_card'
  | 'card_group'
  | 'data_table'
  | 'alert_list'
  | 'status_indicator'
  | 'progress_bar'
  | 'ecr_summary'
  | 'claude_usage'
  | 'anthropic_usage';

// Status indicators for metrics
export type MetricStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

// Base component definition
export interface A2UIComponentBase {
  id: string;
  component: ComponentType;
  source: string;  // Which agent/tool provided this
  priority: Priority;
  timestamp: string;
  columnSpan?: number;  // Optional: span multiple columns in grid (1, 2, 3, etc.)
}

// Metric Card - displays a single value with context
export interface MetricCardComponent extends A2UIComponentBase {
  component: 'metric_card';
  props: {
    title: string;
    value: number | string;
    unit?: string;
    size?: 'compact' | 'default' | 'large' | 'xl';  // Size of the value display
    change?: {
      value: number;
      direction: 'up' | 'down' | 'flat';
      period: string;  // e.g., "vs 1h ago"
    };
    status: MetricStatus;
    description?: string;
    interpretation?: string;  // AI-generated explanation of the metric
    actionableInsights?: string[];  // AI-generated recommendations
    insightsLoading?: boolean;  // Show skeleton loader while fetching insights
    insightsStale?: boolean;  // Show shimmer overlay to indicate cached data is being refreshed
    metadata?: string;  // Additional small text metadata (e.g., "4 executions in last 24h")
    thresholds?: {
      warning?: number;
      critical?: number;
    };
  };
}

// Card Group - clusters related metric cards together
export interface CardGroupComponent extends A2UIComponentBase {
  component: 'card_group';
  props: {
    title: string;
    subtitle?: string;  // Optional subtitle text (smaller, normal weight, displayed after title)
    icon?: string;  // Optional icon name
    insight?: string;  // Optional prominent insight text (displayed before description)
    insightsLoading?: boolean;  // Show skeleton loader while fetching insights
    insightsStale?: boolean;  // Show shimmer overlay to indicate cached data is being refreshed
    description?: string;  // Optional insight/description text
    metrics: Array<{
      label: string;
      value: number | string;
      unit?: string;
      status?: MetricStatus;
      trend?: {
        direction: 'up' | 'down' | 'flat';
        value?: number;
      };
    }>;
    status?: MetricStatus;  // Overall group status
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
    footer?: {
      text: string;
      link?: string;
    };
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

// ECR Summary - displays ECR repository overview
export interface ECRImage {
  tags: string[];
  pushed: string;
  size: string;
}

export interface ECRRepository {
  name: string;
  uri: string;
  created: string;
  totalImages: number;
  recentImages: ECRImage[];
}

export interface ECRSummaryComponent extends A2UIComponentBase {
  component: 'ecr_summary';
  props: {
    repositoryCount: number;
    repositories: ECRRepository[];
    observations: string[];
    suggestion?: string;
  };
}

// Claude Usage - displays Claude Code and API credits usage
export interface ClaudeUsageComponent extends A2UIComponentBase {
  component: 'claude_usage';
  props: {
    claudeCode: ClaudeCodeUsage | null;
    apiCredits: ApiCreditsUsage | null;
    showApiSection?: boolean;
  };
}

// Anthropic Usage - displays Anthropic API token usage from Admin API
export interface AnthropicUsageComponent extends A2UIComponentBase {
  component: 'anthropic_usage';
  props: {
    tokenUsage?: ApiTokenUsage | null;
  };
}

// Union type for all components
export type A2UIComponent =
  | MetricCardComponent
  | CardGroupComponent
  | DataTableComponent
  | AlertListComponent
  | StatusIndicatorComponent
  | ProgressBarComponent
  | ECRSummaryComponent
  | ClaudeUsageComponent
  | AnthropicUsageComponent;

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
