import { useState, useEffect } from 'react';
import { ClaudeUsageComponent } from '../../types/a2ui';
import { ClaudeCodeUsage } from '../../types/claude-usage';
import { getUsageStatus } from '../../config/claude-usage.config';
import { mcpClient } from '../../services/mcp-client';
import { RefreshCw } from 'lucide-react';

interface ClaudeUsageCardComponentProps {
  component: ClaudeUsageComponent;
  className?: string;
}

// Main component - rebuilt to match wireframe
export function ClaudeUsageCard({
  component,
  className,
}: ClaudeUsageCardComponentProps) {
  const { props } = component;

  // State for Claude Code data
  const [claudeCode, setClaudeCode] = useState<ClaudeCodeUsage | null>(props.claudeCode);
  const [isLoading, setIsLoading] = useState(!props.claudeCode);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Claude Code usage data
  const fetchData = async (isManualRefresh = false) => {
    if (props.claudeCode && !isManualRefresh) return;

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const usage = await mcpClient.getClaudeCodeUsage(undefined, 'max5');
      setClaudeCode(usage);
    } catch (err) {
      console.error('[ClaudeUsageCard] Error fetching usage:', err);
      if (!isManualRefresh) {
        setClaudeCode(MOCK_CLAUDE_CODE_USAGE);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [props.claudeCode]);

  // Calculate values from real data
  const fiveHourPercentage = claudeCode?.fiveHourWindow.percentage ?? 0;
  const fiveHourRemaining = 100 - fiveHourPercentage;
  const resetsIn = claudeCode?.fiveHourWindow.resetsIn ?? '5h 0m';
  const status = claudeCode ? getUsageStatus(fiveHourPercentage) : 'normal';
  const showWarning = fiveHourPercentage > 70;

  // Fake weekly data (40%)
  const weeklyPercentage = 40;
  const weeklyRemaining = 60;

  if (isLoading) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm ${className || ''}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-24 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-3 bg-gray-200 rounded-full w-full mb-4"></div>
          <div className="h-3 bg-gray-200 rounded-full w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm ${className || ''}`}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold text-gray-900">Claude</h2>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Plan Info Section */}
      <div className="mb-4 space-y-0.5">
        <p className="text-gray-700">
          <span className="font-bold">Plan:</span> Claude Code Max (5x tier, based on $100/month)
        </p>
        <p className="text-gray-700">
          <span className="font-bold">Cost:</span> $100/m
        </p>
        <p className="text-gray-700">
          <span className="font-bold">Next bill:</span> [mo]/[day]
        </p>
      </div>

      {/* Warning Banner - shows when approaching limit */}
      {showWarning && (
        <p className="text-red-500 font-medium mb-4">
          Approaching usage limit
        </p>
      )}

      {/* 5-Hour Limit Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-900">5-hour limit</span>
          <span className="text-gray-600">Resets in {resetsIn}</span>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${fiveHourPercentage}%` }}
          />
        </div>

        {/* Usage Text */}
        <p className="text-right text-gray-600">
          {Math.round(fiveHourPercentage)}% used / {Math.round(fiveHourRemaining)}% remain
        </p>
      </div>

      {/* Weekly Limit Section (Fake Data) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-900">Weekly limit</span>
          <span className="text-gray-600">Resets in 4 days</span>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gray-400 rounded-full transition-all duration-300"
            style={{ width: `${weeklyPercentage}%` }}
          />
        </div>

        {/* Usage Text */}
        <p className="text-right text-gray-600">
          {weeklyPercentage}% used / {weeklyRemaining}% remain
        </p>
      </div>
    </div>
  );
}

// Mock data for testing
export const MOCK_CLAUDE_CODE_USAGE: ClaudeCodeUsage = {
  plan: 'max5',
  fiveHourWindow: {
    used: 34320,
    limit: 44000,
    percentage: 78,
    resetsAt: new Date(Date.now() + 2 * 60 * 60 * 1000 + 14 * 60 * 1000).toISOString(),
    resetsIn: '2h 14m',
  },
  today: {
    tokens: 156000,
    estimatedCost: 4.2,
    sessions: 12,
  },
  monthToDate: {
    tokens: 1850000,
    estimatedCost: 48.5,
    sessions: 89,
  },
  modelBreakdown: [],
  lastUpdated: new Date().toISOString(),
  dataSource: 'ccusage',
};
