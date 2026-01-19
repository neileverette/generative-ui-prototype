/**
 * Claude Usage Tracking Types
 *
 * Type definitions for tracking Claude Code subscription usage
 * and API credits consumption.
 */

// Plan tiers for Claude Code subscription
export type ClaudePlanTier = 'free' | 'pro' | 'max5' | 'max20';

// Usage status derived from percentage thresholds
export type UsageStatus = 'normal' | 'warning' | 'critical';

// Five-hour rolling window usage tracking
export interface FiveHourWindow {
  used: number;        // tokens used in current window
  limit: number;       // estimated limit for plan
  percentage: number;  // 0-100
  resetsAt: string;    // ISO timestamp when window resets
  resetsIn: string;    // human readable "2h 14m"
}

// Daily or month-to-date usage statistics
export interface UsageStats {
  tokens: number;
  estimatedCost: number;
  sessions: number;
}

// Per-model usage breakdown
export interface ModelUsage {
  model: 'opus' | 'sonnet' | 'haiku';
  tokens: number;
  cost: number;
  percentage: number;
}

// Claude Code subscription usage data
export interface ClaudeCodeUsage {
  plan: ClaudePlanTier;
  fiveHourWindow: FiveHourWindow;
  today: UsageStats;
  monthToDate: UsageStats;
  modelBreakdown: ModelUsage[];
  lastUpdated: string;
  dataSource: 'ccusage' | 'local-files' | 'manual';
}

// Token usage from Admin API
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// API token usage data from Admin API
export interface ApiTokenUsage {
  today: TokenUsage;
  monthToDate: TokenUsage;
  modelBreakdown: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    percentage: number;
  }>;
  lastUpdated: string;
  hasAdminApi: boolean;
}

// API Credits usage data (external API calls)
export interface ApiCreditsUsage {
  balance: number;           // current credit balance
  thisMonth: {
    spend: number;
    startDate: string;
  };
  burnRate: {
    daily: number;
    monthly: number;
  };
  runway: {
    days: number;
    date: string;            // projected depletion date
  };
  modelBreakdown: Array<{
    model: string;
    spend: number;
    percentage: number;
  }>;
  // Token usage from Admin API (optional - requires Admin API key)
  tokenUsage?: ApiTokenUsage;
  lastUpdated: string;
  dataSource: 'admin-api' | 'manual';
  hasAdminApi: boolean;
}

// Component props for ClaudeUsageCard
export interface ClaudeUsageCardProps {
  claudeCode: ClaudeCodeUsage | null;
  apiCredits: ApiCreditsUsage | null;
  showApiSection?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
}
