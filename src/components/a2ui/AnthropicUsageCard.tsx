/**
 * Anthropic API Usage Card
 *
 * Displays API token usage from the Anthropic Admin API.
 * Shows today's usage, month-to-date totals, and model breakdown.
 */

import { useState, useEffect } from 'react';
import { ApiTokenUsage } from '../../types/claude-usage';
import { formatTokens } from '../../config/claude-usage.config';
import { mcpClient } from '../../services/mcp-client';
import { Activity, RefreshCw, Info, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

// Model colors for breakdown bars
const MODEL_COLORS: Record<string, string> = {
  opus: 'bg-purple-500',
  sonnet: 'bg-indigo-500',
  haiku: 'bg-cyan-500',
  Opus: 'bg-purple-500',
  Sonnet: 'bg-indigo-500',
  Haiku: 'bg-cyan-500',
};

// Skeleton loader for loading states
function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div className="h-8 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
    </div>
  );
}

// Stat box component
function StatBox({
  label,
  value,
  subtext,
  icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-1 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-text-muted">{icon}</span>}
        <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-lg font-semibold text-text-primary">{value}</div>
      {subtext && <div className="text-xs text-text-muted mt-0.5">{subtext}</div>}
    </div>
  );
}

// Model breakdown bar
function ModelBar({
  model,
  tokens,
  percentage,
}: {
  model: string;
  tokens: number;
  percentage: number;
}) {
  const barColor = MODEL_COLORS[model] || 'bg-gray-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary font-medium">{model}</span>
        <span className="text-text-muted">{formatTokens(tokens)} tokens</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-right text-xs text-text-muted">{percentage.toFixed(1)}%</div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface AnthropicUsageCardProps {
  className?: string;
}

export function AnthropicUsageCard({ className }: AnthropicUsageCardProps) {
  const [data, setData] = useState<ApiTokenUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch token data from Admin API
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await mcpClient.getApiTokens();
      if (response.hasAdminApi) {
        setData(response);
      } else {
        setError('Admin API not configured');
      }
    } catch (err) {
      console.error('[AnthropicUsageCard] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    fetchData(true);
  };

  // Fetch once on mount, manual refresh only
  useEffect(() => {
    fetchData();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm overflow-hidden ${className || ''}`}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-accent-success" />
            <span className="font-semibold text-text-secondary">Anthropic API Usage</span>
          </div>
          <SkeletonLoader />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <SkeletonLoader className="h-20" />
            <SkeletonLoader className="h-20" />
          </div>
        </div>
      </div>
    );
  }

  // Error state (no Admin API configured)
  if (error || !data) {
    return (
      <div
        className={`bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm overflow-hidden ${className || ''}`}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-text-muted" />
            <span className="font-semibold text-text-secondary">Anthropic API Usage</span>
          </div>
          <div className="text-center py-6 text-text-muted">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium mb-1">Admin API Not Configured</p>
            <p className="text-xs">
              Set ANTHROPIC_ADMIN_API_KEY environment variable to enable API usage tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm overflow-hidden card-hover ${className || ''}`}
    >
      {/* Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent-success" />
            <span className="font-semibold text-text-primary">Anthropic API Usage</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <span className="px-2 py-1 text-xs font-medium bg-accent-success/10 text-accent-success rounded-full">
            Admin API
          </span>
        </div>
      </div>

      {/* Today Section */}
      <div className="px-4 pb-4">
        <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Today</div>
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="Input"
            value={formatTokens(data.today.inputTokens)}
            subtext="tokens"
            icon={<ArrowDownToLine className="w-3 h-3" />}
          />
          <StatBox
            label="Output"
            value={formatTokens(data.today.outputTokens)}
            subtext="tokens"
            icon={<ArrowUpFromLine className="w-3 h-3" />}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* This Month Section */}
      <div className="p-4">
        <div className="text-xs text-text-muted uppercase tracking-wide mb-2">This Month</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatBox
            label="Input"
            value={formatTokens(data.monthToDate.inputTokens)}
            subtext="tokens"
            icon={<ArrowDownToLine className="w-3 h-3" />}
          />
          <StatBox
            label="Output"
            value={formatTokens(data.monthToDate.outputTokens)}
            subtext="tokens"
            icon={<ArrowUpFromLine className="w-3 h-3" />}
          />
        </div>
        <div className="bg-surface-1 rounded-lg p-3 text-center">
          <div className="text-xs text-text-muted mb-1">Total</div>
          <div className="text-xl font-bold text-text-primary">
            {formatTokens(data.monthToDate.totalTokens)}
          </div>
          <div className="text-xs text-text-muted">tokens</div>
        </div>
      </div>

      {/* Model Breakdown */}
      {data.modelBreakdown.length > 0 && (
        <>
          <div className="border-t border-gray-200" />
          <div className="p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-3">
              By Model (MTD)
            </div>
            <div className="space-y-3">
              {data.modelBreakdown.map((model) => (
                <ModelBar
                  key={model.model}
                  model={model.model}
                  tokens={model.totalTokens}
                  percentage={model.percentage}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="px-4 pb-4">
        <div className="pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-text-muted">
          <Info className="w-3 h-3" />
          <span>Live from Anthropic Admin API</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOCK DATA FOR TESTING
// =============================================================================

export const MOCK_ANTHROPIC_USAGE: ApiTokenUsage = {
  today: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
  monthToDate: {
    inputTokens: 130397,
    outputTokens: 5149,
    totalTokens: 135546,
  },
  modelBreakdown: [
    {
      model: 'Sonnet',
      inputTokens: 125000,
      outputTokens: 5622,
      totalTokens: 130622,
      percentage: 96.37,
    },
    {
      model: 'Opus',
      inputTokens: 4500,
      outputTokens: 424,
      totalTokens: 4924,
      percentage: 3.63,
    },
  ],
  lastUpdated: new Date().toISOString(),
  hasAdminApi: true,
};
