import { useState, useCallback, useRef, useEffect } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { DashboardCanvas } from './components/DashboardCanvas';
import { BlurBackground } from './components/BlurBackground';
import { A2UIComponent, DashboardState, sortByPriority } from './types/a2ui';
import { useCopilotAction, useCopilotReadable, useCopilotChat } from '@copilotkit/react-core';
import { TextMessage, MessageRole } from '@copilotkit/runtime-client-gql';
import { Server, Container, Workflow, ArrowLeft, Rocket, DollarSign, Activity } from 'lucide-react';
import deploymentsData from './data/deployments.json';
import routingConfig from './config/widget-routing.json';
import { useVoiceDictation } from './hooks/useVoiceDictation';
import { VoiceButton } from './components/VoiceButton';
import { VoiceOverlay } from './components/VoiceOverlay';
import { mcpClient } from './services/mcp-client';
import { getCachedInsight, setCachedInsight } from './utils/insights-cache';
import { useWidgetLoader } from './hooks/useWidgetLoader';
import { RouteMatch } from './services/utterance-router';

function DashboardWithAgent() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    components: [],
    lastUpdated: new Date().toISOString(),
  });
  const [currentView, setCurrentView] = useState<'home' | 'commands' | 'loading' | 'landing'>('landing');
  const [chatWidth, setChatWidth] = useState(400);
  const [timeWindow, setTimeWindow] = useState('4h');
  const [lastAction, setLastAction] = useState<'system' | 'containers' | 'automations' | null>(null);
  const [statusSummary, setStatusSummary] = useState<string | null>(null);
  const [statusSummaryLoading, setStatusSummaryLoading] = useState(true);
  const [pendingRoute, setPendingRoute] = useState<RouteMatch | null>(null);
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

  // Loading timeout recovery - prevents UI from getting stuck in loading state
  useEffect(() => {
    if (currentView === 'loading') {
      const timeout = setTimeout(() => {
        console.warn('[LoadingTimeout] Loading state exceeded 30s, returning to landing page');
        setCurrentView('landing');
      }, 30000); // 30 second timeout
      return () => clearTimeout(timeout);
    }
  }, [currentView]);

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

  // Fetch status summary on mount
  useEffect(() => {
    const fetchStatusSummary = async () => {
      setStatusSummaryLoading(true);
      try {
        // Fetch data from all sources in parallel
        const [containersData, systemData, costsData] = await Promise.all([
          mcpClient.getRunningContainers(timeWindow).catch(() => ({ error: true })),
          mcpClient.getOverviewFast(timeWindow).catch(() => ({ error: true })),
          mcpClient.getCostsOverview().catch(() => ({ error: true })),
        ]);

        // Build natural sentence parts
        const summaryParts: string[] = [];

        // System health assessment
        let systemHealthy = true;
        if (!systemData.error && systemData.metrics) {
          const cpu = systemData.metrics.find((m: { name: string; value: number }) => m.name === 'cpu');
          const memory = systemData.metrics.find((m: { name: string; value: number }) => m.name === 'memory');
          if (cpu && typeof cpu.value === 'number' && cpu.value > 80) systemHealthy = false;
          if (memory && typeof memory.value === 'number' && memory.value > 85) systemHealthy = false;
        }

        // Containers
        let containerCount = 0;
        if (!containersData.error && containersData.currentValue !== undefined) {
          containerCount = containersData.currentValue;
        }

        // Costs
        let costInfo = '';
        if (!costsData.error && costsData.aws && !costsData.aws.error) {
          const cost = costsData.aws.totalCost;
          const forecast = costsData.aws.forecast?.amount;
          if (forecast) {
            costInfo = `$${cost.toFixed(2)} spent so far this month with a forecast of $${forecast.toFixed(2)}`;
          } else {
            costInfo = `$${cost.toFixed(2)} spent so far this month`;
          }
        }

        // Build natural sentence
        const healthStatus = systemHealthy ? 'System health is good' : 'System health needs attention';

        if (containerCount > 0) {
          const containerWord = containerCount === 1 ? 'container' : 'containers';
          summaryParts.push(`${containerCount} ${containerWord} running smoothly`);
        }

        if (costInfo) {
          summaryParts.push(costInfo);
        }

        if (summaryParts.length === 0) {
          setStatusSummary(`${healthStatus}, but unable to fetch detailed metrics.`);
        } else {
          const details = summaryParts.join(', ');
          setStatusSummary(`${healthStatus}, with ${details}.`);
        }
      } catch (error) {
        setStatusSummary(`Unable to fetch system status: ${error}`);
      } finally {
        setStatusSummaryLoading(false);
      }
    };

    fetchStatusSummary();
  }, []); // Run once on mount

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

  // Make routing configuration readable by the agent
  useCopilotReadable({
    description: 'Widget routing configuration that maps user utterances to dashboard actions and widgets. Use this to understand which action to call based on user queries. Each route contains keywords, patterns, and question forms that indicate user intent.',
    value: routingConfig,
  });

  // Hook for programmatic chat messaging
  const { appendMessage } = useCopilotChat();

  // Widget loader - handles utterance routing and dynamic widget loading
  // NOTE: Defined early so processUtterance is available for handlers below
  const { processUtterance } = useWidgetLoader({
    onRouteMatch: (match: RouteMatch) => {
      console.log('[WidgetLoader] Route matched:', match);

      // Clear previous widgets before loading new ones
      setDashboardState({
        components: [],
        lastUpdated: new Date().toISOString(),
      });

      // Route to view
      if (match.view === 'landing') {
        setCurrentView('landing');
      } else {
        // Set pending route to trigger loading
        setPendingRoute(match);
        setCurrentView('loading');
      }
    },
    onRouteNotFound: (utterance: string) => {
      console.log('[WidgetLoader] No route found, falling back to chat:', utterance);
      // Fall back to sending the message to chat
      appendMessage(
        new TextMessage({
          role: MessageRole.User,
          content: utterance,
        })
      );
    },
    onLoadStart: () => {
      console.log('[WidgetLoader] Loading started');
      // Don't set loading here - let onRouteMatch handle view transitions
    },
    onLoadComplete: () => {
      console.log('[WidgetLoader] Loading completed');
    },
    autoLoadOverview: true, // Automatically load overview on mount
  });

  // Voice dictation hook - routes transcript through utterance router, then falls back to chat
  const handleVoiceTranscriptComplete = useCallback((transcript: string) => {
    if (transcript.trim()) {
      console.log('[handleVoiceTranscriptComplete] Processing transcript:', transcript);
      // Route through utterance router first - will load widgets if match found,
      // or fall back to chat via onRouteNotFound callback
      processUtterance(transcript);
    }
  }, [processUtterance]);

  const {
    voiceState,
    transcript,
    startListening,
    stopListening,
    isSupported: isVoiceSupported,
  } = useVoiceDictation({
    onTranscriptComplete: handleVoiceTranscriptComplete,
    onError: (error) => console.error('Voice error:', error),
  });

  // Handler for command clicks - sends query to chat
  const handleCommandClick = useCallback(async (query: string) => {
    console.log('[handleCommandClick] Sending query:', query);
    setCurrentView('loading'); // Show loading state while waiting
    try {
      await appendMessage(
        new TextMessage({
          role: MessageRole.User,
          content: query,
        })
      );
      console.log('[handleCommandClick] Message sent successfully');
    } catch (error) {
      console.error('[handleCommandClick] Error sending message:', error);
      // Recover from error by going back to landing page
      setCurrentView('landing');
    }
  }, [appendMessage]);

  // Handler for navigation from landing page
  const handleNavigate = useCallback((utterance: string) => {
    console.log('[handleNavigate] Processing utterance:', utterance);

    // Pass the utterance directly to the routing system
    // "back" is already a keyword in the overview route config
    processUtterance(utterance);
  }, [processUtterance]);

  // Handler for sending messages from landing page or chat - routes through utterance router first
  const handleSendMessage = useCallback((message: string) => {
    console.log('[handleSendMessage] Processing message:', message);
    // Route through utterance router first - will load widgets if match found,
    // or fall back to chat via onRouteNotFound callback
    processUtterance(message);
  }, [processUtterance]);

  // Helper function to check if widgets of a certain type are already loaded
  // Used to prevent duplicate widget loading when routing already loaded them
  const isWidgetTypeLoaded = useCallback((widgetPrefix: string): boolean => {
    return dashboardState.components.some((component) =>
      component.id.startsWith(widgetPrefix)
    );
  }, [dashboardState.components]);

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
      const compProps = (component as A2UIComponent).props as { title?: string };
      return `Added component: ${compProps?.title || (component as A2UIComponent).component || 'Unknown'}`;
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

  // Action to show Claude Usage widget
  useCopilotAction({
    name: 'showClaudeUsage',
    description: 'Show Claude usage statistics including subscription usage (5-hour window, daily costs) and API credits (balance, burn rate, runway). Use this when the user asks about Claude usage, API credits, token usage, or wants to see their Claude subscription status.',
    parameters: [],
    handler: async () => {
      // Check if Claude usage widgets are already loaded from routing
      if (currentView === 'home' && (isWidgetTypeLoaded('claude-usage-widget') || isWidgetTypeLoaded('anthropic-usage-widget'))) {
        console.log('[showClaudeUsage] Claude usage already loaded, skipping duplicate load');
        return 'Claude usage is already displayed on the dashboard.';
      }

      const claudeUsageComponent: A2UIComponent = {
        id: 'claude-usage-widget',
        component: 'claude_usage' as const,
        source: 'claude-api',
        priority: 'high',
        timestamp: new Date().toISOString(),
        props: {
          claudeCode: null,
          apiCredits: null,
        },
      };
      const anthropicUsageComponent: A2UIComponent = {
        id: 'anthropic-usage-widget',
        component: 'anthropic_usage' as const,
        source: 'anthropic-admin-api',
        priority: 'high',
        timestamp: new Date().toISOString(),
        props: {
          tokenUsage: null,
        },
      };
      setDashboardState((prev) => ({
        ...prev,
        components: [
          claudeUsageComponent,
          anthropicUsageComponent,
          ...prev.components.filter(c => c.id !== 'claude-usage-widget' && c.id !== 'anthropic-usage-widget'),
        ],
        lastUpdated: new Date().toISOString(),
        agentMessage: 'Showing your Claude usage statistics',
      }));
      setCurrentView('home');
      return 'Displaying Claude usage widget with subscription and API credit information';
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
      // Check if system metrics are already loaded from routing
      if (currentView === 'home' && isWidgetTypeLoaded('system-metric-')) {
        console.log('[fetchSystemMetrics] System metrics already loaded, skipping duplicate load');
        return 'System metrics are already displayed on the dashboard.';
      }

      try {
        // Use MCP client (falls back to direct API if MCP tool not available)
        const data = await mcpClient.getOverviewFast(timeWindow);

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
    // Use MCP client (falls back to direct API if MCP tool not available)
    const data = await mcpClient.getContainerCPU(containerName, timeWindow);

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
        // Use MCP client (falls back to direct API if MCP tool not available)
        const data = await mcpClient.getUptime(timeWindow);

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
        // Use MCP client (falls back to direct API if MCP tool not available)
        const data = await mcpClient.getRunningContainers(timeWindow);

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
        // Use MCP client (falls back to direct API if MCP tool not available)
        const data = await mcpClient.getContainerMemory(containerName as string, timeWindow);

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
        // Use MCP client (falls back to direct API for richer data format)
        const data = await mcpClient.getGmailFilterMetrics(timeWindow);

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
        // Use MCP client (falls back to direct API for richer data format)
        const data = await mcpClient.getImageGeneratorMetrics(timeWindow);

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

  // Action to get automation count
  useCopilotAction({
    name: 'getAutomationCount',
    description: 'Get the total number of automations/workflows configured. Use this when the user asks "how many automations do I have" or "how many workflows".',
    parameters: [],
    handler: async () => {
      try {
        // Fetch both workflows to count them via MCP client
        const [gmailData, imageGenData] = await Promise.all([
          mcpClient.getGmailFilterMetrics(timeWindow),
          mcpClient.getImageGeneratorMetrics(timeWindow),
        ]);

        let count = 0;
        const workflows = [];

        if (!gmailData.error) {
          count++;
          workflows.push('Gmail Filter');
        }
        if (!imageGenData.error) {
          count++;
          workflows.push('Image Generator');
        }

        return `You have ${count} automation${count !== 1 ? 's' : ''}: ${workflows.join(', ')}`;
      } catch (error) {
        return `Failed to fetch automation count: ${error}`;
      }
    },
  });

  // Action to get total automation executions
  useCopilotAction({
    name: 'getTotalAutomationExecutions',
    description: 'Get the total number of times all automations have executed. Use this when the user asks "how many times have the automations executed" or "total automation runs".',
    parameters: [],
    handler: async () => {
      try {
        // Fetch workflow metrics via MCP client
        const [gmailData, imageGenData] = await Promise.all([
          mcpClient.getGmailFilterMetrics(timeWindow),
          mcpClient.getImageGeneratorMetrics(timeWindow),
        ]);

        const gmailTotal = gmailData.metrics?.allTimeTotal || 0;
        const imageGenTotal = imageGenData.metrics?.allTimeTotal || 0;
        const totalExecutions = gmailTotal + imageGenTotal;

        const breakdown = [];
        if (gmailTotal > 0) breakdown.push(`Gmail Filter: ${gmailTotal}`);
        if (imageGenTotal > 0) breakdown.push(`Image Generator: ${imageGenTotal}`);

        return `Total automation executions (30-day window): ${totalExecutions}\n\nBreakdown:\n${breakdown.join('\n')}`;
      } catch (error) {
        return `Failed to fetch automation executions: ${error}`;
      }
    },
  });

  // Action to calculate time saved by automations
  useCopilotAction({
    name: 'getTimeSavedByAutomations',
    description: 'Calculate the total time saved by all automations. Use this when the user asks "how much time have I saved with automation" or "time saved by workflows".',
    parameters: [],
    handler: async () => {
      try {
        // Fetch workflow metrics via MCP client
        const [gmailData, imageGenData] = await Promise.all([
          mcpClient.getGmailFilterMetrics(timeWindow),
          mcpClient.getImageGeneratorMetrics(timeWindow),
        ]);

        // Gmail Filter: 30 seconds per execution
        const gmailTotal = gmailData.metrics?.allTimeTotal || 0;
        const gmailSeconds = gmailTotal * 30;

        // Image Generator: 4 hours per successful execution
        const imageGenTotal = imageGenData.metrics?.allTimeTotal || 0;
        const imageGenSuccessRate = imageGenData.metrics?.successRate || 0;
        const imageGenSuccessful = Math.round(imageGenTotal * (imageGenSuccessRate / 100));
        const imageGenHours = imageGenSuccessful * 4;

        // Convert Gmail seconds to hours
        const gmailHours = gmailSeconds / 3600;
        const totalHours = gmailHours + imageGenHours;
        const totalDays = Math.floor(totalHours / 24);
        const remainingHours = Math.round(totalHours % 24);

        let timeString = '';
        if (totalDays > 0) {
          timeString = `${totalDays} day${totalDays !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
        } else {
          timeString = `${Math.round(totalHours)} hour${Math.round(totalHours) !== 1 ? 's' : ''}`;
        }

        return `Time saved by automations (30-day window): ${timeString}\n\nBreakdown:\n- Gmail Filter: ${Math.round(gmailHours)} hours (${gmailTotal} emails processed)\n- Image Generator: ${imageGenHours} hours (${imageGenSuccessful} images generated)`;
      } catch (error) {
        return `Failed to calculate time saved: ${error}`;
      }
    },
  });

  // Action to check for broken automations
  useCopilotAction({
    name: 'checkBrokenAutomations',
    description: 'Check if any automations are broken or have failures. Use this when the user asks "do I have any broken automations" or "are any workflows failing".',
    parameters: [],
    handler: async () => {
      try {
        // Fetch workflow metrics via MCP client
        const [gmailData, imageGenData] = await Promise.all([
          mcpClient.getGmailFilterMetrics(timeWindow),
          mcpClient.getImageGeneratorMetrics(timeWindow),
        ]);

        const issues = [];
        const gmailFailed = gmailData.metrics?.failed || 0;
        const gmailRate = gmailData.metrics?.successRate || 100;
        const imageGenFailed = imageGenData.metrics?.failed || 0;
        const imageGenRate = imageGenData.metrics?.successRate || 100;

        if (gmailFailed > 0 || gmailRate < 95) {
          issues.push(`⚠️ Gmail Filter: ${gmailFailed} failed executions, ${gmailRate}% success rate`);
        }
        if (imageGenFailed > 0 || imageGenRate < 95) {
          issues.push(`⚠️ Image Generator: ${imageGenFailed} failed executions, ${imageGenRate}% success rate`);
        }

        if (issues.length === 0) {
          return '✅ All automations are running smoothly with no failures!';
        } else {
          return `Found ${issues.length} automation${issues.length !== 1 ? 's' : ''} with issues:\n\n${issues.join('\n')}`;
        }
      } catch (error) {
        return `Failed to check automation status: ${error}`;
      }
    },
  });

  // Action to get next scheduled automation
  useCopilotAction({
    name: 'getNextScheduledAutomation',
    description: 'Get information about the next scheduled automation. Use this when the user asks "when is the next automation scheduled" or "next workflow run".',
    parameters: [],
    handler: async () => {
      try {
        // Fetch workflow metrics via MCP client
        const [gmailData, imageGenData] = await Promise.all([
          mcpClient.getGmailFilterMetrics(timeWindow),
          mcpClient.getImageGeneratorMetrics(timeWindow),
        ]);

        const schedules = [];

        // Gmail Filter runs every 5 minutes
        if (!gmailData.error && gmailData.metrics?.lastRunTimestamp) {
          const lastRun = new Date(gmailData.metrics.lastRunTimestamp);
          const nextRun = new Date(lastRun.getTime() + 5 * 60 * 1000);
          const now = new Date();
          const minutesUntil = Math.max(0, Math.round((nextRun.getTime() - now.getTime()) / 60000));

          schedules.push({
            name: 'Gmail Filter',
            schedule: 'Every 5 minutes',
            nextRun: nextRun,
            minutesUntil: minutesUntil,
          });
        }

        // Image Generator is triggered on-demand
        if (!imageGenData.error) {
          schedules.push({
            name: 'Image Generator',
            schedule: 'On-demand (webhook triggered)',
            nextRun: null,
            minutesUntil: null,
          });
        }

        if (schedules.length === 0) {
          return 'No automation schedule information available.';
        }

        let response = 'Automation Schedules:\n\n';
        schedules.forEach(sched => {
          if (sched.nextRun) {
            const time = sched.nextRun.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            response += `📅 ${sched.name}\n   Schedule: ${sched.schedule}\n   Next run: ${time} (in ${sched.minutesUntil} minute${sched.minutesUntil !== 1 ? 's' : ''})\n\n`;
          } else {
            response += `📅 ${sched.name}\n   Schedule: ${sched.schedule}\n\n`;
          }
        });

        return response;
      } catch (error) {
        return `Failed to fetch automation schedules: ${error}`;
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
      // Check if containers are already loaded from routing
      if (currentView === 'home' && (isWidgetTypeLoaded('containers-list-table') || isWidgetTypeLoaded('running-containers-count'))) {
        console.log('[fetchContainersList] Containers already loaded, skipping duplicate load');
        return 'Containers are already displayed on the dashboard.';
      }

      try {
        const data = await mcpClient.getContainersList(timeWindow);

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

  // Action to get a quick status summary across all systems
  useCopilotAction({
    name: 'getQuickStatusSummary',
    description: 'Get a quick one-sentence summary of the entire infrastructure status including containers, system health, and costs. Use this when the user asks for a quick status, overview, or wants to know how everything is running. Return ONLY the summary sentence, do not add any other commentary.',
    parameters: [],
    handler: async () => {
      try {
        // Fetch data from all sources in parallel
        const [containersData, systemData, costsData] = await Promise.all([
          mcpClient.getRunningContainers(timeWindow).catch(() => ({ error: true })),
          mcpClient.getOverviewFast(timeWindow).catch(() => ({ error: true })),
          mcpClient.getCostsOverview().catch(() => ({ error: true })),
        ]);

        // Build natural sentence parts
        const summaryParts: string[] = [];

        // System health assessment
        let systemHealthy = true;
        if (!systemData.error && systemData.metrics) {
          const cpu = systemData.metrics.find((m: { name: string; value: number }) => m.name === 'cpu');
          const memory = systemData.metrics.find((m: { name: string; value: number }) => m.name === 'memory');
          if (cpu && typeof cpu.value === 'number' && cpu.value > 80) systemHealthy = false;
          if (memory && typeof memory.value === 'number' && memory.value > 85) systemHealthy = false;
        }

        // Containers
        let containerCount = 0;
        if (!containersData.error && containersData.currentValue !== undefined) {
          containerCount = containersData.currentValue;
        }

        // Costs
        let costInfo = '';
        if (!costsData.error && costsData.aws && !costsData.aws.error) {
          const cost = costsData.aws.totalCost;
          const forecast = costsData.aws.forecast?.amount;
          if (forecast) {
            costInfo = `$${cost.toFixed(2)} spent so far this month with a forecast of $${forecast.toFixed(2)}`;
          } else {
            costInfo = `$${cost.toFixed(2)} spent so far this month`;
          }
        }

        // Build natural sentence
        const healthStatus = systemHealthy ? 'System health is good' : 'System health needs attention';

        if (containerCount > 0) {
          const containerWord = containerCount === 1 ? 'container' : 'containers';
          summaryParts.push(`${containerCount} ${containerWord} running smoothly`);
        }

        if (costInfo) {
          summaryParts.push(costInfo);
        }

        if (summaryParts.length === 0) {
          return `${healthStatus}, but unable to fetch detailed metrics.`;
        }

        // Construct final sentence
        const details = summaryParts.join(', ');
        return `${healthStatus}, with ${details}.`;
      } catch (error) {
        return `Unable to fetch system status: ${error}`;
      }
    },
  });

  // Action to fetch AWS costs overview
  useCopilotAction({
    name: 'fetchCostsOverview',
    description: 'Fetch AWS costs breakdown and display them on the dashboard. Use this when the user asks about AWS costs, cloud spending, infrastructure costs, or monthly billing.',
    parameters: [],
    handler: async () => {
      // Check if AWS costs are already loaded from routing
      if (currentView === 'home' && isWidgetTypeLoaded('aws-')) {
        console.log('[fetchCostsOverview] AWS costs already loaded, skipping duplicate load');
        return 'AWS costs are already displayed on the dashboard.';
      }

      try {
        const data = await mcpClient.getCostsOverview();

        const components: A2UIComponent[] = [];

        // Check if AWS data is available
        if (data.aws && !data.aws.error) {
          // Main cost metric card - 2 columns wide
          const costCard: A2UIComponent = {
            id: 'aws-total-cost',
            component: 'metric_card' as const,
            source: 'aws-cost-explorer',
            priority: 'high',
            timestamp: new Date().toISOString(),
            columnSpan: 2,
            props: {
              title: 'Current Month Cost',
              value: `$${data.aws.totalCost.toFixed(2)}`,
              unit: 'USD',
              size: 'xl' as const,
              status: 'healthy' as const,
              description: `${data.aws.period.start} to ${data.aws.period.end}`,
            },
          };
          components.push(costCard);

          // Forecast card if available - 2 columns wide
          if (data.forecast && data.forecast.forecastedCost > 0) {
            const forecastCard: A2UIComponent = {
              id: 'aws-forecast',
              component: 'metric_card' as const,
              source: 'aws-cost-explorer',
              priority: 'medium',
              timestamp: new Date().toISOString(),
              columnSpan: 2,
              props: {
                title: 'Forecasted Month End',
                value: `$${data.forecast.forecastedCost.toFixed(2)}`,
                unit: 'USD',
                size: 'xl' as const,
                status: 'healthy' as const,
                description: 'Estimated total for billing month',
              },
            };
            components.push(forecastCard);
          }

          // Service breakdown table - 4 columns wide (full width)
          if (data.aws.breakdown && data.aws.breakdown.length > 0) {
            const breakdownTable: A2UIComponent = {
              id: 'aws-cost-breakdown',
              component: 'data_table' as const,
              source: 'aws-cost-explorer',
              priority: 'medium',
              timestamp: new Date().toISOString(),
              columnSpan: 4,
              props: {
                title: 'Cost Breakdown by Service',
                columns: [
                  { key: 'name', label: 'Service' },
                  { key: 'cost', label: 'Cost (USD)' },
                  { key: 'percentage', label: '% of Total' },
                ],
                rows: data.aws.breakdown.map((item: { name: string; cost: number; percentage: number }) => ({
                  name: item.name,
                  cost: `$${item.cost.toFixed(2)}`,
                  percentage: `${item.percentage}%`,
                })),
              },
            };
            components.push(breakdownTable);
          }
        } else {
          // Show error message if AWS not configured
          const errorCard: A2UIComponent = {
            id: 'aws-cost-error',
            component: 'metric_card' as const,
            source: 'error',
            priority: 'high',
            timestamp: new Date().toISOString(),
            props: {
              title: 'AWS Costs',
              value: 'Not Configured',
              size: 'large' as const,
              status: 'critical' as const,
              description: data.aws?.error || 'AWS Cost Explorer not configured',
            },
          };
          components.push(errorCard);
        }

        setDashboardState({
          components,
          lastUpdated: new Date().toISOString(),
          agentMessage: data.aws && !data.aws.error
            ? `AWS costs for ${data.aws.period.start} to ${data.aws.period.end}: $${data.aws.totalCost.toFixed(2)}`
            : 'Unable to fetch AWS costs',
        });
        setCurrentView('home');

        return data.aws && !data.aws.error
          ? `Showing AWS costs: $${data.aws.totalCost.toFixed(2)} for current billing period`
          : 'Unable to fetch AWS costs - check configuration';
      } catch (error) {
        return `Failed to fetch costs: ${error}`;
      }
    },
  });

  // Action to fetch automation workflows status
  useCopilotAction({
    name: 'fetchAutomations',
    description: 'Fetch n8n automation workflow metrics and display them on the dashboard. Use this when the user asks about automations, workflows, n8n status, or wants to see automation health.',
    parameters: [],
    handler: async () => {
      // Check if automation workflows are already loaded from routing
      if (currentView === 'home' && isWidgetTypeLoaded('automation-')) {
        console.log('[fetchAutomations] Automation workflows already loaded, skipping duplicate load');
        return 'Automation workflows are already displayed on the dashboard.';
      }

      try {
        // Fetch both workflow metrics in parallel via MCP client
        const [gmailData, imageGenData] = await Promise.all([
          mcpClient.getGmailFilterMetrics(timeWindow),
          mcpClient.getImageGeneratorMetrics(timeWindow),
        ]);

        const newComponents: A2UIComponent[] = [];

        // Helper to determine status from success rate
        const getStatusFromRate = (rate: number): 'healthy' | 'warning' | 'critical' => {
          if (rate >= 95) return 'healthy';
          if (rate >= 80) return 'warning';
          return 'critical';
        };

        // Add Gmail Filter as CardGroup
        if (!gmailData.error) {
          const rate = gmailData.metrics.successRate;
          const allTime = gmailData.metrics.allTimeTotal || 0;

          newComponents.push({
            id: 'automation-gmail-filter',
            component: 'card_group' as const,
            source: 'datadog',
            priority: gmailData.metrics.failed > 0 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Gmail Filter',
              subtitle: '(filters bulk email as unread)',
              status: getStatusFromRate(rate),
              description: `${allTime} total executions with ${rate}% success rate`,
              metrics: [
                { label: 'Successful', value: gmailData.metrics.successful, status: 'healthy' as const },
                { label: 'Failed', value: gmailData.metrics.failed, status: gmailData.metrics.failed > 0 ? 'warning' as const : 'healthy' as const },
                { label: 'Success Rate', value: rate, unit: '%', status: getStatusFromRate(rate) },
              ],
            },
          });
        }

        // Add Image Generator as CardGroup
        if (!imageGenData.error) {
          const rate = imageGenData.metrics.successRate;
          const allTime = imageGenData.metrics.allTimeTotal || 0;

          newComponents.push({
            id: 'automation-image-generator',
            component: 'card_group' as const,
            source: 'datadog',
            priority: imageGenData.metrics.failed > 0 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            props: {
              title: 'Image Generator',
              subtitle: '(generates custom illustrations)',
              status: getStatusFromRate(rate),
              description: `${allTime} total executions with ${rate}% success rate`,
              metrics: [
                { label: 'Successful', value: imageGenData.metrics.successful, status: 'healthy' as const },
                { label: 'Failed', value: imageGenData.metrics.failed, status: imageGenData.metrics.failed > 0 ? 'warning' as const : 'healthy' as const },
                { label: 'Success Rate', value: rate, unit: '%', status: getStatusFromRate(rate) },
              ],
            },
          });
        }

        setDashboardState({
          components: sortByPriority(newComponents),
          lastUpdated: new Date().toISOString(),
          agentMessage: `Showing ${newComponents.length} automation workflows`,
        });
        setCurrentView('home');

        return `Showing ${newComponents.length} automation workflows`;
      } catch (error) {
        return `Failed to fetch automations: ${error}`;
      }
    },
  });

  // Shortcut handlers for the welcome screen
  const handleFetchContainersList = useCallback(async () => {
    try {
      // Fetch containers list, running count, and ECR summary in parallel via MCP client
      const [containersData, countData, ecrData] = await Promise.all([
        mcpClient.getContainersList(timeWindow),
        mcpClient.getRunningContainers(timeWindow),
        mcpClient.getECRSummary().catch(() => ({ error: true })),
      ]);

      if (containersData.error) return;

      const newComponents: A2UIComponent[] = [];

      // Add ECR Summary card FIRST with high priority so it appears at the top
      if (!ecrData.error && ecrData.repositoryCount !== undefined) {
        // Generate observations based on ECR data
        const observations: string[] = [];
        const totalImages = ecrData.repositories.reduce(
          (sum: number, repo: { totalImages: number }) => sum + repo.totalImages,
          0
        );
        observations.push(`${totalImages} total images across ${ecrData.repositoryCount} repositories`);

        // Check for repos with many images
        const largeRepos = ecrData.repositories.filter(
          (repo: { totalImages: number }) => repo.totalImages > 10
        );
        if (largeRepos.length > 0) {
          observations.push(
            `${largeRepos.length} ${largeRepos.length === 1 ? 'repository has' : 'repositories have'} more than 10 images`
          );
        }

        // Check for recently pushed images
        const recentPushes = ecrData.repositories.filter((repo: { recentImages: Array<{ pushed: string }> }) =>
          repo.recentImages.some((img) => {
            const pushDate = new Date(img.pushed);
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return pushDate > dayAgo;
          })
        );
        if (recentPushes.length > 0) {
          observations.push(`${recentPushes.length} ${recentPushes.length === 1 ? 'repository' : 'repositories'} with images pushed in the last 24 hours`);
        }

        // Generate suggestion
        let suggestion: string | undefined;
        if (largeRepos.length > 0) {
          suggestion = 'Consider setting up lifecycle policies to automatically clean up old, untagged images';
        } else if (ecrData.repositoryCount > 0 && totalImages === 0) {
          suggestion = 'No images found. Push your first container image to get started';
        }

        newComponents.push({
          id: 'ecr-summary',
          component: 'ecr_summary' as const,
          source: 'aws-ecr',
          priority: 'high',  // High priority to show at the top
          timestamp: new Date().toISOString(),
          columnSpan: 2,
          props: {
            repositoryCount: ecrData.repositoryCount,
            repositories: ecrData.repositories,
            observations,
            suggestion,
          },
        });
      }

      // Add running containers count card with loading state for insights
      if (!countData.error) {
        const containersComponentId = 'running-containers-count';
        const cachedContainerInsight = getCachedInsight(containersComponentId);

        newComponents.push({
          id: containersComponentId,
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
            // If we have cached insights, show them immediately with stale indicator
            interpretation: cachedContainerInsight?.interpretation,
            actionableInsights: cachedContainerInsight?.actionableInsights,
            insightsLoading: !cachedContainerInsight,  // Only show skeleton if no cached data
            insightsStale: !!cachedContainerInsight,   // Show shimmer if using cached data
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

      // Add container groups - each container gets a card with CPU, Memory, and Restarts
      containersData.containers.forEach((container: { name: string; memory: number | null; cpu: number | null; restarts: number | null }) => {
        const cpuStatus: 'healthy' | 'warning' | 'critical' | 'unknown' = container.cpu !== null
          ? (container.cpu >= 80 ? 'critical' : container.cpu >= 50 ? 'warning' : 'healthy')
          : 'unknown';
        const memStatus: 'healthy' | 'warning' | 'critical' | 'unknown' = container.memory !== null
          ? (container.memory >= 2048 ? 'critical' : container.memory >= 1024 ? 'warning' : 'healthy')
          : 'unknown';
        const restartStatus: 'healthy' | 'warning' | 'critical' | 'unknown' = container.restarts !== null
          ? (container.restarts >= 10 ? 'critical' : container.restarts >= 3 ? 'warning' : 'healthy')
          : 'unknown';

        // Overall status is the worst of CPU or Memory
        const overallStatus: 'healthy' | 'warning' | 'critical' = cpuStatus === 'critical' || memStatus === 'critical' || restartStatus === 'critical'
          ? 'critical'
          : cpuStatus === 'warning' || memStatus === 'warning' || restartStatus === 'warning'
            ? 'warning'
            : 'healthy';

        const restartInsight = restartStatus !== 'healthy' && restartStatus !== 'unknown'
          ? `Restarted ${container.restarts} times — check logs and health checks.`
          : undefined;

        newComponents.push({
          id: `container-group-${container.name}`,
          component: 'card_group' as const,
          source: 'datadog',
          priority: overallStatus === 'critical' ? 'critical' : overallStatus === 'warning' ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: container.name,
            status: overallStatus as 'healthy' | 'warning' | 'critical',
            insight: restartInsight,
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
              {
                label: 'Restarts',
                value: container.restarts === null ? 'None' : container.restarts,
                unit: '',
                status: restartStatus as 'healthy' | 'warning' | 'critical' | 'unknown',
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
            { key: 'restarts', label: 'Restarts' },
          ],
          rows: containersData.containers.map((c: { name: string; memory: number | null; cpu: number | null; restarts: number | null }) => ({
            name: c.name,
            memory: c.memory ?? 'N/A',
            cpu: c.cpu !== null ? `${c.cpu}%` : 'N/A',
            restarts: c.restarts === null ? 'None' : c.restarts,
          })),
        },
      });

      setDashboardState({
        components: sortByPriority(newComponents),
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing ${containersData.count} containers. Loading AI insights...`,
      });
      setCurrentView('home');
      setLastAction('containers');

      // Fetch AI interpretations for containers in background (always use 1h to avoid LangFlow timeouts)
      mcpClient.getContainerInterpretations('1h')
        .then(interpretationsData => {
          if (interpretationsData.error || !interpretationsData.interpretation) {
            // Remove loading/stale state on error (keep cached content visible)
            setDashboardState(prev => ({
              ...prev,
              components: prev.components.map(comp =>
                comp.id === 'running-containers-count' && comp.component === 'metric_card'
                  ? { ...comp, props: { ...comp.props, insightsLoading: false, insightsStale: false } }
                  : comp
              ),
            }));
            return;
          }

          // Cache the fresh insight for future use
          setCachedInsight('running-containers-count', {
            interpretation: interpretationsData.interpretation,
            actionableInsights: interpretationsData.insight ? [interpretationsData.insight] : undefined,
          });

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
                    insightsStale: false,  // Fresh data, not stale
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
          // Remove loading/stale state on error (keep cached content visible)
          setDashboardState(prev => ({
            ...prev,
            components: prev.components.map(comp =>
              comp.id === 'running-containers-count' && comp.component === 'metric_card'
                ? { ...comp, props: { ...comp.props, insightsLoading: false, insightsStale: false } }
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
      // Fetch system metrics (FAST) via MCP client - uptime is now included in overview
      const metricsData = await mcpClient.getOverviewFast(timeWindow);

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

            const componentId = `system-metric-${metric.metric}`;
            const cachedInsight = getCachedInsight(componentId);

            newComponents.push({
              id: componentId,
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
                // If we have cached insights, show them immediately with stale indicator
                interpretation: cachedInsight?.interpretation,
                actionableInsights: cachedInsight?.actionableInsights,
                insightsLoading: !cachedInsight,  // Only show skeleton if no cached data
                insightsStale: !!cachedInsight,   // Show shimmer if using cached data
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
      setCurrentView('home');
      setLastAction('system');

      // Fetch AI interpretations in background (always use 1h to avoid LangFlow timeouts)
      mcpClient.getInterpretations('1h')
        .then(interpretationsData => {
          if (interpretationsData.error || !interpretationsData.interpretations) {
            // Clear loading/stale state even on error/empty response (keep cached content visible)
            setDashboardState(prev => ({
              ...prev,
              components: prev.components.map(comp =>
                comp.component === 'metric_card'
                  ? { ...comp, props: { ...comp.props, insightsLoading: false, insightsStale: false } }
                  : comp
              ),
            }));
            return;
          }

          // Update components with interpretations and remove loading/stale state
          setDashboardState(prev => {
            const updatedComponents = prev.components.map(comp => {
              if (comp.component !== 'metric_card') return comp;

              // Extract metric ID from component ID (e.g., 'system-metric-cpu_total' -> 'cpu_total')
              const metricId = comp.id.replace('system-metric-', '');
              const interp = interpretationsData.interpretations[metricId];

              if (interp) {
                // Cache the fresh insight for future use
                setCachedInsight(comp.id, {
                  interpretation: interp.interpretation,
                  actionableInsights: interp.insight ? [interp.insight] : undefined,
                });

                return {
                  ...comp,
                  props: {
                    ...comp.props,
                    interpretation: interp.interpretation,
                    actionableInsights: interp.insight ? [interp.insight] : undefined,
                    insightsLoading: false,  // Done loading
                    insightsStale: false,    // Fresh data, not stale
                  },
                };
              }
              // Remove loading/stale state even if no interpretation found
              return {
                ...comp,
                props: {
                  ...comp.props,
                  insightsLoading: false,
                  insightsStale: false,
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
          // Remove loading/stale state on error (keep cached content visible)
          setDashboardState(prev => ({
            ...prev,
            components: prev.components.map(comp =>
              comp.component === 'metric_card'
                ? { ...comp, props: { ...comp.props, insightsLoading: false, insightsStale: false } }
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
      // Fetch both workflow metrics in parallel via MCP client
      const [gmailData, imageGenData] = await Promise.all([
        mcpClient.getGmailFilterMetrics(timeWindow),
        mcpClient.getImageGeneratorMetrics(timeWindow),
      ]);

      const newComponents: A2UIComponent[] = [];

      // Helper to determine status from success rate
      const getStatusFromRate = (rate: number): 'healthy' | 'warning' | 'critical' => {
        if (rate >= 95) return 'healthy';
        if (rate >= 80) return 'warning';
        return 'critical';
      };

      // Add Gmail Filter as CardGroup
      if (!gmailData.error) {
        const total = gmailData.metrics.totalExecutions || gmailData.metrics.successful + gmailData.metrics.failed;
        const rate = gmailData.metrics.successRate;
        const allTime = gmailData.metrics.allTimeTotal || 0;

        // Calculate time saved (30 seconds per successful execution) - using 30-day rolling window
        const emailsProcessed30d = allTime; // allTimeTotal is actually 30-day total from backend
        const secondsSaved = emailsProcessed30d * 30;
        const minutesSaved = Math.floor(secondsSaved / 60);
        const hoursSaved = Math.floor(minutesSaved / 60);
        const remainingMinutes = minutesSaved % 60;

        let timeSavedText = '';
        if (hoursSaved > 0) {
          timeSavedText = remainingMinutes > 0
            ? `${hoursSaved} hour${hoursSaved !== 1 ? 's' : ''} ${remainingMinutes} min`
            : `${hoursSaved} hour${hoursSaved !== 1 ? 's' : ''}`;
        } else if (minutesSaved > 0) {
          timeSavedText = `${minutesSaved} min`;
        } else {
          timeSavedText = `${secondsSaved} sec`;
        }

        const timeSavedInsight = `${emailsProcessed30d} email${emailsProcessed30d !== 1 ? 's' : ''} converted to unread in last 30 days, saving you ${timeSavedText}`;

        // Get trend data from backend (if available)
        const successRateTrend = gmailData.metrics.trend || { direction: 'flat' as const, value: 0 };
        const runtime = gmailData.metrics.avgRuntime;
        const lastRunTimestamp = gmailData.metrics.lastRunTimestamp;

        // Build metrics array
        const metricsArray: Array<{
          label: string;
          value: number | string;
          unit?: string;
          status?: 'healthy' | 'warning' | 'critical' | 'unknown';
          trend?: { direction: 'up' | 'down' | 'flat'; value?: number };
        }> = [
          {
            label: 'Successful Executions',
            value: gmailData.metrics.successful,
            status: 'healthy',
            trend: { direction: successRateTrend.direction === 'up' ? 'up' : successRateTrend.direction === 'down' ? 'down' : 'flat' }
          },
          {
            label: 'Failed Executions',
            value: gmailData.metrics.failed,
            status: gmailData.metrics.failed > 0 ? 'warning' : 'healthy',
            trend: { direction: gmailData.metrics.failed > 0 ? 'up' : 'flat' }
          },
          {
            label: 'Success Rate',
            value: rate,
            unit: '%',
            status: getStatusFromRate(rate),
            trend: successRateTrend
          },
          { label: 'Total Times Run', value: allTime, status: 'healthy' },
        ];

        // Only add runtime metric if we have data
        if (runtime !== null && runtime !== undefined) {
          let runtimeDisplay: number;
          let runtimeUnit: string;

          if (runtime >= 60) {
            runtimeDisplay = parseFloat((runtime / 60).toFixed(1));
            runtimeUnit = 'min';
          } else {
            runtimeDisplay = parseFloat(runtime.toFixed(1));
            runtimeUnit = 's';
          }

          metricsArray.push({
            label: 'Avg Runtime',
            value: runtimeDisplay,
            unit: runtimeUnit,
            status: 'healthy' as const
          });
        }

        // Only add last run timestamp if we have data
        if (lastRunTimestamp !== null && lastRunTimestamp !== undefined) {
          const date = new Date(lastRunTimestamp);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = monthNames[date.getMonth()];
          const day = date.getDate();
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          const displayMinutes = minutes.toString().padStart(2, '0');

          const lastRunDisplay = `${month} ${day}, ${displayHours}:${displayMinutes} ${ampm}`;

          metricsArray.push({
            label: 'Last Run',
            value: lastRunDisplay,
            status: 'healthy' as const
          });
        }

        newComponents.push({
          id: 'automation-gmail-filter',
          component: 'card_group' as const,
          source: 'datadog',
          priority: gmailData.metrics.failed > 0 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: 'Gmail Filter',
            subtitle: '(filters bulk email as unread)',
            status: getStatusFromRate(rate),
            insight: timeSavedInsight,
            description: `Runs every 5 minutes to filter incoming emails. ${total} executions in the last ${timeWindow} with ${rate}% success rate.`,
            metrics: metricsArray,
          },
        });
      }

      // Add Image Generator as CardGroup
      if (!imageGenData.error) {
        // Use 30-day totals for Image Generator
        const allTimeTotal = imageGenData.metrics.allTimeTotal || 0;

        // Calculate time saved (4 hours per successful generation) - using 30-day rolling window
        const imagesGenerated30d = Math.round((imageGenData.metrics.allTimeTotal || 0) * (imageGenData.metrics.successRate / 100));
        const hoursSaved = imagesGenerated30d * 4;

        const timeSavedInsight = `${imagesGenerated30d} illustration${imagesGenerated30d !== 1 ? 's' : ''} generated in last 30 days, saving you ${hoursSaved} hour${hoursSaved !== 1 ? 's' : ''} of work`;

        // Get trend data from backend (if available)
        const successRateTrend = imageGenData.metrics.trend || { direction: 'flat' as const, value: 0 };
        const runtime = imageGenData.metrics.avgRuntime;
        const lastRunTimestamp = imageGenData.metrics.lastRunTimestamp;

        // Build metrics array, only include runtime if data is available
        const metricsArray: Array<{
          label: string;
          value: number | string;
          unit?: string;
          status?: 'healthy' | 'warning' | 'critical' | 'unknown';
          trend?: { direction: 'up' | 'down' | 'flat'; value?: number };
        }> = [
          {
            label: 'Successful',
            value: imagesGenerated30d,
            status: 'healthy',
            trend: { direction: successRateTrend.direction === 'up' ? 'up' : successRateTrend.direction === 'down' ? 'down' : 'flat' }
          },
          {
            label: 'Failed',
            value: Math.round(allTimeTotal - imagesGenerated30d),
            status: (allTimeTotal - imagesGenerated30d) > 0 ? 'warning' : 'healthy',
            trend: { direction: (allTimeTotal - imagesGenerated30d) > 0 ? 'up' : 'flat' }
          },
          {
            label: 'Success Rate',
            value: imageGenData.metrics.successRate,
            unit: '%',
            status: getStatusFromRate(imageGenData.metrics.successRate),
            trend: successRateTrend
          },
          { label: 'Total Times Run', value: allTimeTotal, status: 'healthy' },
        ];

        // Only add runtime metric if we have data
        if (runtime !== null && runtime !== undefined) {
          let runtimeDisplay: number;
          let runtimeUnit: string;

          if (runtime >= 60) {
            runtimeDisplay = parseFloat((runtime / 60).toFixed(1));
            runtimeUnit = 'min';
          } else {
            runtimeDisplay = parseFloat(runtime.toFixed(1));
            runtimeUnit = 's';
          }

          metricsArray.push({
            label: 'Avg Runtime',
            value: runtimeDisplay,
            unit: runtimeUnit,
            status: 'healthy' as const
          });
        }

        // Only add last run timestamp if we have data
        if (lastRunTimestamp !== null && lastRunTimestamp !== undefined) {
          const date = new Date(lastRunTimestamp);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = monthNames[date.getMonth()];
          const day = date.getDate();
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          const displayMinutes = minutes.toString().padStart(2, '0');

          const lastRunDisplay = `${month} ${day}, ${displayHours}:${displayMinutes} ${ampm}`;

          metricsArray.push({
            label: 'Last Run',
            value: lastRunDisplay,
            status: 'healthy' as const
          });
        }

        newComponents.push({
          id: 'automation-image-generator',
          component: 'card_group' as const,
          source: 'datadog',
          priority: imageGenData.metrics.failed > 0 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          props: {
            title: 'Image Generator',
            subtitle: '(generates custom illustrations)',
            status: getStatusFromRate(imageGenData.metrics.successRate),
            insight: timeSavedInsight,
            description: `Triggered on-demand to generate images via AI.`,
            metrics: metricsArray,
          },
        });
      }

      setDashboardState({
        components: sortByPriority(newComponents),
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing ${newComponents.length} automation workflows`,
      });
      setCurrentView('home');
      setLastAction('automations');
    } catch (error) {
      console.error('Failed to fetch automations:', error);
    }
  }, [timeWindow]);


  // Action to show deployments dashboard
  useCopilotAction({
    name: 'showDeployments',
    description: 'Show the deployments dashboard with deployment history. Use this when the user asks to see deployments, show deployments, or view deployment history.',
    parameters: [],
    handler: async () => {
      // Check if deployments are already loaded from routing
      if (currentView === 'home' && (isWidgetTypeLoaded('deployment-count') || isWidgetTypeLoaded('deployments-table'))) {
        console.log('[showDeployments] Deployments already loaded, skipping duplicate load');
        return 'Deployments are already displayed on the dashboard.';
      }

      // Trigger the deployments view
      const deployments = deploymentsData.deployments;
      const githubActionsCount = deployments.filter((d: { trigger?: string }) => d.trigger === 'github_actions').length;
      const manualCount = deployments.filter((d: { trigger?: string }) => d.trigger === 'manual').length;

      const deploymentsTable: A2UIComponent = {
        id: 'deployments-table',
        component: 'data_table' as const,
        source: 'local',
        priority: 'high',
        timestamp: new Date().toISOString(),
        props: {
          title: `Deployments (${deploymentsData.totalDeployments} total)`,
          columns: [
            { key: 'tag', label: 'Tag' },
            { key: 'name', label: 'Name' },
            { key: 'trigger', label: 'Trigger' },
            { key: 'date', label: 'Date & Time' },
            { key: 'summary', label: 'Summary' },
            { key: 'commits', label: 'Commits' },
          ],
          rows: deployments.map((d: { tag: string; name: string; trigger?: string; date: string; summary: string; commits: { hash: string; message: string }[] }) => ({
            tag: d.tag,
            name: d.name,
            trigger: d.trigger === 'github_actions' ? '🚀 GitHub Actions' : '🔧 Manual',
            date: new Date(d.date).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }),
            summary: d.summary,
            commits: d.commits.map((c) => `${c.hash}: ${c.message}`).join('\n'),
          })),
        },
      };

      const deploymentCount: A2UIComponent = {
        id: 'deployment-count',
        component: 'metric_card' as const,
        source: 'local',
        priority: 'high',
        timestamp: new Date().toISOString(),
        props: {
          title: 'Total Deployments',
          value: deploymentsData.totalDeployments,
          unit: '',
          size: 'xl' as const,
          status: 'healthy' as const,
          description: `${githubActionsCount} via GitHub Actions, ${manualCount} manual`,
        },
      };

      setDashboardState({
        components: [deploymentCount, deploymentsTable],
        lastUpdated: new Date().toISOString(),
        agentMessage: `Showing ${deploymentsData.totalDeployments} deployments for ${deploymentsData.container} (${githubActionsCount} automated, ${manualCount} manual)`,
      });
      setCurrentView('home');

      return `Showing ${deploymentsData.totalDeployments} deployments (${githubActionsCount} via GitHub Actions)`;
    },
  });

  // Handler for Deployments
  const handleFetchDeployments = useCallback(() => {
    const deployments = deploymentsData.deployments;
    const githubActionsCount = deployments.filter((d: { trigger?: string }) => d.trigger === 'github_actions').length;
    const manualCount = deployments.filter((d: { trigger?: string }) => d.trigger === 'manual').length;

    // Create a data table component for deployments
    const deploymentsTable: A2UIComponent = {
      id: 'deployments-table',
      component: 'data_table' as const,
      source: 'local',
      priority: 'high',
      timestamp: new Date().toISOString(),
      props: {
        title: `Deployments (${deploymentsData.totalDeployments} total)`,
        columns: [
          { key: 'tag', label: 'Tag' },
          { key: 'name', label: 'Name' },
          { key: 'trigger', label: 'Trigger' },
          { key: 'date', label: 'Date & Time' },
          { key: 'summary', label: 'Summary' },
          { key: 'commits', label: 'Commits' },
        ],
        rows: deployments.map((d: { tag: string; name: string; trigger?: string; date: string; summary: string; commits: { hash: string; message: string }[] }) => ({
          tag: d.tag,
          name: d.name,
          trigger: d.trigger === 'github_actions' ? '🚀 GitHub Actions' : '🔧 Manual',
          date: new Date(d.date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          summary: d.summary,
          commits: d.commits.map((c) => `${c.hash}: ${c.message}`).join('\n'),
        })),
      },
    };

    // Create a metric card showing total deployments
    const deploymentCount: A2UIComponent = {
      id: 'deployment-count',
      component: 'metric_card' as const,
      source: 'local',
      priority: 'high',
      timestamp: new Date().toISOString(),
      props: {
        title: 'Total Deployments',
        value: deploymentsData.totalDeployments,
        unit: '',
        size: 'xl' as const,
        status: 'healthy' as const,
        description: `${githubActionsCount} via GitHub Actions, ${manualCount} manual`,
      },
    };

    setDashboardState({
      components: [deploymentCount, deploymentsTable],
      lastUpdated: new Date().toISOString(),
      agentMessage: `Showing ${deploymentsData.totalDeployments} deployments for ${deploymentsData.container} (${githubActionsCount} automated, ${manualCount} manual)`,
    });
    setCurrentView('home');
  }, []);

  // Handler for Costs
  const handleFetchCosts = useCallback(async () => {
    setCurrentView('loading');

    try {
      const data = await mcpClient.getCostsOverview();

      const components: A2UIComponent[] = [];

      // Check if AWS data is available
      if (data.aws && !data.aws.error) {
        // Main cost metric card - 2 columns wide
        const costCard: A2UIComponent = {
          id: 'aws-total-cost',
          component: 'metric_card' as const,
          source: 'aws-cost-explorer',
          priority: 'high',
          timestamp: new Date().toISOString(),
          columnSpan: 2,
          props: {
            title: 'Current Month Cost',
            value: `$${data.aws.totalCost.toFixed(2)}`,
            unit: 'USD',
            size: 'xl' as const,
            status: 'healthy' as const,
            description: `${data.aws.period.start} to ${data.aws.period.end}`,
          },
        };
        components.push(costCard);

        // Forecast card if available - 2 columns wide
        if (data.forecast && data.forecast.forecastedCost > 0) {
          const forecastCard: A2UIComponent = {
            id: 'aws-forecast',
            component: 'metric_card' as const,
            source: 'aws-cost-explorer',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            columnSpan: 2,
            props: {
              title: 'Forecasted Month End',
              value: `$${data.forecast.forecastedCost.toFixed(2)}`,
              unit: 'USD',
              size: 'xl' as const,
              status: 'healthy' as const,
              description: 'Estimated total for billing month',
            },
          };
          components.push(forecastCard);
        }

        // Service breakdown table - 4 columns wide (full width)
        if (data.aws.breakdown && data.aws.breakdown.length > 0) {
          const breakdownTable: A2UIComponent = {
            id: 'aws-cost-breakdown',
            component: 'data_table' as const,
            source: 'aws-cost-explorer',
            priority: 'medium',
            timestamp: new Date().toISOString(),
            columnSpan: 4,
            props: {
              title: 'Cost Breakdown by Service',
              columns: [
                { key: 'name', label: 'Service' },
                { key: 'cost', label: 'Cost (USD)' },
                { key: 'percentage', label: '% of Total' },
              ],
              rows: data.aws.breakdown.map((item: { name: string; cost: number; percentage: number }) => ({
                name: item.name,
                cost: `$${item.cost.toFixed(2)}`,
                percentage: `${item.percentage}%`,
              })),
            },
          };
          components.push(breakdownTable);
        }
      } else {
        // Show error message if AWS not configured
        const errorCard: A2UIComponent = {
          id: 'aws-cost-error',
          component: 'metric_card' as const,
          source: 'error',
          priority: 'high',
          timestamp: new Date().toISOString(),
          props: {
            title: 'AWS Costs',
            value: 'Not Configured',
            size: 'large' as const,
            status: 'critical' as const,
            description: data.aws?.error || 'AWS Cost Explorer not configured',
          },
        };
        components.push(errorCard);
      }

      setDashboardState({
        components,
        lastUpdated: new Date().toISOString(),
        agentMessage: data.aws && !data.aws.error
          ? `AWS costs for ${data.aws.period.start} to ${data.aws.period.end}: $${data.aws.totalCost.toFixed(2)}`
          : 'Unable to fetch AWS costs',
      });
      setCurrentView('home');
    } catch (error) {
      console.error('Error fetching costs:', error);
      setDashboardState({
        components: [{
          id: 'cost-error',
          component: 'metric_card' as const,
          source: 'error',
          priority: 'high',
          timestamp: new Date().toISOString(),
          props: {
            title: 'Error',
            value: 'Failed to load',
            size: 'large' as const,
            status: 'critical' as const,
            description: error instanceof Error ? error.message : 'Unknown error',
          },
        }],
        lastUpdated: new Date().toISOString(),
      });
      setCurrentView('home');
    }
  }, []);

  // Handler for going back to landing page
  const handleBackToHome = useCallback(() => {
    processUtterance('home');
    setDashboardState({
      components: [],
      lastUpdated: new Date().toISOString(),
    });
  }, [processUtterance]);

  // Handler for showing Claude Usage widget
  const handleShowClaudeUsage = useCallback(() => {
    const claudeUsageComponent: A2UIComponent = {
      id: 'claude-usage-widget',
      component: 'claude_usage' as const,
      source: 'claude-api',
      priority: 'high',
      timestamp: new Date().toISOString(),
      props: {
        claudeCode: null,
        apiCredits: null,
      },
    };
    const anthropicUsageComponent: A2UIComponent = {
      id: 'anthropic-usage-widget',
      component: 'anthropic_usage' as const,
      source: 'anthropic-admin-api',
      priority: 'high',
      timestamp: new Date().toISOString(),
      props: {
        tokenUsage: null,
      },
    };
    setDashboardState({
      components: [claudeUsageComponent, anthropicUsageComponent],
      lastUpdated: new Date().toISOString(),
      agentMessage: 'Showing your Claude usage statistics',
    });
    setCurrentView('home');
  }, []);

  // Effect to call route handlers when a route is matched
  useEffect(() => {
    if (!pendingRoute) return;

    const loadWidgets = async () => {
      console.log(`[WidgetLoader] Loading widgets for route: ${pendingRoute.routeId}`);

      // Call the appropriate handler based on route ID
      switch (pendingRoute.routeId) {
        case 'systemMetrics':
          await handleFetchSystemInfrastructure();
          break;
        case 'containers':
          await handleFetchContainersList();
          break;
        case 'automations':
          await handleFetchAutomations();
          break;
        case 'costs':
          await handleFetchCosts();
          break;
        case 'deployments':
          await handleFetchDeployments();
          break;
        case 'aiUsage':
          await handleShowClaudeUsage();
          break;
        default:
          console.warn(`[WidgetLoader] No handler found for route: ${pendingRoute.routeId}`);
          setCurrentView('home');
      }

      // Clear pending route after processing
      setPendingRoute(null);
    };

    loadWidgets();
  }, [pendingRoute, handleFetchSystemInfrastructure, handleFetchContainersList, handleFetchAutomations, handleFetchCosts, handleFetchDeployments, handleShowClaudeUsage]);

  // Define shortcuts for the welcome screen (2 rows x 3 columns)
  // Row 1: System & Infrastructure, Containers, Automations
  // Row 2: Costs, Deployments, Claude Usage
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
      id: 'costs',
      title: 'Costs',
      description: 'AWS infrastructure costs',
      icon: <DollarSign className="w-6 h-6" />,
      onClick: handleFetchCosts,
    },
    {
      id: 'deployments',
      title: 'Deployments',
      description: 'View deployment history and commits',
      icon: <Rocket className="w-6 h-6" />,
      onClick: handleFetchDeployments,
    },
    {
      id: 'claude-usage',
      title: 'Claude Usage',
      description: 'Track subscription usage and API credits',
      icon: <Activity className="w-6 h-6" />,
      onClick: handleShowClaudeUsage,
    },
  ];

  return (
    <div ref={containerRef} className="flex flex-col h-screen text-text-primary relative">
      {/* Blurred gradient background */}
      <BlurBackground />

      {/* Full-width Header */}
      <header className="h-14 border-b border-surface-3/50 flex items-center justify-between px-6 pt-4 bg-transparent relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToHome}
            disabled={dashboardState.components.length === 0 && currentView === 'home'}
            className={`p-2 rounded transition-all ${
              dashboardState.components.length > 0 || currentView !== 'home'
                ? 'text-accent-primary hover:bg-accent-primary/10 cursor-pointer'
                : 'text-text-muted cursor-not-allowed opacity-30'
            }`}
            title="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src="/console.svg" alt="Console" className="h-6 mt-1" />
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
        <main className="flex-1 overflow-auto p-6 scrollbar-hide">
          <DashboardCanvas
            state={dashboardState}
            shortcuts={shortcuts}
            currentView={currentView}
            onBack={handleBackToHome}
            onCommandClick={handleCommandClick}
            statusSummary={statusSummary}
            statusSummaryLoading={statusSummaryLoading}
            onNavigate={handleNavigate}
            onSendMessage={handleSendMessage}
            timeWindow={timeWindow}
          />
        </main>

        {/* Resizable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 hover:bg-accent-primary cursor-col-resize transition-colors flex-shrink-0"
        />

        {/* Chat Panel - Floating Card Style */}
        <div
          className="flex flex-col flex-shrink-0 py-4 pr-4"
          style={{ width: chatWidth }}
        >
          <div className="flex-1 overflow-hidden bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm flex flex-col">
            {/* Header Section */}
            <div className="p-6 flex-shrink-0">
              <p className="text-xl font-bold text-text-primary mb-4 font-orbitron tracking-wider">
                CONSOLE/AI
              </p>
              <p className="text-base text-text-secondary mb-4 font-semibold">
                Console AI is a <button onClick={startListening} className="text-accent-primary hover:underline cursor-pointer">voice</button> first assistant. You can use the voice button or the chat to ask common things like:
              </p>

              {/* Example Queries List */}
              <p className="text-base text-text-primary mb-3 font-bold">
                Ask me things in voice or text like:
              </p>
              <ul className="text-base text-text-secondary space-y-1 ml-1">
                <li>- <button onClick={() => handleSendMessage('Show me performance metrics')} className="text-accent-primary hover:underline cursor-pointer">Performance</button></li>
                <li>- <button onClick={() => handleSendMessage('Show me costs')} className="text-accent-primary hover:underline cursor-pointer">Costs</button></li>
                <li>- <button onClick={() => handleSendMessage('Show latest deployments')} className="text-accent-primary hover:underline cursor-pointer">Latest deployments</button></li>
                <li>- <button onClick={() => handleSendMessage('Show automations')} className="text-accent-primary hover:underline cursor-pointer">Automations</button></li>
                <li>- <button onClick={() => handleSendMessage('Show AI usage')} className="text-accent-primary hover:underline cursor-pointer">AI usage</button></li>
                <li>- <button onClick={() => handleSendMessage('Go back')} className="text-accent-primary hover:underline cursor-pointer">Back</button></li>
                <li>- <button onClick={startListening} className="text-accent-primary hover:underline cursor-pointer">Voice</button></li>
              </ul>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 mx-5 flex-shrink-0" />

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden">
              <CopilotChat
                labels={{
                  initial: '',
                  placeholder: 'Ask about performance, costs, deployments...',
                }}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Floating Voice UI - Always visible, positioned above all elements */}
        {isVoiceSupported && (
          <>
            {/* Voice Overlay - Shows when voice is active */}
            {voiceState !== 'idle' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-lg pointer-events-none animate-overlay-fade-in">
                <div className="pointer-events-auto">
                  <VoiceOverlay voiceState={voiceState} transcript={transcript} />
                </div>
              </div>
            )}

            {/* Voice Button - Always visible at bottom center */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
              <VoiceButton
                voiceState={voiceState}
                onStart={startListening}
                onStop={stopListening}
              />
            </div>
          </>
        )}
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
