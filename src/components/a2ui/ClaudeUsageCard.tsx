import { useState, useEffect } from 'react';
import { ClaudeUsageComponent } from '../../types/a2ui';
import {
  ClaudeCodeUsage,
  ApiCreditsUsage,
  ApiTokenUsage,
  UsageStatus,
} from '../../types/claude-usage';
import {
  CLAUDE_USAGE_CONFIG,
  getUsageStatus,
  formatCurrency,
  formatTokens,
} from '../../config/claude-usage.config';
import { mcpClient } from '../../services/mcp-client';
import {
  Clock,
  Zap,
  CreditCard,
  TrendingDown,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { ClaudePlanTier } from '../../types/claude-usage';

interface ClaudeUsageCardComponentProps {
  component: ClaudeUsageComponent;
  className?: string;
}

// Status-based colors for progress bars
const STATUS_COLORS: Record<UsageStatus, { bar: string; text: string }> = {
  normal: { bar: 'bg-accent-primary', text: 'text-accent-primary' },
  warning: { bar: 'bg-accent-warning', text: 'text-accent-warning' },
  critical: { bar: 'bg-accent-danger', text: 'text-accent-danger' },
};

// Model colors for breakdown bars
const MODEL_COLORS: Record<string, string> = {
  opus: 'bg-purple-500',
  sonnet: 'bg-indigo-500',
  haiku: 'bg-cyan-500',
  'claude-3-opus': 'bg-purple-500',
  'claude-3-sonnet': 'bg-indigo-500',
  'claude-3-haiku': 'bg-cyan-500',
  'claude-3.5-sonnet': 'bg-indigo-500',
  'claude-4-opus': 'bg-purple-500',
  'claude-4-sonnet': 'bg-indigo-500',
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

// Progress bar component
function UsageProgressBar({
  percentage,
  status,
  showPercentage = true,
}: {
  percentage: number;
  status: UsageStatus;
  showPercentage?: boolean;
}) {
  const colors = STATUS_COLORS[status];
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="w-full">
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.bar} transition-all duration-500 ${
            status === 'critical' ? 'animate-pulse' : ''
          }`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      {showPercentage && (
        <div className={`text-right text-sm font-medium mt-1 ${colors.text}`}>
          {Math.round(clampedPercentage)}%
        </div>
      )}
    </div>
  );
}

// Small stat box
function StatBox({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="bg-surface-1 rounded-lg p-3 text-center">
      <div className="text-xs text-text-muted uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold text-text-primary">{value}</div>
      {subtext && (
        <div className="text-xs text-text-muted mt-0.5">{subtext}</div>
      )}
    </div>
  );
}

// Model breakdown bar - supports both token counts and dollar amounts
function ModelBar({
  model,
  value,
  percentage,
  displayType = 'tokens',
}: {
  model: string;
  value: number;
  percentage: number;
  displayType?: 'tokens' | 'currency';
}) {
  const modelName = model.replace('claude-3-', '').replace('claude-4-', '');
  const displayName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  const barColor = MODEL_COLORS[model] || MODEL_COLORS[modelName] || 'bg-gray-400';
  const formattedValue = displayType === 'currency' ? formatCurrency(value) : formatTokens(value);

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-xs text-text-secondary capitalize">
        {displayName}
      </div>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-16 text-xs text-text-secondary text-right">
        {formattedValue}
      </div>
    </div>
  );
}

// Plan selector dropdown
function PlanSelector({
  currentPlan,
  onPlanChange,
}: {
  currentPlan: ClaudePlanTier;
  onPlanChange: (plan: ClaudePlanTier) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const plans: { value: ClaudePlanTier; label: string }[] = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'max5', label: 'Max (5x)' },
    { value: 'max20', label: 'Max (20x)' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-accent-primary/10 text-accent-primary rounded-full hover:bg-accent-primary/20 transition-colors"
      >
        {CLAUDE_USAGE_CONFIG.planNames[currentPlan]}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[100px]">
            {plans.map((plan) => (
              <button
                key={plan.value}
                onClick={() => {
                  onPlanChange(plan.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                  plan.value === currentPlan ? 'text-accent-primary font-medium' : 'text-text-secondary'
                }`}
              >
                {plan.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Claude Code Section
function ClaudeCodeSection({
  data,
  isLoading,
  isRefreshing,
  onRefresh,
  selectedPlan,
  onPlanChange,
}: {
  data: ClaudeCodeUsage | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  selectedPlan: ClaudePlanTier;
  onPlanChange: (plan: ClaudePlanTier) => void;
}) {
  if (isLoading || !data) {
    return (
      <div className="p-4">
        <SkeletonLoader />
        <div className="grid grid-cols-3 gap-3 mt-4">
          <SkeletonLoader className="h-16" />
          <SkeletonLoader className="h-16" />
          <SkeletonLoader className="h-16" />
        </div>
      </div>
    );
  }

  const status = getUsageStatus(data.fiveHourWindow.percentage);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent-primary" />
          <span className="font-semibold text-text-primary">Claude Code</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <PlanSelector currentPlan={selectedPlan} onPlanChange={onPlanChange} />
      </div>

      {/* 5-Hour Window */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">5-Hour Window</span>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            <span>Resets in {data.fiveHourWindow.resetsIn}</span>
          </div>
        </div>
        <UsageProgressBar percentage={data.fiveHourWindow.percentage} status={status} />
        <div className="text-xs text-text-muted mt-1">
          {formatTokens(data.fiveHourWindow.used)} / {formatTokens(data.fiveHourWindow.limit)} tokens
        </div>
      </div>

      {/* Warning banner for critical state */}
      {status === 'critical' && (
        <div className="flex items-center gap-2 p-2 mb-4 bg-accent-danger/10 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-accent-danger" />
          <span className="text-sm text-accent-danger font-medium">
            Approaching usage limit
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatBox
          label="Today"
          value={formatTokens(data.today.tokens)}
          subtext="tokens"
        />
        <StatBox
          label="MTD"
          value={formatTokens(data.monthToDate.tokens)}
          subtext="tokens"
        />
        <StatBox
          label="Sessions"
          value={data.today.sessions.toString()}
          subtext="today"
        />
      </div>

      {/* Model Breakdown */}
      {data.modelBreakdown.length > 0 && (
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wide mb-2">
            Model Usage Today
          </div>
          <div className="space-y-2">
            {data.modelBreakdown.map((model) => (
              <ModelBar
                key={model.model}
                model={model.model}
                value={model.tokens}
                percentage={model.percentage}
                displayType="tokens"
              />
            ))}
          </div>
        </div>
      )}

      {/* Data source */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-text-muted">
        <Info className="w-3 h-3" />
        <span>Data from {data.dataSource}</span>
      </div>
    </div>
  );
}

// Inline balance entry form
function BalanceEntryForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (balance: number) => void;
  isSubmitting: boolean;
}) {
  const [balance, setBalance] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(balance);
    if (!isNaN(value) && value >= 0) {
      onSubmit(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="127.45"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none"
            disabled={isSubmitting}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !balance}
          className="px-4 py-2 text-sm font-medium text-white bg-accent-primary rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
      <p className="text-xs text-text-muted mt-2">
        Enter your current API credit balance from console.anthropic.com
      </p>
    </form>
  );
}

// API Token Usage Section - displays data from Admin API
function ApiTokenSection({
  data,
  isLoading,
  isRefreshing,
  onRefresh,
}: {
  data: ApiTokenUsage | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}) {
  if (isLoading || !data) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-5 h-5 text-accent-success" />
          <span className="font-semibold text-text-secondary">API Usage</span>
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent-success" />
          <span className="font-semibold text-text-primary">API Usage</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <span className="px-2 py-1 text-xs font-medium bg-accent-success/10 text-accent-success rounded-full">
          Admin API
        </span>
      </div>

      {/* Token Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatBox
          label="Today"
          value={formatTokens(data.today.totalTokens)}
          subtext="tokens"
        />
        <StatBox
          label="This Month"
          value={formatTokens(data.monthToDate.totalTokens)}
          subtext="tokens"
        />
      </div>

      {/* Input/Output breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-surface-1 rounded-lg p-3">
          <div className="text-xs text-text-muted mb-1">Today Input</div>
          <div className="text-sm font-medium text-text-primary">
            {formatTokens(data.today.inputTokens)}
          </div>
        </div>
        <div className="bg-surface-1 rounded-lg p-3">
          <div className="text-xs text-text-muted mb-1">Today Output</div>
          <div className="text-sm font-medium text-text-primary">
            {formatTokens(data.today.outputTokens)}
          </div>
        </div>
      </div>

      {/* Model Breakdown */}
      {data.modelBreakdown.length > 0 && (
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wide mb-2">
            By Model (MTD)
          </div>
          <div className="space-y-2">
            {data.modelBreakdown.map((model) => (
              <ModelBar
                key={model.model}
                model={model.model}
                value={model.totalTokens}
                percentage={model.percentage}
                displayType="tokens"
              />
            ))}
          </div>
        </div>
      )}

      {/* Data source */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-text-muted">
        <Info className="w-3 h-3" />
        <span>Live from Anthropic Admin API</span>
      </div>
    </div>
  );
}

// API Credits Section (balance-based)
function ApiCreditsSection({
  data,
  isLoading,
  onUpdateBalance,
  isUpdating,
}: {
  data: ApiCreditsUsage | null;
  isLoading?: boolean;
  onUpdateBalance?: (balance: number) => void;
  isUpdating?: boolean;
}) {
  const [showEntry, setShowEntry] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4">
        <SkeletonLoader />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-5 h-5 text-text-muted" />
          <span className="font-semibold text-text-secondary">API Credits</span>
        </div>
        <div className="text-center py-4 text-text-muted">
          <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No API credits data yet</p>
        </div>
        {onUpdateBalance && (
          <BalanceEntryForm onSubmit={onUpdateBalance} isSubmitting={isUpdating || false} />
        )}
      </div>
    );
  }

  // Calculate balance percentage (assume $500 max for visualization)
  const maxBalance = Math.max(data.balance + data.thisMonth.spend, 500);
  const balancePercentage = (data.balance / maxBalance) * 100;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent-success" />
          <span className="font-semibold text-text-primary">API Credits</span>
        </div>
        {!data.hasAdminApi && (
          <span className="px-2 py-1 text-xs font-medium bg-surface-2 text-text-muted rounded-full">
            Manual
          </span>
        )}
      </div>

      {/* Balance and Runway */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-2xl font-bold text-text-primary">
            {formatCurrency(data.balance)}
          </span>
          <span className="text-sm text-text-muted ml-2">remaining</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-medium text-text-secondary">
            ~{data.runway.days} days
          </span>
          <span className="text-xs text-text-muted block">runway</span>
        </div>
      </div>

      {/* Balance bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-accent-success transition-all duration-300"
          style={{ width: `${balancePercentage}%` }}
        />
      </div>

      {/* Spend stats */}
      <div className="flex items-center justify-between text-sm mb-4">
        <div>
          <span className="text-text-muted">This Month:</span>{' '}
          <span className="font-medium text-text-primary">
            {formatCurrency(data.thisMonth.spend)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <TrendingDown className="w-3 h-3" />
          <span>Burn: {formatCurrency(data.burnRate.daily)}/day</span>
        </div>
      </div>

      {/* Model Breakdown */}
      {data.modelBreakdown.length > 0 && (
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wide mb-2">
            By Model
          </div>
          <div className="space-y-2">
            {data.modelBreakdown.map((model) => (
              <ModelBar
                key={model.model}
                model={model.model}
                value={model.spend}
                percentage={model.percentage}
                displayType="currency"
              />
            ))}
          </div>
        </div>
      )}

      {/* Data source and update */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>
            {data.hasAdminApi ? 'Live from Admin API' : 'Manual entry'}
          </span>
        </div>
        {onUpdateBalance && !data.hasAdminApi && (
          <button
            onClick={() => setShowEntry(!showEntry)}
            className="text-accent-primary hover:underline"
          >
            {showEntry ? 'Cancel' : 'Update'}
          </button>
        )}
      </div>

      {/* Inline update form */}
      {showEntry && onUpdateBalance && (
        <div className="mt-3">
          <BalanceEntryForm
            onSubmit={(balance) => {
              onUpdateBalance(balance);
              setShowEntry(false);
            }}
            isSubmitting={isUpdating || false}
          />
        </div>
      )}
    </div>
  );
}

// localStorage key for plan selection
const PLAN_STORAGE_KEY = 'claude-usage-plan';

// Get saved plan from localStorage
function getSavedPlan(): ClaudePlanTier {
  if (typeof window === 'undefined') return 'pro';
  const saved = localStorage.getItem(PLAN_STORAGE_KEY);
  if (saved && ['free', 'pro', 'max5', 'max20'].includes(saved)) {
    return saved as ClaudePlanTier;
  }
  return 'pro';
}

// Main component
export function ClaudeUsageCard({
  component,
  className,
}: ClaudeUsageCardComponentProps) {
  const { props } = component;
  const { showApiSection = true } = props;

  // State for Claude Code data
  const [claudeCode, setClaudeCode] = useState<ClaudeCodeUsage | null>(props.claudeCode);
  const [isLoadingCode, setIsLoadingCode] = useState(!props.claudeCode);
  const [isRefreshingCode, setIsRefreshingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // State for plan selection (persisted in localStorage)
  const [selectedPlan, setSelectedPlan] = useState<ClaudePlanTier>(getSavedPlan);

  // State for API Credits data
  const [apiCredits, setApiCredits] = useState<ApiCreditsUsage | null>(props.apiCredits);
  const [isLoadingCredits, setIsLoadingCredits] = useState(!props.apiCredits && showApiSection);
  const [isUpdatingCredits, setIsUpdatingCredits] = useState(false);

  // State for API Token data (from Admin API)
  const [apiTokens, setApiTokens] = useState<ApiTokenUsage | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [hasAdminApi, setHasAdminApi] = useState(false);

  // Handle plan change
  const handlePlanChange = (plan: ClaudePlanTier) => {
    setSelectedPlan(plan);
    localStorage.setItem(PLAN_STORAGE_KEY, plan);
    // Update the claudeCode data with new plan limits
    if (claudeCode) {
      const newLimit = CLAUDE_USAGE_CONFIG.planLimits[plan];
      const newPercentage = Math.min(100, (claudeCode.fiveHourWindow.used / newLimit) * 100);
      setClaudeCode({
        ...claudeCode,
        plan,
        fiveHourWindow: {
          ...claudeCode.fiveHourWindow,
          limit: newLimit,
          percentage: parseFloat(newPercentage.toFixed(1)),
        },
      });
    }
  };

  // Fetch Claude Code usage data
  const fetchCodeData = async (isManualRefresh = false) => {
    if (props.claudeCode && !isManualRefresh) return;

    if (isManualRefresh) {
      setIsRefreshingCode(true);
    } else {
      setIsLoadingCode(true);
    }
    setCodeError(null);

    try {
      const usage = await mcpClient.getClaudeCodeUsage(undefined, selectedPlan);
      setClaudeCode(usage);
    } catch (err) {
      console.error('[ClaudeUsageCard] Error fetching code usage:', err);
      setCodeError(err instanceof Error ? err.message : 'Failed to load usage data');
      if (!isManualRefresh) {
        setClaudeCode(MOCK_CLAUDE_CODE_USAGE);
      }
    } finally {
      setIsLoadingCode(false);
      setIsRefreshingCode(false);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    fetchCodeData(true);
  };

  useEffect(() => {
    fetchCodeData();
    const interval = setInterval(() => fetchCodeData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [props.claudeCode, selectedPlan]);

  // Fetch API Tokens data (from Admin API)
  const fetchTokensData = async (isManualRefresh = false) => {
    if (!showApiSection) return;

    if (isManualRefresh) {
      setIsRefreshingTokens(true);
    } else {
      setIsLoadingTokens(true);
    }

    try {
      const response = await mcpClient.getApiTokens();
      console.log('[ClaudeUsageCard] API tokens response:', JSON.stringify(response));
      if (response.hasAdminApi) {
        console.log('[ClaudeUsageCard] Setting apiTokens, hasAdminApi=true');
        setApiTokens(response);
        setHasAdminApi(true);
      } else {
        console.log('[ClaudeUsageCard] No Admin API configured');
        setHasAdminApi(false);
      }
    } catch (err) {
      console.error('[ClaudeUsageCard] Error fetching API tokens:', err);
      setHasAdminApi(false);
    } finally {
      setIsLoadingTokens(false);
      setIsRefreshingTokens(false);
    }
  };

  // Handle token refresh
  const handleTokenRefresh = () => {
    fetchTokensData(true);
  };

  // Initial fetch of API tokens
  useEffect(() => {
    if (showApiSection) {
      fetchTokensData();
      // Refresh every 5 minutes
      const interval = setInterval(() => fetchTokensData(), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [showApiSection]);

  // Fetch API Credits data (fallback when Admin API not available)
  useEffect(() => {
    async function fetchCreditsData() {
      if (props.apiCredits || !showApiSection || hasAdminApi) return;

      setIsLoadingCredits(true);

      try {
        const credits = await mcpClient.getApiCredits();
        // Only set if configured (has balance data)
        if (credits.configured) {
          setApiCredits(credits);
        }
      } catch (err) {
        console.error('[ClaudeUsageCard] Error fetching API credits:', err);
        // Don't set error - just leave as null (shows entry form)
      } finally {
        setIsLoadingCredits(false);
      }
    }

    fetchCreditsData();
    // Refresh every hour for API credits
    const interval = setInterval(fetchCreditsData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [props.apiCredits, showApiSection, hasAdminApi]);

  // Handle balance update
  const handleUpdateBalance = async (balance: number) => {
    setIsUpdatingCredits(true);
    try {
      const result = await mcpClient.updateApiCredits(balance);
      if (result.data) {
        setApiCredits(result.data);
      }
    } catch (err) {
      console.error('[ClaudeUsageCard] Error updating balance:', err);
    } finally {
      setIsUpdatingCredits(false);
    }
  };

  const status = claudeCode
    ? getUsageStatus(claudeCode.fiveHourWindow.percentage)
    : 'normal';
  const isCritical = status === 'critical';

  return (
    <div
      className={`
        bg-white/70 backdrop-blur-sm rounded-xl border transition-all duration-300 shadow-sm overflow-hidden
        ${isCritical ? 'border-accent-danger/50 animate-pulse-critical' : 'border-white/50'}
        card-hover ${className || ''}
      `}
    >
      {/* Claude Code Section */}
      <ClaudeCodeSection
        data={claudeCode}
        isLoading={isLoadingCode}
        isRefreshing={isRefreshingCode}
        onRefresh={handleRefresh}
        selectedPlan={selectedPlan}
        onPlanChange={handlePlanChange}
      />

      {/* Error display */}
      {codeError && (
        <div className="px-4 pb-2 text-xs text-accent-warning">
          {codeError} - showing sample data
        </div>
      )}

      {/* API Section - show tokens if Admin API available, otherwise show credits */}
      {showApiSection && (
        <>
          <div className="border-t border-gray-200" />
          {hasAdminApi || isLoadingTokens ? (
            <ApiTokenSection
              data={apiTokens}
              isLoading={isLoadingTokens}
              isRefreshing={isRefreshingTokens}
              onRefresh={handleTokenRefresh}
            />
          ) : (
            <ApiCreditsSection
              data={apiCredits}
              isLoading={isLoadingCredits}
              onUpdateBalance={handleUpdateBalance}
              isUpdating={isUpdatingCredits}
            />
          )}
        </>
      )}
    </div>
  );
}

// Mock data for testing
export const MOCK_CLAUDE_CODE_USAGE: ClaudeCodeUsage = {
  plan: 'pro',
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
  modelBreakdown: [
    { model: 'opus', tokens: 120000, cost: 3.2, percentage: 76 },
    { model: 'sonnet', tokens: 30000, cost: 0.8, percentage: 19 },
    { model: 'haiku', tokens: 6000, cost: 0.2, percentage: 5 },
  ],
  lastUpdated: new Date().toISOString(),
  dataSource: 'ccusage',
};

export const MOCK_API_CREDITS: ApiCreditsUsage = {
  balance: 127.45,
  thisMonth: {
    spend: 52.3,
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  },
  burnRate: {
    daily: 1.74,
    monthly: 52.2,
  },
  runway: {
    days: 73,
    date: new Date(Date.now() + 73 * 24 * 60 * 60 * 1000).toISOString(),
  },
  modelBreakdown: [
    { model: 'claude-3-opus', spend: 28.4, percentage: 54 },
    { model: 'claude-3-sonnet', spend: 18.9, percentage: 36 },
    { model: 'claude-3-haiku', spend: 5.0, percentage: 10 },
  ],
  lastUpdated: new Date().toISOString(),
  dataSource: 'manual',
  hasAdminApi: false,
};
