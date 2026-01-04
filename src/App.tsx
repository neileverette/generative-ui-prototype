import { useState, useCallback, useRef, useEffect } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { DashboardCanvas } from './components/DashboardCanvas';
import { BlurBackground } from './components/BlurBackground';
import { A2UIComponent, DashboardState, sortByPriority } from './types/a2ui';
import { useCopilotAction, useCopilotReadable, useCopilotChat } from '@copilotkit/react-core';
import { TextMessage, MessageRole } from '@copilotkit/runtime-client-gql';
import { Server, Container, Workflow, Terminal, ArrowLeft } from 'lucide-react';

// IBM Venn Diagram icon
const VennDiagramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 32 32"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20,6a9.92,9.92,0,0,0-4,.84A9.92,9.92,0,0,0,12,6a10,10,0,0,0,0,20,9.92,9.92,0,0,0,4-.84A9.92,9.92,0,0,0,20,26,10,10,0,0,0,20,6ZM12,24A8,8,0,0,1,12,8a7.91,7.91,0,0,1,1.76.2,10,10,0,0,0,0,15.6A7.91,7.91,0,0,1,12,24Zm8-8a8,8,0,0,1-4,6.92A8,8,0,0,1,16,9.08,8,8,0,0,1,20,16Zm0,8a7.91,7.91,0,0,1-1.76-.2,10,10,0,0,0,0-15.6A7.91,7.91,0,0,1,20,8a8,8,0,0,1,0,16Z" />
  </svg>
);

