import { useState, useEffect } from 'react';
import { ClaudeUsageComponent } from '../../types/a2ui';
import { ClaudeCodeUsage } from '../../types/claude-usage';
import { mcpClient } from '../../services/mcp-client';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ClaudeUsageCardComponentProps {
  component: ClaudeUsageComponent;
  className?: string;
}

interface PlanConfig {
  name: string;
  tier: string;
  cost: string;
  nextBillingDate: string;
}

export function ClaudeUsageCard({
  className,
}: ClaudeUsageCardComponentProps) {
  const [claudeCode, setClaudeCode] = useState<ClaudeCodeUsage | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [consoleUsage, setConsoleUsage] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      // Trigger immediate scrape
      console.log('[ClaudeUsageCard] Triggering manual refresh...');
      await mcpClient.triggerConsoleRefresh();

      // Wait a moment for scrape to complete and sync to EC2
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch fresh data
      await fetchData();
    } catch (err) {
      console.error('[ClaudeUsageCard] Error triggering refresh:', err);
      setError(err instanceof Error ? err.message : 'Failed to trigger refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch latest synced data from EC2
      const [usage, config, console] = await Promise.all([
        mcpClient.getClaudeCodeUsage(undefined, 'max5'),
        mcpClient.getClaudeConfig().catch(() => null),
        mcpClient.getConsoleUsage().catch(() => null),
      ]);

      setClaudeCode(usage);
      if (config?.plan) setPlanConfig(config.plan);
      if (console) setConsoleUsage(console);
    } catch (err) {
      console.error('[ClaudeUsageCard] Error fetching synced usage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data from EC2');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm ${className || ''}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-20 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
          <div className="h-3 bg-gray-200 rounded-full w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !claudeCode) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm ${className || ''}`}>
        <div className="flex items-center justify-between mb-4">
          <span className="widget-title">Claude</span>
        </div>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error || 'No synced usage data available'}</span>
        </div>
      </div>
    );
  }

  // MAGENTA = No API access, needs Console scraping
  // Data from JSONL files (real)
  const fiveHour = claudeCode.fiveHourWindow;

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="widget-title">Claude</span>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1 text-text-muted hover:text-accent-primary transition-colors disabled:opacity-50"
          title="Refresh Console usage data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Plan Info - from config file */}
      <div className="mb-4 space-y-0.5">
        <p className="text-gray-700">
          <span className="font-bold">Plan:</span>{' '}
          {planConfig ? (
            <span>{planConfig.name} ({planConfig.tier} tier, {planConfig.cost})</span>
          ) : (
            <span className="text-gray-400">Not configured</span>
          )}
        </p>
        <p className="text-gray-700">
          <span className="font-bold">Cost:</span>{' '}
          {planConfig ? planConfig.cost : <span className="text-gray-400">--</span>}
        </p>
        <p className="text-gray-700">
          <span className="font-bold">Next bill:</span>{' '}
          {planConfig ? (
            new Date(planConfig.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          ) : (
            <span className="text-gray-400">--</span>
          )}
        </p>
      </div>

      {/* Current Session - from Console Scraper */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-900">Current session</span>
          {consoleUsage ? (
            <span className="text-gray-600">Resets in {consoleUsage.currentSession.resetsIn}</span>
          ) : (
            <span className="text-gray-400">--</span>
          )}
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: consoleUsage ? `${consoleUsage.currentSession.percentageUsed}%` : '0%',
              backgroundColor: consoleUsage?.currentSession.percentageUsed > 80 ? '#ef4444' : '#3b82f6',
            }}
          />
        </div>
        <p className="text-right text-gray-600">
          {consoleUsage ? `${consoleUsage.currentSession.percentageUsed}% used` : 'No data'}
          {consoleUsage?.isStale && <span className="text-amber-600 ml-2">(stale)</span>}
        </p>
      </div>

      {/* Weekly Limits - from Console Scraper */}
      <div className="mb-6">
        <span className="font-bold text-gray-900 block mb-3">Weekly limits</span>

        {/* All Models */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-700">All models</span>
            {consoleUsage ? (
              <span className="text-gray-600 text-sm">Resets {consoleUsage.weeklyLimits.allModels.resetsIn}</span>
            ) : (
              <span className="text-gray-400 text-sm">--</span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full"
              style={{
                width: consoleUsage ? `${consoleUsage.weeklyLimits.allModels.percentageUsed}%` : '0%',
                backgroundColor: consoleUsage?.weeklyLimits.allModels.percentageUsed > 80 ? '#ef4444' : '#3b82f6',
              }}
            />
          </div>
          <p className="text-right text-sm text-gray-600">
            {consoleUsage ? `${consoleUsage.weeklyLimits.allModels.percentageUsed}% used` : 'No data'}
          </p>
        </div>

        {/* Sonnet Only */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-700">Sonnet only</span>
            {consoleUsage ? (
              <span className="text-gray-600 text-sm">Resets {consoleUsage.weeklyLimits.sonnetOnly.resetsIn}</span>
            ) : (
              <span className="text-gray-400 text-sm">--</span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full"
              style={{
                width: consoleUsage ? `${consoleUsage.weeklyLimits.sonnetOnly.percentageUsed}%` : '0%',
                backgroundColor: consoleUsage?.weeklyLimits.sonnetOnly.percentageUsed > 80 ? '#ef4444' : '#3b82f6',
              }}
            />
          </div>
          <p className="text-right text-sm text-gray-600">
            {consoleUsage ? `${consoleUsage.weeklyLimits.sonnetOnly.percentageUsed}% used` : 'No data'}
          </p>
        </div>
      </div>

      {/* 5-Hour Window - REAL DATA from JSONL */}
      <div className="mb-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-900">5-hour window (local)</span>
          <span className="text-gray-600">Resets in {fiveHour.resetsIn}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{fiveHour.used.toLocaleString()} tokens used</span>
          <span>Limit: <span className="text-fuchsia-600">{fiveHour.limit.toLocaleString()}</span></span>
        </div>
      </div>

      {/* Today - REAL DATA from JSONL */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-900">Today</span>
          <span className="text-gray-600">
            {claudeCode.today.tokens.toLocaleString()} tokens · {claudeCode.today.sessions} sessions
          </span>
        </div>
      </div>

      {/* Month to Date - REAL DATA from JSONL */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-900">Month to date</span>
          <span className="text-gray-600">
            {claudeCode.monthToDate.tokens.toLocaleString()} tokens · {claudeCode.monthToDate.sessions} sessions
          </span>
        </div>
      </div>

      {/* Model Breakdown - REAL DATA from JSONL */}
      {claudeCode.modelBreakdown.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <span className="font-bold text-gray-900 block mb-2">Model breakdown</span>
          <div className="space-y-2">
            {claudeCode.modelBreakdown.map((model) => (
              <div key={model.model} className="flex items-center justify-between text-sm">
                <span className="capitalize text-gray-700">{model.model}</span>
                <span className="text-gray-600">
                  {model.tokens.toLocaleString()} tokens ({model.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-xs text-gray-400 mt-4 text-right space-y-1">
        <p>JSONL: {new Date(claudeCode.lastUpdated).toLocaleTimeString()}</p>
        {consoleUsage && (
          <p>
            Console: {new Date(consoleUsage.lastUpdated).toLocaleTimeString()}
            {consoleUsage.isStale && <span className="text-amber-600 ml-1">⚠️ Stale ({consoleUsage.ageMinutes}min)</span>}
          </p>
        )}
      </div>
    </div>
  );
}
