/**
 * Claude Usage Tracking Types
 *
 * Type definitions for tracking Claude Code subscription usage
 * and API credits consumption.
 */
export type ClaudePlanTier = 'free' | 'pro' | 'max5' | 'max20';
export type UsageStatus = 'normal' | 'warning' | 'critical';
export interface FiveHourWindow {
    used: number;
    limit: number;
    percentage: number;
    resetsAt: string;
    resetsIn: string;
}
export interface UsageStats {
    tokens: number;
    estimatedCost: number;
    sessions: number;
}
export interface ModelUsage {
    model: 'opus' | 'sonnet' | 'haiku';
    tokens: number;
    cost: number;
    percentage: number;
}
export interface ClaudeCodeUsage {
    plan: ClaudePlanTier;
    fiveHourWindow: FiveHourWindow;
    today: UsageStats;
    monthToDate: UsageStats;
    modelBreakdown: ModelUsage[];
    lastUpdated: string;
    dataSource: 'ccusage' | 'local-files' | 'manual';
}
export interface ApiCreditsUsage {
    balance: number;
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
        date: string;
    };
    modelBreakdown: Array<{
        model: string;
        spend: number;
        percentage: number;
    }>;
    lastUpdated: string;
    dataSource: 'admin-api' | 'manual';
    hasAdminApi: boolean;
}
export interface ClaudeUsageCardProps {
    claudeCode: ClaudeCodeUsage | null;
    apiCredits: ApiCreditsUsage | null;
    showApiSection?: boolean;
    isLoading?: boolean;
    onRefresh?: () => void;
}
