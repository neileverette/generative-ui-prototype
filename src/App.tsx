import { useState, useCallback, useRef, useEffect } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { DashboardCanvas } from './components/DashboardCanvas';
import { A2UIComponent, DashboardState, sortByPriority } from './types/a2ui';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { Activity, Server, Container, Clock, Home } from 'lucide-react';

function DashboardWithAgent() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    components: [],
    lastUpdated: new Date().toISOString(),
  });
  const [chatWidth, setChatWidth] = useState(400);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse events for resizing
  const handleMouseDown = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;
    // Clamp between 300 and 600px
    setChatWidth(Math.max(300, Math.min(600, newWidth)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Set up global mouse event listeners for resizing
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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

        // Convert metrics to A2UI components with stable IDs (no timestamp)
        const newComponents: A2UIComponent[] = data.metrics.map((metric: {
          metric: string;
          displayName: string;
          currentValue: number;
          unit: string;
          status: string;
          change?: { value: number; direction: 'up' | 'down' | 'flat'; period: string };
        }) => ({
          id: `system-metric-${metric.metric}`,
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
            change: metric.change,
          },
        }));

        setDashboardState(prev => {
          // Remove existing system metrics to avoid duplicates, keep other components
          const filtered = prev.components.filter(
            c => !c.id.startsWith('system-metric-')
          );
          return {
            ...prev,
            components: sortByPriority([...filtered, ...newComponents]),
            lastUpdated: new Date().toISOString(),
            agentMessage: `Showing ${newComponents.length} metrics from your EC2 host`,
          };
        });

        return `Fetched and displayed ${newComponents.length} metrics. ${data.metrics.filter((m: { status: string }) => m.status !== 'healthy').length > 0 ? 'Some metrics need attention!' : 'All systems healthy.'}`;
      } catch (error) {
        return `Failed to fetch metrics: ${error}`;
      }
    },
  });

  // Helper function to fetch container metrics
  const fetchContainerCPU = useCallback(async (containerName: string) => {
    const response = await fetch(`/api/metrics/container/${encodeURIComponent(containerName)}`);
    const data = await response.json();

    if (data.error && !data.currentValue) {
      return null;
    }

    // Use stable ID without timestamp to allow deduplication
    const component: A2UIComponent = {
      id: `container-${containerName}-cpu`,
      component: 'metric_card' as const,
      source: 'datadog',
      priority: data.status === 'critical' ? 'critical' : data.status === 'warning' ? 'high' : 'medium',
      timestamp: new Date().toISOString(),
      props: {
        title: data.displayName,
        value: data.currentValue ?? 'N/A',
        unit: data.unit,
        status: data.status as 'healthy' | 'warning' | 'critical' | 'unknown',
        description: `Current CPU usage for ${containerName} container`,
      },
    };

    return component;
  }, []);

  // Action to fetch container CPU metrics
  useCopilotAction({
    name: 'fetchContainerMetrics',
    description: 'Fetch CPU usage for a specific Docker container from Datadog. Use this when the user asks about container CPU usage, like "show me n8n CPU" or "how much CPU is redis using".',
    parameters: [
      {
        name: 'containerName',
        type: 'string',
        description: 'The name of the Docker container to fetch CPU metrics for (e.g., "n8n", "redis", "postgres")',
        required: true,
      },
    ],
    handler: async ({ containerName }) => {
      try {
        const component = await fetchContainerCPU(containerName as string);

        if (!component) {
          return `No data found for container "${containerName}". Make sure the container name is correct.`;
        }

        setDashboardState(prev => {
          // Remove any existing metric for this container to avoid duplicates
          const filtered = prev.components.filter(
            c => !c.id.startsWith(`container-${containerName}-cpu`)
          );
          return {
            ...prev,
            components: sortByPriority([...filtered, component]),
            lastUpdated: new Date().toISOString(),
          };
        });

        return `Showing CPU usage for ${containerName}: ${component.props.value}${component.props.unit}`;
      } catch (error) {
        return `Failed to fetch container metrics: ${error}`;
      }
    },
  });

  // Action to fetch system uptime
  useCopilotAction({
    name: 'fetchSystemUptime',
    description: 'Fetch system uptime from Datadog. Use this when the user asks about uptime, how long the system has been running, or system availability.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('/api/metrics/uptime');
        const data = await response.json();

        if (data.error && !data.currentValue) {
          return `Error fetching uptime: ${data.error}`;
        }

        const component: A2UIComponent = {
          id: 'system-uptime',
          component: 'metric_card' as const,
          source: 'datadog',
          priority: 'low',
          timestamp: new Date().toISOString(),
          props: {
            title: data.displayName,
            value: data.currentValue,
            unit: data.unit,
            status: data.status as 'healthy' | 'warning' | 'critical' | 'unknown',
            description: 'Time since last system restart',
          },
        };

        setDashboardState(prev => {
          // Remove existing uptime metric to avoid duplicates
          const filtered = prev.components.filter(c => c.id !== 'system-uptime');
          return {
            ...prev,
            components: sortByPriority([...filtered, component]),
            lastUpdated: new Date().toISOString(),
          };
        });

        return `System uptime: ${data.currentValue}`;
      } catch (error) {
        return `Failed to fetch uptime: ${error}`;
      }
    },
  });

  // Shortcut handlers for the welcome screen
  const handleFetchSystemMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/metrics/overview');
      const data = await response.json();

      if (data.error) return;

      const newComponents: A2UIComponent[] = data.metrics.map((metric: {
        metric: string;
        displayName: string;
        currentValue: number;
        unit: string;
        status: string;
        change?: { value: number; direction: 'up' | 'down' | 'flat'; period: string };
      }) => ({
        id: `system-metric-${metric.metric}`,
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
          change: metric.change,
        },
      }));

      setDashboardState(prev => {
        const filtered = prev.components.filter(c => !c.id.startsWith('system-metric-'));
        return {
          ...prev,
          components: sortByPriority([...filtered, ...newComponents]),
          lastUpdated: new Date().toISOString(),
          agentMessage: `Showing ${newComponents.length} metrics from your EC2 host`,
        };
      });
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
    }
  }, []);

  const handleFetchContainerMetrics = useCallback(async () => {
    const component = await fetchContainerCPU('n8n');
    if (component) {
      setDashboardState(prev => {
        const filtered = prev.components.filter(c => c.id !== 'container-n8n-cpu');
        return {
          ...prev,
          components: sortByPriority([...filtered, component]),
          lastUpdated: new Date().toISOString(),
        };
      });
    }
  }, [fetchContainerCPU]);

  const handleFetchUptime = useCallback(async () => {
    try {
      const response = await fetch('/api/metrics/uptime');
      const data = await response.json();

      if (data.error && !data.currentValue) return;

      const component: A2UIComponent = {
        id: 'system-uptime',
        component: 'metric_card' as const,
        source: 'datadog',
        priority: 'low',
        timestamp: new Date().toISOString(),
        props: {
          title: data.displayName,
          value: data.currentValue,
          unit: data.unit,
          status: data.status as 'healthy' | 'warning' | 'critical' | 'unknown',
          description: 'Time since last system restart',
        },
      };

      setDashboardState(prev => {
        const filtered = prev.components.filter(c => c.id !== 'system-uptime');
        return {
          ...prev,
          components: sortByPriority([...filtered, component]),
          lastUpdated: new Date().toISOString(),
        };
      });
    } catch (error) {
      console.error('Failed to fetch uptime:', error);
    }
  }, []);

  // Define shortcuts for the welcome screen
  const shortcuts = [
    {
      id: 'system-metrics',
      title: 'System Metrics',
      description: 'View CPU, memory, load, and disk usage',
      icon: <Server className="w-6 h-6" />,
      onClick: handleFetchSystemMetrics,
    },
    {
      id: 'container-metrics',
      title: 'n8n Container',
      description: 'View n8n container CPU usage',
      icon: <Container className="w-6 h-6" />,
      onClick: handleFetchContainerMetrics,
    },
    {
      id: 'system-uptime',
      title: 'System Uptime',
      description: 'Check how long the system has been running',
      icon: <Clock className="w-6 h-6" />,
      onClick: handleFetchUptime,
    },
  ];

  return (
    <div ref={containerRef} className="flex h-screen bg-surface-0 text-text-primary">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-surface-3 flex items-center justify-between px-6 bg-surface-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDashboardState({
                components: [],
                lastUpdated: new Date().toISOString(),
              })}
              disabled={dashboardState.components.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-all mr-2 text-sm ${
                dashboardState.components.length > 0
                  ? 'bg-accent-primary text-white border-accent-primary hover:bg-accent-primary/90 cursor-pointer'
                  : 'bg-surface-2 text-text-muted border-surface-3 cursor-not-allowed opacity-50'
              }`}
              title="Back to home"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <Activity className="w-5 h-5 text-accent-primary" />
            <h1 className="text-lg font-semibold">
              <span className="gradient-text">Agent-Driven</span> Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted font-mono">
              {dashboardState.components.length} components
            </span>
          </div>
        </header>

        {/* Dashboard Canvas */}
        <main className="flex-1 overflow-auto p-6">
          <DashboardCanvas state={dashboardState} shortcuts={shortcuts} />
        </main>
      </div>

      {/* Resizable Divider */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 bg-surface-3 hover:bg-accent-primary cursor-col-resize transition-colors flex-shrink-0"
      />

      {/* Chat Panel */}
      <div
        className="flex flex-col bg-surface-1 overflow-hidden flex-shrink-0"
        style={{ width: chatWidth }}
      >
        <div className="h-14 border-b border-surface-3 flex items-center px-4">
          <h2 className="font-semibold text-text-primary">Infrastructure Assistant</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <CopilotChat
            labels={{
              initial: 'Ask me about your system metrics, or say "show me a dashboard" to get started.',
              placeholder: 'Ask about CPU, memory, containers...',
            }}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false}>
      <DashboardWithAgent />
    </CopilotKit>
  );
}

export default App;