function DashboardWithAgent() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    components: [],
    lastUpdated: new Date().toISOString(),
  });
  const [currentView, setCurrentView] = useState<'home' | 'commands' | 'loading'>('home');
  const [chatWidth, setChatWidth] = useState(400);
  const [timeWindow, setTimeWindow] = useState('1h');
  const [lastAction, setLastAction] = useState<'system' | 'containers' | 'automations' | null>(null);
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
    setChatWidth(Math.max(300, Math.min(600, newWidth)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Auto-refresh data when time window changes
  useEffect(() => {
    if (!lastAction || dashboardState.components.length === 0) return;

    // Re-fetch the data based on what was last displayed
    if (lastAction === 'system') {
      handleFetchSystemInfrastructure();
    } else if (lastAction === 'containers') {
      handleFetchContainersList();
    } else if (lastAction === 'automations') {
      handleFetchAutomations();
    }
  }, [timeWindow]); // Only trigger on timeWindow changes, not on lastAction

  // Make dashboard state readable by the agent
  useCopilotReadable({
    description: 'Current dashboard state with all displayed components',
    value: dashboardState,
  });

  // Make time window readable by the agent
  useCopilotReadable({
    description: 'Selected time window for Datadog metrics queries (5m, 15m, 30m, 1h, 4h, 1d, 2d, 1w, 1mo)',
    value: timeWindow,
  });

  // Hook for programmatic chat messaging
  const { appendMessage } = useCopilotChat();

  // Handler for command clicks - sends query to chat
  const handleCommandClick = useCallback(async (query: string) => {
    setCurrentView('loading'); // Show loading state while waiting
    await appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: query,
      })
    );
  }, [appendMessage]);

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
      setCurrentView('home'); // Switch to home view to show components
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
      setCurrentView('home');
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

  // Helper to format uptime from seconds
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Helper to format bytes to human readable
  const formatBytes = (bytes: number): { value: number; unit: string } => {
    if (bytes >= 1e9) return { value: parseFloat((bytes / 1e9).toFixed(1)), unit: 'GB/s' };
    if (bytes >= 1e6) return { value: parseFloat((bytes / 1e6).toFixed(1)), unit: 'MB/s' };
    if (bytes >= 1e3) return { value: parseFloat((bytes / 1e3).toFixed(1)), unit: 'KB/s' };
    return { value: Math.round(bytes), unit: 'B/s' };
  };

  // Action to fetch real metrics from Datadog and display them
  useCopilotAction({
    name: 'fetchSystemMetrics',
    description: 'Fetch real system metrics (CPU, memory, load, disk) from Datadog and display them on the dashboard. Use this when the user asks about system health, metrics, or wants to see infrastructure status.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch(`/api/metrics/overview/fast?timeWindow=${timeWindow}`);
        const data = await response.json();

        if (data.error) {
          return `Error fetching metrics: ${data.error}`;
        }

        // Convert metrics to A2UI components with stable IDs (skip metrics with no data)
        const newComponents: A2UIComponent[] = data.metrics
          .filter((metric: { currentValue: number | null }) => metric.currentValue !== null)
          .map((metric: {
            metric: string;
            displayName: string;
            currentValue: number;
            unit: string;
            status: string;
            change?: { value: number; direction: 'up' | 'down' | 'flat'; period: string };
          }) => {
            let displayValue: number | string = metric.currentValue;
            let displayUnit = metric.unit;

            // Format uptime specially
            if (metric.metric === 'system_uptime' && metric.currentValue) {
              displayValue = formatUptime(metric.currentValue);
              displayUnit = '';
            }
            // Format network bytes
            else if ((metric.metric === 'network_bytes_sent' || metric.metric === 'network_bytes_recv') && metric.currentValue) {
              const formatted = formatBytes(metric.currentValue);
              displayValue = formatted.value;
              displayUnit = formatted.unit;
            }
            // For CPU Idle, invert the status logic (lower is worse)
            let status = metric.status as 'healthy' | 'warning' | 'critical' | 'unknown';
            if (metric.metric === 'cpu_idle' && metric.currentValue !== null) {
              if (metric.currentValue < 10) status = 'critical';
              else if (metric.currentValue < 30) status = 'warning';
              else status = 'healthy';
            }

            return {
              id: `system-metric-${metric.metric}`,
              component: 'metric_card' as const,
              source: 'datadog',
              priority: status === 'critical' ? 'critical' : status === 'warning' ? 'high' : 'medium',
              timestamp: new Date().toISOString(),
              props: {
                title: metric.displayName,
                value: displayValue,
                unit: displayUnit,
                status,
                description: `Current ${metric.displayName.toLowerCase()}`,
                change: metric.change,
              },
            };
          });

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
        setCurrentView('home');

        return `Fetched and displayed ${newComponents.length} metrics. ${data.metrics.filter((m: { status: string }) => m.status !== 'healthy').length > 0 ? 'Some metrics need attention!' : 'All systems healthy.'}`;
      } catch (error) {
        return `Failed to fetch metrics: ${error}`;
      }
    },
  });

  // Helper function to fetch container metrics
  const fetchContainerCPU = useCallback(async (containerName: string) => {
    const response = await fetch(`/api/metrics/container/${encodeURIComponent(containerName)}?timeWindow=${timeWindow}`);
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
  }, [timeWindow]);

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
        setCurrentView('home');

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
        const response = await fetch(`/api/metrics/uptime?timeWindow=${timeWindow}`);
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
        setCurrentView('home');

        return `System uptime: ${data.currentValue}`;
      } catch (error) {
        return `Failed to fetch uptime: ${error}`;
      }
    },
  });

  // Action to fetch running containers count
  useCopilotAction({
    name: 'fetchRunningContainers',
    description: 'Fetch the count of running Docker containers. Use this when the user asks how many containers are running.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch(`/api/metrics/running-containers?timeWindow=${timeWindow}`);
        const data = await response.json();

        if (data.error) {
          return `Error fetching containers: ${data.error}`;
        }

        const component: A2UIComponent = {
          id: 'running-containers',
          component: 'metric_card' as const,
          source: 'datadog',
          priority: 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: data.displayName,
            value: data.currentValue ?? 'N/A',
            unit: data.unit,
            status: data.status as 'healthy' | 'warning' | 'critical' | 'unknown',
            description: 'Number of Docker containers currently running',
          },
        };

        setDashboardState(prev => {
          const filtered = prev.components.filter(c => c.id !== 'running-containers');
          return {
            ...prev,
            components: sortByPriority([...filtered, component]),
            lastUpdated: new Date().toISOString(),
          };
        });
        setCurrentView('home');

        return `Running containers: ${data.currentValue}`;
      } catch (error) {
        return `Failed to fetch running containers: ${error}`;
      }
    },
  });

  // Action to fetch container memory usage
  useCopilotAction({
    name: 'fetchContainerMemory',
    description: 'Fetch memory usage for a specific Docker container. Use this when the user asks about container memory usage, like "show me n8n memory" or "how much memory is redis using".',
    parameters: [
      {
        name: 'containerName',
        type: 'string',
        description: 'The name of the Docker container to fetch memory metrics for (e.g., "n8n", "redis", "postgres", "langflow")',
        required: true,
      },
    ],
    handler: async ({ containerName }) => {
      try {
        const response = await fetch(`/api/metrics/container/${encodeURIComponent(containerName as string)}/memory?timeWindow=${timeWindow}`);
        const data = await response.json();

        if (data.error && !data.currentValue) {
          return `No memory data found for container "${containerName}".`;
        }

        const component: A2UIComponent = {
          id: `container-${containerName}-memory`,
          component: 'metric_card' as const,
          source: 'datadog',
          priority: data.status === 'critical' ? 'critical' : data.status === 'warning' ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: data.displayName,
            value: data.currentValue ?? 'N/A',
            unit: data.unit,
            status: data.status as 'healthy' | 'warning' | 'critical' | 'unknown',
            description: `Current memory usage for ${containerName} container`,
          },
        };

        setDashboardState(prev => {
          const filtered = prev.components.filter(c => c.id !== `container-${containerName}-memory`);
          return {
            ...prev,
            components: sortByPriority([...filtered, component]),
            lastUpdated: new Date().toISOString(),
          };
        });
        setCurrentView('home');

        return `Showing memory usage for ${containerName}: ${data.currentValue} ${data.unit}`;
      } catch (error) {
        return `Failed to fetch container memory: ${error}`;
      }
    },
  });

  // Action to fetch Gmail Filter workflow metrics
  useCopilotAction({
    name: 'fetchGmailFilterMetrics',
    description: 'Fetch n8n Gmail Filter workflow execution metrics (successful, failed, success rate). Use this when the user asks about Gmail Filter workflow status or executions.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch(`/api/metrics/n8n/gmail-filter?timeWindow=${timeWindow}`);
        const data = await response.json();

        if (data.error) {
          return `Error fetching Gmail Filter metrics: ${data.error}`;
        }

        // Create three metric cards for success, failed, and rate
        const components: A2UIComponent[] = [
          {
            id: 'gmail-filter-success',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Gmail Filter: Successful',
              value: data.metrics.successful,
              unit: '',
              status: 'healthy' as const,
              description: 'Successful executions (24h)',
            },
          },
          {
            id: 'gmail-filter-failed',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: data.metrics.failed > 0 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Gmail Filter: Failed',
              value: data.metrics.failed,
              unit: '',
              status: data.metrics.failed > 0 ? 'warning' as const : 'healthy' as const,
              description: 'Failed executions (24h)',
            },
          },
          {
            id: 'gmail-filter-rate',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Gmail Filter: Success Rate',
              value: data.metrics.successRate,
              unit: '%',
              status: data.metrics.successRate >= 95 ? 'healthy' as const : data.metrics.successRate >= 80 ? 'warning' as const : 'critical' as const,
              description: 'Success rate (24h)',
            },
          },
        ];

        setDashboardState(prev => {
          const filtered = prev.components.filter(c => !c.id.startsWith('gmail-filter-'));
          return {
            ...prev,
            components: sortByPriority([...filtered, ...components]),
            lastUpdated: new Date().toISOString(),
          };
        });
        setCurrentView('home');

        return `Gmail Filter: ${data.metrics.successful} successful, ${data.metrics.failed} failed, ${data.metrics.successRate}% success rate`;
      } catch (error) {
        return `Failed to fetch Gmail Filter metrics: ${error}`;
      }
    },
  });

  // Action to fetch Image Generator workflow metrics
  useCopilotAction({
    name: 'fetchImageGeneratorMetrics',
    description: 'Fetch n8n Image Generator workflow execution metrics (successful, failed, success rate). Use this when the user asks about Image Generator workflow status or executions.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch(`/api/metrics/n8n/image-generator?timeWindow=${timeWindow}`);
        const data = await response.json();

        if (data.error) {
          return `Error fetching Image Generator metrics: ${data.error}`;
        }

        const components: A2UIComponent[] = [
          {
            id: 'image-gen-success',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Image Generator: Successful',
              value: data.metrics.successful,
              unit: '',
              status: 'healthy' as const,
              description: 'Successful executions (24h)',
            },
          },
          {
            id: 'image-gen-failed',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: data.metrics.failed > 0 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Image Generator: Failed',
              value: data.metrics.failed,
              unit: '',
              status: data.metrics.failed > 0 ? 'warning' as const : 'healthy' as const,
              description: 'Failed executions (24h)',
            },
          },
          {
            id: 'image-gen-rate',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Image Generator: Success Rate',
              value: data.metrics.successRate,
              unit: '%',
              status: data.metrics.successRate >= 95 ? 'healthy' as const : data.metrics.successRate >= 80 ? 'warning' as const : 'critical' as const,
              description: 'Success rate (24h)',
            },
          },
        ];

        setDashboardState(prev => {
          const filtered = prev.components.filter(c => !c.id.startsWith('image-gen-'));
          return {
            ...prev,
            components: sortByPriority([...filtered, ...components]),
            lastUpdated: new Date().toISOString(),
          };
        });
        setCurrentView('home');

        return `Image Generator: ${data.metrics.successful} successful, ${data.metrics.failed} failed, ${data.metrics.successRate}% success rate`;
      } catch (error) {
        return `Failed to fetch Image Generator metrics: ${error}`;
      }
    },
  });

  // Action to query the LangFlow Datadog Agent
  useCopilotAction({
    name: 'queryDatadogAgent',
    description: 'Query the LangFlow-based Datadog agent with natural language questions about infrastructure metrics. The agent can interpret questions, fetch metrics from Datadog, and provide intelligent insights. Use this for complex metric queries or when the user wants analysis and recommendations.',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Natural language question about infrastructure (e.g., "What is my current CPU usage?", "Is my server healthy?", "Check memory metrics")',
        required: true,
      },
    ],
    handler: async ({ query }) => {
      try {
        const response = await fetch('/api/langflow/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, timeWindow }),
        });

        const data = await response.json();

        if (data.error) {
          return `Error from Datadog agent: ${data.error}`;
        }

        // Return the agent's message - it will appear in the chat
        return data.message || 'No response from agent';
      } catch (error) {
        return `Failed to query Datadog agent: ${error}`;
      }
    },
  });

  // Action to fetch running containers list as a table
  useCopilotAction({
    name: 'fetchContainersList',
    description: 'Fetch a table showing all running Docker containers with their memory and CPU usage. Use this when the user asks to see all containers, list containers, or wants a containers table/overview.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch(`/api/metrics/containers-list?timeWindow=${timeWindow}`);
        const data = await response.json();

        if (data.error) {
          return `Error fetching containers list: ${data.error}`;
        }

        const component: A2UIComponent = {
          id: 'containers-list-table',
          component: 'data_table' as const,
          source: 'datadog',
          priority: 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: 'Running Containers',
            columns: [
              { key: 'name', label: 'Container' },
              { key: 'memory', label: 'Memory (MiB)' },
              { key: 'cpu', label: 'CPU %' },
            ],
            rows: data.containers.map((c: { name: string; memory: number | null; cpu: number | null }) => ({
              name: c.name,
              memory: c.memory ?? 'N/A',
              cpu: c.cpu !== null ? `${c.cpu}%` : 'N/A',
            })),
          },
        };

        setDashboardState(prev => {
          const filtered = prev.components.filter(c => c.id !== 'containers-list-table');
          return {
            ...prev,
            components: sortByPriority([...filtered, component]),
            lastUpdated: new Date().toISOString(),
          };
        });
        setCurrentView('home');

        return `Showing ${data.count} running containers`;
      } catch (error) {
        return `Failed to fetch containers list: ${error}`;
      }
    },
  });

  // Shortcut handlers for the welcome screen
  const handleFetchContainersList = useCallback(async () => {
    try {
      // Fetch containers list and running count in parallel
      const [containersResponse, countResponse] = await Promise.all([
        fetch(`/api/metrics/containers-list?timeWindow=${timeWindow}`),
        fetch(`/api/metrics/running-containers?timeWindow=${timeWindow}`),
      ]);

      const containersData = await containersResponse.json();
      const countData = await countResponse.json();

      if (containersData.error) return;

      const newComponents: A2UIComponent[] = [];

      // Add running containers count card with loading state for insights
      if (!countData.error) {
        newComponents.push({
          id: 'running-containers-count',
          component: 'metric_card' as const,
          source: 'datadog',
          priority: 'high',
          timestamp: new Date().toISOString(),
          props: {
            title: 'Running Containers',
            value: countData.currentValue ?? containersData.count,
            unit: '',
            size: 'xl' as const,  // Large featured number
            status: 'healthy' as const,
            description: `Docker containers currently running across your infrastructure.`,
            insightsLoading: true,  // Show skeleton while loading insights
          },
        });
      }

      // Add Generative UI app metrics
      const appUptime = Math.floor((Date.now() - performance.timeOrigin) / 1000);
      const appUptimeFormatted = appUptime >= 3600
        ? `${Math.floor(appUptime / 3600)}h ${Math.floor((appUptime % 3600) / 60)}m`
        : appUptime >= 60
          ? `${Math.floor(appUptime / 60)}m ${appUptime % 60}s`
          : `${appUptime}s`;

      newComponents.push({
        id: 'app-session-uptime',
        component: 'metric_card' as const,
        source: 'app',
        priority: 'low',
        timestamp: new Date().toISOString(),
        props: {
          title: 'App Session',
          value: appUptimeFormatted,
          unit: '',
          status: 'healthy' as const,
          description: 'Time since page load',
        },
      });

      // Memory usage if available
      if ('memory' in performance) {
        const memInfo = (performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024);
        const memPercent = Math.round((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100);
        const memStatus = memPercent >= 80 ? 'warning' : 'healthy';

        newComponents.push({
          id: 'app-memory',
          component: 'metric_card' as const,
          source: 'app',
          priority: memStatus === 'warning' ? 'high' : 'low',
          timestamp: new Date().toISOString(),
          props: {
            title: 'App Memory',
            value: usedMB,
            unit: `/ ${limitMB} MB`,
            status: memStatus as 'healthy' | 'warning',
            description: `${memPercent}% heap usage`,
          },
        });
      }

      // Add container groups - each container gets a card with CPU and Memory
      containersData.containers.forEach((container: { name: string; memory: number | null; cpu: number | null }) => {
        const cpuStatus = container.cpu !== null
          ? (container.cpu >= 80 ? 'critical' : container.cpu >= 50 ? 'warning' : 'healthy')
          : 'unknown';
        const memStatus = container.memory !== null
          ? (container.memory >= 1024 ? 'warning' : 'healthy')
          : 'unknown';

        // Overall status is the worst of CPU or Memory
        const overallStatus = cpuStatus === 'critical' || memStatus === 'critical'
          ? 'critical'
          : cpuStatus === 'warning' || memStatus === 'warning'
            ? 'warning'
            : 'healthy';

        newComponents.push({
          id: `container-group-${container.name}`,
          component: 'card_group' as const,
          source: 'datadog',
          priority: overallStatus === 'critical' ? 'critical' : overallStatus === 'warning' ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: container.name,
            status: overallStatus as 'healthy' | 'warning' | 'critical',
            metrics: [
              {
                label: 'CPU',
                value: container.cpu ?? 'N/A',
                unit: container.cpu !== null ? '%' : '',
                status: cpuStatus as 'healthy' | 'warning' | 'critical' | 'unknown',
              },
              {
                label: 'Memory',
                value: container.memory ?? 'N/A',
                unit: container.memory !== null ? 'MiB' : '',
                status: memStatus as 'healthy' | 'warning' | 'unknown',
              },
            ],
          },
        });
      });

      // Add the containers table
      newComponents.push({
        id: 'containers-list-table',
        component: 'data_table' as const,
        source: 'datadog',
        priority: 'low',
        timestamp: new Date().toISOString(),
        props: {
          title: 'All Containers',
          columns: [
            { key: 'name', label: 'Container' },
            { key: 'memory', label: 'Memory (MiB)' },
            { key: 'cpu', label: 'CPU %' },
          ],
          rows: containersData.containers.map((c: { name: string; memory: number | null; cpu: number | null }) => ({
            name: c.name,
            memory: c.memory ?? 'N/A',
            cpu: c.cpu !== null ? `${c.cpu}%` : 'N/A',
          })),
        },
      });

      setDashboardState({
        components: sortByPriority(newComponents),
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing ${containersData.count} containers. Loading AI insights...`,
      });
      setLastAction('containers');

      // Fetch AI interpretations for containers in background
      fetch(`/api/metrics/container-interpretations?timeWindow=${timeWindow}`)
        .then(res => res.json())
        .then(interpretationsData => {
          if (interpretationsData.error || !interpretationsData.interpretation) {
            // Remove loading state on error
            setDashboardState(prev => ({
              ...prev,
              components: prev.components.map(comp =>
                comp.id === 'running-containers-count' && comp.component === 'metric_card'
                  ? { ...comp, props: { ...comp.props, insightsLoading: false } }
                  : comp
              ),
            }));
            return;
          }

          // Update the running containers card with interpretation and insight
          setDashboardState(prev => {
            const updatedComponents = prev.components.map(comp => {
              if (comp.id === 'running-containers-count' && comp.component === 'metric_card') {
                return {
                  ...comp,
                  props: {
                    ...comp.props,
                    interpretation: interpretationsData.interpretation,
                    actionableInsights: interpretationsData.insight ? [interpretationsData.insight] : undefined,
                    insightsLoading: false,
                  },
                };
              }
              return comp;
            });

            return {
              ...prev,
              components: updatedComponents,
              agentMessage: `Showing ${containersData.count} containers with AI insights`,
            };
          });
        })
        .catch(err => {
          console.error('Failed to fetch container interpretations:', err);
          // Remove loading state on error
          setDashboardState(prev => ({
            ...prev,
            components: prev.components.map(comp =>
              comp.id === 'running-containers-count' && comp.component === 'metric_card'
                ? { ...comp, props: { ...comp.props, insightsLoading: false } }
                : comp
            ),
          }));
        });

    } catch (error) {
      console.error('Failed to fetch containers list:', error);
    }
  }, [timeWindow]);

  // Handler for System & Infrastructure (combines system metrics + uptime)
  const handleFetchSystemInfrastructure = useCallback(async () => {
    try {
      // Fetch system metrics (FAST) - uptime is now included in overview
      const metricsResponse = await fetch(`/api/metrics/overview/fast?timeWindow=${timeWindow}`);
      const metricsData = await metricsResponse.json();

      const newComponents: A2UIComponent[] = [];

      // Add system metrics with loading state for insights (skip metrics with no data)
      if (!metricsData.error) {
        metricsData.metrics
          .filter((metric: { currentValue: number | null }) => metric.currentValue !== null)
          .forEach((metric: {
            metric: string;
            displayName: string;
            currentValue: number;
            unit: string;
            status: string;
            change?: { value: number; direction: 'up' | 'down' | 'flat'; period: string };
          }) => {
            let displayValue: number | string = metric.currentValue;
            let displayUnit = metric.unit;

            // Format uptime specially
            if (metric.metric === 'system_uptime' && metric.currentValue) {
              displayValue = formatUptime(metric.currentValue);
              displayUnit = '';
            }
            // Format network bytes
            else if ((metric.metric === 'network_bytes_sent' || metric.metric === 'network_bytes_recv') && metric.currentValue) {
              const formatted = formatBytes(metric.currentValue);
              displayValue = formatted.value;
              displayUnit = formatted.unit;
            }

            // For CPU Idle, invert the status logic (lower is worse)
            let status = metric.status as 'healthy' | 'warning' | 'critical' | 'unknown';
            if (metric.metric === 'cpu_idle' && metric.currentValue !== null) {
              if (metric.currentValue < 10) status = 'critical';
              else if (metric.currentValue < 30) status = 'warning';
              else status = 'healthy';
            }

            newComponents.push({
              id: `system-metric-${metric.metric}`,
              component: 'metric_card' as const,
              source: 'datadog',
              priority: status === 'critical' ? 'critical' : status === 'warning' ? 'high' : 'medium',
              timestamp: new Date().toISOString(),
              props: {
                title: metric.displayName,
                value: displayValue,
                unit: displayUnit,
                status,
                description: `Current ${metric.displayName.toLowerCase()}`,
                change: metric.change,
                insightsLoading: true,  // Show skeleton while loading insights
              },
            });
          });
      }

      // Show metrics immediately (fast)
      setDashboardState({
        components: sortByPriority(newComponents),
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing system infrastructure metrics. Loading AI insights...`,
      });
      setLastAction('system');

      // Fetch AI interpretations in background (slower, but adds value)
      fetch(`/api/metrics/interpretations?timeWindow=${timeWindow}`)
        .then(res => res.json())
        .then(interpretationsData => {
          if (interpretationsData.error || !interpretationsData.interpretations) return;

          // Update components with interpretations and remove loading state
          setDashboardState(prev => {
            const updatedComponents = prev.components.map(comp => {
              if (comp.component !== 'metric_card') return comp;

              // Extract metric ID from component ID (e.g., 'system-metric-cpu_total' -> 'cpu_total')
              const metricId = comp.id.replace('system-metric-', '');
              const interp = interpretationsData.interpretations[metricId];

              if (interp) {
                return {
                  ...comp,
                  props: {
                    ...comp.props,
                    interpretation: interp.interpretation,
                    actionableInsights: interp.insight ? [interp.insight] : undefined,
                    insightsLoading: false,  // Done loading
                  },
                };
              }
              // Remove loading state even if no interpretation found
              return {
                ...comp,
                props: {
                  ...comp.props,
                  insightsLoading: false,
                },
              };
            });

            return {
              ...prev,
              components: updatedComponents,
              agentMessage: `System metrics with AI insights`,
            };
          });
        })
        .catch(err => {
          console.error('Failed to fetch interpretations:', err);
          // Remove loading state on error
          setDashboardState(prev => ({
            ...prev,
            components: prev.components.map(comp =>
              comp.component === 'metric_card'
                ? { ...comp, props: { ...comp.props, insightsLoading: false } }
                : comp
            ),
          }));
        });

    } catch (error) {
      console.error('Failed to fetch system infrastructure:', error);
    }
  }, [timeWindow]);

  // Handler for Automations (n8n workflow metrics)
  const handleFetchAutomations = useCallback(async () => {
    try {
      // Fetch both workflow metrics in parallel
      const [gmailResponse, imageGenResponse] = await Promise.all([
        fetch(`/api/metrics/n8n/gmail-filter?timeWindow=${timeWindow}`),
        fetch(`/api/metrics/n8n/image-generator?timeWindow=${timeWindow}`),
      ]);

      const gmailData = await gmailResponse.json();
      const imageGenData = await imageGenResponse.json();

      const newComponents: A2UIComponent[] = [];

      // Helper to determine status from success rate
      const getStatusFromRate = (rate: number): 'healthy' | 'warning' | 'critical' => {
        if (rate >= 95) return 'healthy';
        if (rate >= 80) return 'warning';
        return 'critical';
      };

      // Add Gmail Filter as CardGroup
      if (!gmailData.error) {
        const total = gmailData.metrics.successful + gmailData.metrics.failed;
        const rate = gmailData.metrics.successRate;
        newComponents.push({
          id: 'automation-gmail-filter',
          component: 'card_group' as const,
          source: 'datadog',
          priority: gmailData.metrics.failed > 0 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: 'Gmail Filter',
            status: getStatusFromRate(rate),
            description: `Runs every 5 minutes to filter incoming emails. ${total} executions in the last 24h with ${rate}% success rate.`,
            metrics: [
              { label: 'Successful', value: gmailData.metrics.successful, status: 'healthy' as const },
              { label: 'Failed', value: gmailData.metrics.failed, status: gmailData.metrics.failed > 0 ? 'warning' as const : 'healthy' as const },
              { label: 'Success Rate', value: rate, unit: '%', status: getStatusFromRate(rate) },
              { label: 'Total Runs', value: total, status: 'healthy' as const },
            ],
          },
        });
      }

      // Add Image Generator as CardGroup
      if (!imageGenData.error) {
        const total = imageGenData.metrics.successful + imageGenData.metrics.failed;
        const rate = imageGenData.metrics.successRate;
        newComponents.push({
          id: 'automation-image-generator',
          component: 'card_group' as const,
          source: 'datadog',
          priority: imageGenData.metrics.failed > 0 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: 'Image Generator',
            status: getStatusFromRate(rate),
            description: `Triggered on-demand to generate images via AI. ${total} executions in the last 24h with ${rate}% success rate.`,
            metrics: [
              { label: 'Successful', value: imageGenData.metrics.successful, status: 'healthy' as const },
              { label: 'Failed', value: imageGenData.metrics.failed, status: imageGenData.metrics.failed > 0 ? 'warning' as const : 'healthy' as const },
              { label: 'Success Rate', value: rate, unit: '%', status: getStatusFromRate(rate) },
              { label: 'Total Runs', value: total, status: 'healthy' as const },
            ],
          },
        });
      }

      setDashboardState({
        components: sortByPriority(newComponents),
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing ${newComponents.length} automation workflows`,
      });
      setLastAction('automations');
    } catch (error) {
      console.error('Failed to fetch automations:', error);
    }
  }, [timeWindow]);

  // Handler for navigating to commands screen
  const handleShowCommands = useCallback(() => {
    setCurrentView('commands');
  }, []);

  // Handler for going back to home
  const handleBackToHome = useCallback(() => {
    setCurrentView('home');
    setDashboardState({
      components: [],
      lastUpdated: new Date().toISOString(),
    });
  }, []);

  // Define shortcuts for the welcome screen
  const shortcuts = [
    {
      id: 'system-infrastructure',
      title: 'System & Infrastructure',
      description: 'Uptime, CPU, memory, load, and disk usage',
      icon: <Server className="w-6 h-6" />,
      onClick: handleFetchSystemInfrastructure,
    },
    {
      id: 'containers',
      title: 'Containers',
      description: 'View all running containers with metrics',
      icon: <Container className="w-6 h-6" />,
      onClick: handleFetchContainersList,
    },
    {
      id: 'automations',
      title: 'Automations',
      description: 'n8n workflow execution metrics',
      icon: <Workflow className="w-6 h-6" />,
      onClick: handleFetchAutomations,
    },
    {
      id: 'commands',
      title: 'Commands',
      description: 'System commands and actions',
      icon: <Terminal className="w-6 h-6" />,
      onClick: handleShowCommands,
    },
  ];

  return (
    <div ref={containerRef} className="flex flex-col h-screen text-text-primary relative">
      {/* Blurred gradient background */}
      <BlurBackground />

      {/* Full-width Header */}
      <header className="h-14 border-b border-surface-3/50 flex items-center justify-between px-6 bg-white/70 backdrop-blur-sm relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToHome}
            disabled={dashboardState.components.length === 0 && currentView === 'home'}
            className={`p-2 rounded transition-all mr-2 ${
              dashboardState.components.length > 0 || currentView !== 'home'
                ? 'text-accent-primary hover:bg-accent-primary/10 cursor-pointer'
                : 'text-text-muted cursor-not-allowed opacity-30'
            }`}
            title="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <VennDiagramIcon className="w-8 h-8 text-accent-primary" />
          <h1 className="text-lg font-sans font-normal">
            <span className="gradient-text">Generative UI</span> Example
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Time Window Selector */}
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white/70 border border-white/50 rounded-lg text-text-primary hover:bg-white/90 hover:border-accent-primary/50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
          >
            <option value="5m">Past 5 Minutes</option>
            <option value="15m">Past 15 Minutes</option>
            <option value="30m">Past 30 Minutes</option>
            <option value="1h">Past 1 Hour</option>
            <option value="4h">Past 4 Hours</option>
            <option value="1d">Past 1 Day</option>
            <option value="2d">Past 2 Days</option>
            <option value="1w">Past 1 Week</option>
            <option value="1mo">Past 1 Month</option>
          </select>
          <span className="text-xs text-text-muted font-mono">
            {dashboardState.components.length} components
          </span>
        </div>
      </header>

      {/* Main content area with dashboard and chat side by side */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Dashboard Canvas */}
        <main className="flex-1 overflow-auto p-6">
          <DashboardCanvas
            state={dashboardState}
            shortcuts={shortcuts}
            currentView={currentView}
            onBack={handleBackToHome}
            onCommandClick={handleCommandClick}
          />
        </main>

        {/* Resizable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-surface-3/50 hover:bg-accent-primary cursor-col-resize transition-colors flex-shrink-0"
        />

        {/* Chat Panel */}
        <div
          className="flex flex-col bg-white/50 backdrop-blur-sm overflow-hidden flex-shrink-0"
          style={{ width: chatWidth }}
        >
          <div className="flex-1 overflow-hidden">
            <CopilotChat
              labels={{
                initial: 'Ask me about your system metrics, or say "show me a dashboard" to get started.',
                placeholder: 'Ask about CPU, memory, containers...',
              }}
              suggestions={[
                { title: 'System metrics', message: 'Show all system metrics' },
                { title: 'Container status', message: 'Which containers are running?' },
                { title: 'Workflow health', message: 'Are my n8n workflows healthy?' },
                { title: 'Disk space', message: 'How much disk space is left?' },
                { title: 'Memory usage', message: 'Show me memory usage' },
                { title: 'CPU stats', message: 'What is the current CPU usage?' },
              ]}
              className="h-full"
            />
          </div>
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
