/**
 * Landing Page Component
 *
 * The main dashboard landing page matching the mockup design.
 * Features:
 * - Today's update banner
 * - System uptime and Memory metrics
 * - Claude Code and Anthropic usage cards
 * - Navigation cards grid
 * - ConsoleAI sidebar
 */

import { useState, useEffect } from 'react';
import {
  DollarSign,
  Activity,
  Workflow,
  Container,
  Rocket,
  Brain,
} from 'lucide-react';
import { TodaysUpdateCard } from './a2ui/TodaysUpdateCard';
import { NavigationCard, NavigationCardStatus } from './a2ui/NavigationCard';
import { ClaudeUsageCard } from './a2ui/ClaudeUsageCard';
import { AnthropicUsageCard } from './a2ui/AnthropicUsageCard';
import { ShortcutLinksCard } from './a2ui/ShortcutLinksCard';
import { mcpClient } from '../services/mcp-client';
import { A2UIComponent, ShortcutLinksComponent } from '../types/a2ui';
import shortcutsConfig from '../config/shortcuts.json';

interface LandingPageProps {
  onNavigate: (destination: string) => void;
  onSendMessage: (message: string) => void;
  timeWindow?: string;
  className?: string;
}

interface NavCardStatus {
  current: number;
  total: number;
  status: NavigationCardStatus;
  label: string;
}

interface DashboardData {
  containerCount: number;
  alertCount: number;
  uptimePercent: number;
  systemUptime: string;
  availabilityPercent: number;
  memoryPercent: number;
  automationHours: number;
  automationExecutions: number;
  monthlyCost: number;
  projectedCost: number;
  costs: NavCardStatus;
  systemMetrics: NavCardStatus;
  automations: NavCardStatus;
  applications: NavCardStatus;
  deployments: NavCardStatus;
  aiUsage: NavCardStatus;
}

const DEFAULT_DATA: DashboardData = {
  containerCount: 0,
  alertCount: 0,
  uptimePercent: 100,
  systemUptime: '0h 0m',
  availabilityPercent: 0,
  memoryPercent: 0,
  automationHours: 0,
  automationExecutions: 0,
  monthlyCost: 0,
  projectedCost: 0,
  costs: { current: 12, total: 12, status: 'good', label: 'Good' },
  systemMetrics: { current: 10, total: 10, status: 'good', label: 'Good' },
  automations: { current: 2, total: 2, status: 'good', label: 'Good' },
  applications: { current: 12, total: 12, status: 'good', label: 'Good' },
  deployments: { current: 8, total: 10, status: 'good', label: 'Good' },
  aiUsage: { current: 2, total: 2, status: 'good', label: 'Good' },
};

