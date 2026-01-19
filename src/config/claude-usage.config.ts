/**
 * Claude Usage Tracking Configuration
 *
 * Constants for plan limits, thresholds, pricing, and display settings.
 */

import { UsageStatus } from '../types/claude-usage';

export const CLAUDE_USAGE_CONFIG = {
  // Plan token limits (approximate per 5-hour window)
  planLimits: {
    free: 10000,
    pro: 44000,
    max5: 88000,
    max20: 220000,
  },

  // Status thresholds (percentage)
  thresholds: {
    warning: 70,
    critical: 90,
  },

  // Pricing per 1M tokens (Jan 2025)
  pricing: {
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
    'claude-4-opus': { input: 15.00, output: 75.00 },
    'claude-4-sonnet': { input: 3.00, output: 15.00 },
  },

  // Refresh intervals in milliseconds
  refreshInterval: {
    claudeCode: 300000,   // 5 minutes
    apiCredits: 3600000,  // 1 hour
  },

  // Model display colors (for progress bars)
  modelColors: {
    opus: '#8b5cf6',    // Purple
    sonnet: '#6366f1',  // Indigo
    haiku: '#06b6d4',   // Cyan
  },

  // Plan display names
  planNames: {
    free: 'Free',
    pro: 'Pro',
    max5: 'Max 5',
    max20: 'Max 20',
  },
} as const;

/**
 * Get usage status from percentage
 */
export function getUsageStatus(percentage: number): UsageStatus {
  if (percentage >= CLAUDE_USAGE_CONFIG.thresholds.critical) return 'critical';
  if (percentage >= CLAUDE_USAGE_CONFIG.thresholds.warning) return 'warning';
  return 'normal';
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format large token numbers
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}
