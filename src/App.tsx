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
        setCurrentView('home');

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
        const response = await fetch('/api/metrics/running-containers');
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
        const response = await fetch(`/api/metrics/container/${encodeURIComponent(containerName as string)}/memory`);
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
        const response = await fetch('/api/metrics/n8n/gmail-filter');
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
        const response = await fetch('/api/metrics/n8n/image-generator');
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

  // Action to fetch running containers list as a table
  useCopilotAction({
    name: 'fetchContainersList',
    description: 'Fetch a table showing all running Docker containers with their memory and CPU usage. Use this when the user asks to see all containers, list containers, or wants a containers table/overview.',
    parameters: [],
    handler: async () => {
      try {
        const response = await fetch('/api/metrics/containers-list');
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
        fetch('/api/metrics/containers-list'),
        fetch('/api/metrics/running-containers'),
      ]);

      const containersData = await containersResponse.json();
      const countData = await countResponse.json();

      if (containersData.error) return;

      const newComponents: A2UIComponent[] = [];

      // Add running containers count card
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
            status: 'healthy' as const,
            description: 'Total active containers',
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

      // Add individual container metric cards for CPU and memory
      containersData.containers.forEach((container: { name: string; memory: number | null; cpu: number | null }) => {
        // CPU card for each container
        if (container.cpu !== null) {
          const cpuStatus = container.cpu >= 80 ? 'critical' : container.cpu >= 50 ? 'warning' : 'healthy';
          newComponents.push({
            id: `container-${container.name}-cpu`,
            component: 'metric_card' as const,
            source: 'datadog',
            priority: cpuStatus === 'critical' ? 'critical' : cpuStatus === 'warning' ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: `${container.name} CPU`,
              value: container.cpu,
              unit: '%',
              status: cpuStatus as 'healthy' | 'warning' | 'critical',
              description: `CPU usage for ${container.name}`,
            },
          });
        }

        // Memory card for each container
        if (container.memory !== null) {
          const memStatus = container.memory >= 1024 ? 'warning' : 'healthy';
          newComponents.push({
            id: `container-${container.name}-memory`,
            component: 'metric_card' as const,
            source: 'datadog',
            priority: memStatus === 'warning' ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: `${container.name} Memory`,
              value: container.memory,
              unit: 'MiB',
              status: memStatus as 'healthy' | 'warning',
              description: `Memory usage for ${container.name}`,
            },
          });
        }
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
        agentMessage: `Showing ${containersData.count} containers with individual metrics`,
      });
    } catch (error) {
      console.error('Failed to fetch containers list:', error);
    }
  }, []);

  // Handler for System & Infrastructure (combines system metrics + uptime)
  const handleFetchSystemInfrastructure = useCallback(async () => {
    try {
      // Fetch both system metrics and uptime in parallel
      const [metricsResponse, uptimeResponse] = await Promise.all([
        fetch('/api/metrics/overview'),
        fetch('/api/metrics/uptime'),
      ]);

      const metricsData = await metricsResponse.json();
      const uptimeData = await uptimeResponse.json();

      const newComponents: A2UIComponent[] = [];

      // Add uptime first
      if (!uptimeData.error || uptimeData.currentValue) {
        newComponents.push({
          id: 'system-uptime',
          component: 'metric_card' as const,
          source: 'datadog',
          priority: 'low',
          timestamp: new Date().toISOString(),
          props: {
            title: uptimeData.displayName,
            value: uptimeData.currentValue,
            unit: uptimeData.unit,
            status: uptimeData.status as 'healthy' | 'warning' | 'critical' | 'unknown',
            description: 'Time since last system restart',
          },
        });
      }

      // Add system metrics
      if (!metricsData.error) {
        metricsData.metrics.forEach((metric: {
          metric: string;
          displayName: string;
          currentValue: number;
          unit: string;
          status: string;
          change?: { value: number; direction: 'up' | 'down' | 'flat'; period: string };
        }) => {
          newComponents.push({
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
          });
        });
      }

      setDashboardState({
        components: sortByPriority(newComponents),
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing system infrastructure metrics`,
      });
    } catch (error) {
      console.error('Failed to fetch system infrastructure:', error);
    }
  }, []);

  // Handler for Automations (n8n workflow metrics)
  const handleFetchAutomations = useCallback(async () => {
    try {
      // Fetch both workflow metrics in parallel
      const [gmailResponse, imageGenResponse] = await Promise.all([
        fetch('/api/metrics/n8n/gmail-filter'),
        fetch('/api/metrics/n8n/image-generator'),
      ]);

      const gmailData = await gmailResponse.json();
      const imageGenData = await imageGenResponse.json();

      const newComponents: A2UIComponent[] = [];

      // Add Gmail Filter metrics
      if (!gmailData.error) {
        newComponents.push(
          {
            id: 'gmail-filter-success',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Gmail Filter: Successful',
              value: gmailData.metrics.successful,
              unit: '',
              status: 'healthy' as const,
              description: 'Successful executions (24h)',
            },
          },
          {
            id: 'gmail-filter-failed',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: gmailData.metrics.failed > 0 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Gmail Filter: Failed',
              value: gmailData.metrics.failed,
              unit: '',
              status: gmailData.metrics.failed > 0 ? 'warning' as const : 'healthy' as const,
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
              value: gmailData.metrics.successRate,
              unit: '%',
              status: gmailData.metrics.successRate >= 95 ? 'healthy' as const : gmailData.metrics.successRate >= 80 ? 'warning' as const : 'critical' as const,
              description: 'Success rate (24h)',
            },
          }
        );
      }

      // Add Image Generator metrics
      if (!imageGenData.error) {
        newComponents.push(
          {
            id: 'image-gen-success',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Image Generator: Successful',
              value: imageGenData.metrics.successful,
              unit: '',
              status: 'healthy' as const,
              description: 'Successful executions (24h)',
            },
          },
          {
            id: 'image-gen-failed',
            component: 'metric_card' as const,
            source: 'datadog',
            priority: imageGenData.metrics.failed > 0 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Image Generator: Failed',
              value: imageGenData.metrics.failed,
              unit: '',
              status: imageGenData.metrics.failed > 0 ? 'warning' as const : 'healthy' as const,
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
              value: imageGenData.metrics.successRate,
              unit: '%',
              status: imageGenData.metrics.successRate >= 95 ? 'healthy' as const : imageGenData.metrics.successRate >= 80 ? 'warning' as const : 'critical' as const,
              description: 'Success rate (24h)',
            },
          }
        );
      }

      setDashboardState({
        components: sortByPriority(newComponents),
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing automation workflow metrics`,
      });
    } catch (error) {
      console.error('Failed to fetch automations:', error);
    }
  }, []);

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