export function LandingPage({
  onNavigate,
  onSendMessage: _onSendMessage,
  timeWindow = '4h',
  className = '',
}: LandingPageProps) {
  const [data, setData] = useState<DashboardData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [updateTimestamp, setUpdateTimestamp] = useState<string>(new Date().toISOString());

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch data from multiple sources in parallel
        const [containersData, systemData, costsData, gmailData, imageGenData] = await Promise.all([
          mcpClient.getRunningContainers(timeWindow).catch(() => ({ error: true })),
          mcpClient.getOverviewFast(timeWindow).catch(() => ({ error: true })),
          mcpClient.getCostsOverview().catch(() => ({ error: true })),
          mcpClient.getGmailFilterMetrics(timeWindow).catch(() => ({ error: true })),
          mcpClient.getImageGeneratorMetrics(timeWindow).catch(() => ({ error: true })),
        ]);

        const newData = { ...DEFAULT_DATA };

        // Process containers
        if (!containersData.error && containersData.currentValue !== undefined) {
          newData.containerCount = containersData.currentValue;
          newData.applications = {
            current: containersData.currentValue,
            total: containersData.currentValue,
            status: 'good',
            label: 'Good',
          };
        }

        // Process system metrics
        if (!systemData.error && systemData.metrics) {
          const uptime = systemData.metrics.find((m: { metric: string }) => m.metric === 'system_uptime');
          const memory = systemData.metrics.find((m: { metric: string }) => m.metric === 'memory_used_percent');

          if (uptime && uptime.currentValue) {
            const seconds = uptime.currentValue;
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            newData.systemUptime = `${hours}h ${mins}m`;

            // Calculate availability: assume 5 min downtime per reboot in 30-day window
            const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
            const estimatedRebootDowntime = 5 * 60; // 5 minutes per reboot
            const rebootsInPeriod = seconds >= thirtyDaysInSeconds ? 0 : 1;
            const totalDowntime = rebootsInPeriod * estimatedRebootDowntime;
            const availability = 100 - (totalDowntime / thirtyDaysInSeconds) * 100;
            newData.availabilityPercent = parseFloat(availability.toFixed(2));
          }

          if (memory && memory.currentValue !== undefined) {
            newData.memoryPercent = parseFloat(memory.currentValue.toFixed(2));
          }
        }

        // Process automation metrics (gmail filter + image generator)
        let totalExecutions = 0;
        let totalHours = 0;

        if (!gmailData.error && gmailData.currentValue !== undefined) {
          totalExecutions += gmailData.currentValue;
          // Estimate 0.5 minutes per execution = 0.00833 hours
          totalHours += gmailData.currentValue * 0.00833;
        }

        if (!imageGenData.error && imageGenData.currentValue !== undefined) {
          totalExecutions += imageGenData.currentValue;
          // Estimate 2 minutes per execution = 0.0333 hours
          totalHours += imageGenData.currentValue * 0.0333;
        }

        newData.automationExecutions = totalExecutions;
        newData.automationHours = Math.round(totalHours * 10) / 10; // Round to 1 decimal

        // Process costs
        if (!costsData.error && costsData.aws && !costsData.aws.error) {
          newData.monthlyCost = costsData.aws.totalCost || 0;
          // Forecast is remaining cost from tomorrow to end of month
          // So projected total = current month-to-date + forecast for remaining days
          const forecastRemaining = costsData.forecast?.forecastedCost || 0;
          newData.projectedCost = newData.monthlyCost + forecastRemaining;
        }

        setData(newData);
        setUpdateTimestamp(new Date().toISOString());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeWindow]);

  // Build the summary text
  const summaryText = `${data.containerCount} containers running, ${data.alertCount} alerts firing, ${data.uptimePercent}% uptime—your automations ran ${data.automationExecutions} times, saving you ${data.automationHours} hours. Current month cost is $${data.monthlyCost.toFixed(2)} with a projected month end of $${data.projectedCost.toFixed(2)}.`;

  // Claude usage component
  const claudeUsageComponent: A2UIComponent = {
    id: 'landing-claude-usage',
    component: 'claude_usage' as const,
    source: 'landing-page',
    priority: 'medium',
    timestamp: new Date().toISOString(),
    props: {
      claudeCode: null,
      apiCredits: null,
      showApiSection: false,
    },
  };

  return (
    <div className={`flex gap-6 ${className}`}>
      {/* Main Content Area */}
      <div className="flex-1 space-y-5">
        {/* Today's Update Banner */}
        <TodaysUpdateCard
          summary={summaryText}
          timestamp={updateTimestamp}
          isLoading={isLoading}
        />

        {/* System Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* System Uptime Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="widget-title">System Uptime</span>
                </div>
                <span className="text-4xl font-bold text-text-primary whitespace-nowrap">{data.systemUptime}</span>
              </div>
              <span className="text-sm text-green-600 text-right break-words max-w-[120px]">
                Stable, no issues.
              </span>
            </div>
          </div>

          {/* Availability Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="widget-title">Availability</span>
                </div>
                <span className="text-4xl font-bold text-text-primary whitespace-nowrap">{data.availabilityPercent}%</span>
              </div>
              <span className={`text-sm text-right break-words max-w-[120px] ${data.availabilityPercent >= 99 ? 'text-green-600' : data.availabilityPercent >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                {data.availabilityPercent >= 99 ? 'Excellent' : data.availabilityPercent >= 95 ? 'Good' : 'Needs attention'}
              </span>
            </div>
          </div>

          {/* Memory Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="widget-title">Memory</span>
                </div>
                <span className="text-4xl font-bold text-text-primary whitespace-nowrap">{data.memoryPercent}%</span>
              </div>
              <span className={`text-sm text-right break-words max-w-[120px] ${data.memoryPercent < 80 ? 'text-green-600' : data.memoryPercent < 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                {data.memoryPercent < 80 ? 'Healthy' : data.memoryPercent < 95 ? 'Elevated' : 'Critical'}
              </span>
            </div>
          </div>
        </div>

        {/* Claude Code + Anthropic Row */}
        <div className="grid grid-cols-2 gap-4">
          <ClaudeUsageCard component={claudeUsageComponent} />
          <AnthropicUsageCard />
        </div>

        {/* Shortcuts Section */}
        <ShortcutLinksCard
          component={{
            id: 'landing-shortcuts',
            component: 'shortcut_links' as const,
            source: 'landing-page',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            props: {
              shortcuts: shortcutsConfig.shortcuts,
              layout: 'default',
            },
          } as ShortcutLinksComponent}
        />

        {/* Navigation Cards Grid */}
        <div className="grid grid-cols-3 gap-4">
          <NavigationCard
            title="Costs"
            description="Costs across AWS resources"
            icon={DollarSign}
            status={data.costs}
            statusType={data.costs.status}
            onClick={() => onNavigate('show costs')}
          />
          <NavigationCard
            title="System Metrics"
            description="Uptime, CPU, memory, network and more"
            icon={Activity}
            status={data.systemMetrics}
            statusType={data.systemMetrics.status}
            onClick={() => onNavigate('system metrics')}
          />
          <NavigationCard
            title="Automations"
            description="Workflows across n8n and LangFlow"
            icon={Workflow}
            status={data.automations}
            statusType={data.automations.status}
            onClick={() => onNavigate('show automations')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <NavigationCard
            title="Applications"
            description="View running containers and their metrics"
            icon={Container}
            status={data.applications}
            statusType={data.applications.status}
            onClick={() => onNavigate('show containers')}
          />
          <NavigationCard
            title="Deployments"
            description="Uptime, CPU, memory, network and more"
            icon={Rocket}
            status={data.deployments}
            statusType={data.deployments.status}
            onClick={() => onNavigate('show deployments')}
          />
          <NavigationCard
            title="AI Usage"
            description="Track limits, usage and API credits"
            icon={Brain}
            status={data.aiUsage}
            statusType={data.aiUsage.status}
            onClick={() => onNavigate('claude usage')}
          />
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
