import { useState } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { DashboardCanvas } from './components/DashboardCanvas';
import { A2UIComponent, DashboardState, sortByPriority } from './types/a2ui';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { PanelLeftClose, PanelLeft, Activity } from 'lucide-react';

function DashboardWithAgent() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    components: [],
    lastUpdated: new Date().toISOString(),
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Make dashboard state readable by the agent
  useCopilotReadable({
    description: 'Current dashboard state with all displayed components',
    value: dashboardState,
  });

  // Action to render components on the dashboard
  useCopilotAction({
    name: 'renderDashboard',
    description: 'Render A2UI components on the dashboard canvas. Use this after fetching metrics to display them visually.',
    parameters: [
      {
        name: 'components',
        type: 'object[]',
        description: 'Array of A2UI component definitions to render',
        required: true,
      },
      {
        name: 'message',
        type: 'string',
        description: 'Optional message to display with the dashboard update',
        required: false,
      },
    ],
    handler: async ({ components, message }) => {
      const sortedComponents = sortByPriority(components as A2UIComponent[]);
      setDashboardState({
        components: sortedComponents,
        lastUpdated: new Date().toISOString(),
        agentMessage: message,
      });
      return `Rendered ${components.length} components on the dashboard`;
    },
  });

  // Action to add a single component
  useCopilotAction({
    name: 'addComponent',
    description: 'Add a single component to the dashboard',
    parameters: [
      {
        name: 'component',
        type: 'object',
        description: 'A2UI component definition to add',
        required: true,
      },
    ],
    handler: async ({ component }) => {
      setDashboardState(prev => {
        const updated = [...prev.components, component as A2UIComponent];
        return {
          ...prev,
          components: sortByPriority(updated),
          lastUpdated: new Date().toISOString(),
        };
      });
      return `Added component: ${(component as A2UIComponent).props?.title || 'Unknown'}`;
    },
  });

  // Action to clear the dashboard
  useCopilotAction({
    name: 'clearDashboard',
    description: 'Clear all components from the dashboard',
    parameters: [],
    handler: async () => {
      setDashboardState({
        components: [],
        lastUpdated: new Date().toISOString(),
      });
      return 'Dashboard cleared';
    },
  });

  // Action to fetch real metrics from Datadog and display them
  useCopilotAction({
    name: 'fetchSystemMetrics',
    description: 'Fetch real system metrics (CPU, memory, load, disk) from Datadog and display them on the dashboard. Use this when the user asks about system health, metrics, or wants to see infrastructure status.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('/api/metrics/overview');
        const data = await response.json();

        if (data.error) {
          return `Error fetching metrics: ${data.error}`;
        }

        // Convert metrics to A2UI components
        const components: A2UIComponent[] = data.metrics.map((metric: { metric: string; displayName: string; currentValue: number; unit: string; status: string }, index: number) => ({
          id: `metric-${metric.metric}-${Date.now()}`,
          component: 'metric_card' as const,
          source: 'datadog',
          priority: metric.status === 'critical' ? 'critical' : metric.status === 'warning' ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: metric.displayName,
            value: metric.currentValue,
            unit: metric.unit,
            status: metric.status as 'healthy' | 'warning' | 'critical',
            description: `Current ${metric.displayName.toLowerCase()}`,
          },
        }));

        setDashboardState({
          components: sortByPriority(components),
          lastUpdated: new Date().toISOString(),
          agentMessage: `Showing ${components.length} metrics from your EC2 host`,
        });

        return `Fetched and displayed ${components.length} metrics. ${data.metrics.filter((m: { status: string }) => m.status !== 'healthy').length > 0 ? 'Some metrics need attention!' : 'All systems healthy.'}`;
      } catch (error) {
        return `Failed to fetch metrics: ${error}`;
      }
    },
  });

  return (
    <div className="flex h-screen bg-surface-0 text-text-primary">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-surface-3 flex items-center justify-between px-6 bg-surface-1">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-accent-primary" />
            <h1 className="text-lg font-semibold">
              <span className="gradient-text">Agent-Driven</span> Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted font-mono">
              {dashboardState.components.length} components
            </span>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-surface-3 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand chat' : 'Collapse chat'}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-5 h-5 text-text-secondary" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-text-secondary" />
              )}
            </button>
          </div>
        </header>

        {/* Dashboard Canvas */}
        <main className="flex-1 overflow-auto p-6">
          <DashboardCanvas state={dashboardState} />
        </main>
      </div>

      {/* Chat Sidebar */}
      <div
        className={`border-l border-surface-3 bg-surface-1 transition-all duration-300 ${
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[400px]'
        }`}
      >
        <CopilotSidebar
          labels={{
            title: 'Infrastructure Assistant',
            initial: 'Ask me about your system metrics, or say "show me a dashboard" to get started.',
            placeholder: 'Ask about CPU, memory, containers...',
          }}
          className="h-full"
          defaultOpen={true}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <DashboardWithAgent />
    </CopilotKit>
  );
}

export default App;
