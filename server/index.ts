import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import express from 'express';
import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from '@aws-sdk/client-cost-explorer';
import { ECRClient, DescribeRepositoriesCommand, DescribeImagesCommand } from '@aws-sdk/client-ecr';

import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from '@copilotkit/runtime';

// Import metrics configuration
import {
  METRICS_CONFIG,
  DEFAULT_HOST,
  getMetricsConfigForAgent,
  findMetricsByKeywords,
  getSystemOverviewMetrics,
} from './metrics-config.js';

// Import Claude usage tracking
import { getClaudeCodeUsage } from './claude-usage.js';
import {
  getApiCreditsUsage,
  updateBalance,
  saveAdminApiKey,
  getAdminApiKey,
  hasAdminApiConfigured,
} from './api-credits-storage.js';
import {
  getAnthropicTokenUsage,
  validateAdminApiKey,
} from './anthropic-admin-api.js';
import type { ConsoleUsageDataSync, SyncResponse, ConsoleUsageResponse } from './claude-console-sync-types.js';

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
const DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
const DATADOG_SITE = process.env.DATADOG_SITE || 'us5.datadoghq.com';
const LANGFLOW_URL = process.env.LANGFLOW_URL || 'https://langflow.neil-everette.com';
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;

// AWS Cost Explorer credentials
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_EC2_INSTANCE_ID = 'i-040ac6026761030ac'; // Target EC2 instance for cost tracking

// Claude Console sync API key (optional for local dev)
const CLAUDE_SYNC_API_KEY = process.env.CLAUDE_SYNC_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable');
  process.exit(1);
}

if (!DATADOG_API_KEY || !DATADOG_APP_KEY) {
  console.error('Missing DATADOG_API_KEY or DATADOG_APP_KEY environment variable');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Serve static files in production
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../dist')));

// Time window conversion utility
function parseTimeWindow(timeWindow: string): number {
  const unit = timeWindow.slice(-1);
  const value = parseInt(timeWindow.slice(0, -1));

  switch (unit) {
    case 'm': return value * 60; // minutes
    case 'h': return value * 3600; // hours
    case 'd': return value * 86400; // days
    case 'w': return value * 604800; // weeks
    case 'o': return value * 2592000; // month (30 days)
    default: return 3600; // default to 1 hour
  }
}

// =============================================================================
// AWS COST EXPLORER INTEGRATION
// =============================================================================

// Initialize AWS Cost Explorer client (only if credentials are available)
let costExplorerClient: CostExplorerClient | null = null;
let ecrClient: ECRClient | null = null;
if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
  costExplorerClient = new CostExplorerClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
  ecrClient = new ECRClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('[AWS Cost Explorer] Client initialized');
  console.log('[AWS ECR] Client initialized');
} else {
  console.log('[AWS Cost Explorer] Not configured - missing credentials');
  console.log('[AWS ECR] Not configured - missing credentials');
}

// Helper to get current billing month date range
function getBillingMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Start of current month (YYYY-MM-DD format)
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // Tomorrow (Cost Explorer end date is exclusive)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const end = tomorrow.toISOString().split('T')[0];

  return { start, end };
}

// Fetch AWS costs for the current billing month
async function fetchAWSCosts(): Promise<{
  totalCost: number;
  currency: string;
  breakdown: Array<{ name: string; cost: number; percentage: number }>;
  period: { start: string; end: string };
  queriedAt: string;
  source: string;
}> {
  if (!costExplorerClient) {
    throw new Error('AWS Cost Explorer not configured');
  }

  const { start, end } = getBillingMonthRange();

  // Get cost and usage grouped by service
  const command = new GetCostAndUsageCommand({
    TimePeriod: { Start: start, End: end },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost'],
    GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
  });

  const response = await costExplorerClient.send(command);

  // Parse results
  const breakdown: Array<{ name: string; cost: number; percentage: number }> = [];
  let totalCost = 0;

  if (response.ResultsByTime && response.ResultsByTime.length > 0) {
    const groups = response.ResultsByTime[0].Groups || [];

    for (const group of groups) {
      const serviceName = group.Keys?.[0] || 'Unknown';
      const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');

      if (cost > 0) {
        breakdown.push({ name: serviceName, cost, percentage: 0 });
        totalCost += cost;
      }
    }

    // Calculate percentages
    for (const item of breakdown) {
      item.percentage = totalCost > 0 ? parseFloat(((item.cost / totalCost) * 100).toFixed(1)) : 0;
    }

    // Sort by cost descending
    breakdown.sort((a, b) => b.cost - a.cost);
  }

  return {
    totalCost: parseFloat(totalCost.toFixed(2)),
    currency: 'USD',
    breakdown,
    period: { start, end },
    queriedAt: new Date().toISOString(),
    source: 'aws-cost-explorer',
  };
}

// Fetch AWS cost forecast for end of billing month
async function fetchAWSForecast(): Promise<{
  forecastedCost: number;
  currency: string;
  period: { start: string; end: string };
  queriedAt: string;
}> {
  if (!costExplorerClient) {
    throw new Error('AWS Cost Explorer not configured');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Tomorrow as start (forecast starts from tomorrow)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = tomorrow.toISOString().split('T')[0];

  // End of current month
  const lastDay = new Date(year, month + 1, 0);
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

  // Only get forecast if we're not at end of month
  if (tomorrow >= lastDay) {
    return {
      forecastedCost: 0,
      currency: 'USD',
      period: { start, end },
      queriedAt: new Date().toISOString(),
    };
  }

  const command = new GetCostForecastCommand({
    TimePeriod: { Start: start, End: end },
    Metric: 'UNBLENDED_COST',
    Granularity: 'MONTHLY',
  });

  const response = await costExplorerClient.send(command);

  const forecastedCost = parseFloat(response.Total?.Amount || '0');

  return {
    forecastedCost: parseFloat(forecastedCost.toFixed(2)),
    currency: 'USD',
    period: { start, end },
    queriedAt: new Date().toISOString(),
  };
}

// Datadog API helper
async function queryDatadog(query: string, from: number, to: number) {
  const url = new URL(`https://api.${DATADOG_SITE}/api/v1/query`);
  url.searchParams.set('query', query);
  url.searchParams.set('from', from.toString());
  url.searchParams.set('to', to.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'DD-API-KEY': DATADOG_API_KEY!,
      'DD-APPLICATION-KEY': DATADOG_APP_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Datadog API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Debug logging for runtime queries
  if (query.includes('runtime_seconds')) {
    console.log('[DEBUG] Runtime query:', query);
    console.log('[DEBUG] From:', new Date(from * 1000).toISOString());
    console.log('[DEBUG] To:', new Date(to * 1000).toISOString());
    console.log('[DEBUG] Response:', JSON.stringify(data, null, 2));
  }

  return data;
}

/**
 * Parse structured data from LangFlow agent response
 * Extracts interpretation and actionable insights sections
 */
function parseAgentResponse(message: string) {
  const result: {
    interpretation?: string;
    actionableInsights?: string;
    metrics?: Array<{ name: string; value: string; status?: string }>;
  } = {};

  // Extract interpretation section
  const interpretationMatch = message.match(/(?:Interpretation:|3\.\s*Interpretation:)\s*\n\s*-\s*([\s\S]*?)(?=\n\n|\n(?:4\.|Actionable|$))/i);
  if (interpretationMatch) {
    result.interpretation = interpretationMatch[1].trim();
  }

  // Extract actionable insights section
  const insightsMatch = message.match(/(?:Actionable Insights?:|4\.\s*Actionable Insights?:)\s*\n\s*-\s*([\s\S]*?)(?=\n\n|$)/i);
  if (insightsMatch) {
    result.actionableInsights = insightsMatch[1].trim();
  }

  // Try to extract metric values
  const metricValueMatch = message.match(/(?:current value|most recent value).*?(?:is\s+)?(?:approximately\s+)?([0-9.]+)\s*%?\s*([\w\s]+)?/i);
  if (metricValueMatch) {
    result.metrics = [{
      name: 'current',
      value: metricValueMatch[1],
      status: message.toLowerCase().includes('healthy') ? 'healthy' :
              message.toLowerCase().includes('warning') ? 'warning' :
              message.toLowerCase().includes('critical') ? 'critical' : undefined
    }];
  }

  return result;
}

/**
 * Query LangFlow agent for a specific metric
 * Returns structured data extracted from the agent's response
 */
async function queryLangFlowMetric(
  metricName: string,
  timeWindow: string = '1h'
): Promise<{ value: number | null; interpretation?: string; insights?: string[]; raw?: string }> {
  if (!LANGFLOW_API_KEY || !LANGFLOW_FLOW_ID) {
    throw new Error('LangFlow not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const from = now - parseTimeWindow(timeWindow);

  // Create a specific query for the metric
  const query = `What is the current ${metricName}? Return ONLY the numeric value and a brief status. (Use time range: from=${from} to=${now}, which is the last ${timeWindow})`;

  const response = await fetch(
    `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LANGFLOW_API_KEY,
      },
      body: JSON.stringify({
        input_value: query,
        output_type: 'chat',
        input_type: 'chat',
        session_id: crypto.randomUUID(),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`LangFlow API error: ${response.status}`);
  }

  const data = await response.json();
  const message = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text || '';

  // Extract numeric value from response - try multiple patterns
  let value: number | null = null;

  // Try pattern with % first (e.g., "1.5%", "15.34%")
  const percentMatch = message.match(/(\d+\.?\d*)\s*%/);
  if (percentMatch) {
    value = parseFloat(percentMatch[1]);
  }

  // Try pattern for load average or other decimals (e.g., "0.07", "is 0.12")
  if (value === null) {
    const decimalMatch = message.match(/(?:is|approximately|around|value[:\s]+|average[:\s]+)\s*(\d+\.?\d*)/i);
    if (decimalMatch) {
      value = parseFloat(decimalMatch[1]);
    }
  }

  // Last resort: find any standalone number
  if (value === null) {
    const anyNumberMatch = message.match(/\b(\d+\.\d+)\b/);
    if (anyNumberMatch) {
      value = parseFloat(anyNumberMatch[1]);
    }
  }

  // Extract interpretation
  const interpretation = message.split('\n').find((line: string) =>
    line.toLowerCase().includes('normal') ||
    line.toLowerCase().includes('healthy') ||
    line.toLowerCase().includes('low') ||
    line.toLowerCase().includes('high')
  );

  // Extract actionable insights
  const insightsMatch = message.match(/(?:Actionable|Insight|Recommendation)[s]?:?\s*([\s\S]*?)(?:\n\n|$)/i);
  const insights = insightsMatch ? insightsMatch[1].split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('•')).map((l: string) => l.replace(/^[-•]\s*/, '').trim()) : [];

  return {
    value,
    interpretation: interpretation?.trim(),
    insights: insights.length > 0 ? insights : undefined,
    raw: message,
  };
}

import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const serviceAdapter = new OpenAIAdapter({ openai });

// Import MCP Registry (orchestration layer for multiple MCP servers)
import { getMCPRegistry, MCPServerRegistry } from './mcp-registry.js';

// Initialize MCP Registry on startup
let mcpRegistry: MCPServerRegistry | null = null;
(async () => {
  try {
    mcpRegistry = await getMCPRegistry();
    const statuses = mcpRegistry.getServerStatuses();
    console.log('[MCP Registry] Initialized with servers:', statuses.map(s => `${s.id} (${s.status})`).join(', '));
  } catch (error) {
    console.error('[MCP Registry] Failed to initialize:', error);
    console.error('[MCP Registry] Continuing without MCP integration');
  }
})();

// Create CopilotKit runtime (using frontend actions only due to CopilotKit 1.50 bug with server-side actions)
const copilotKit = new CopilotRuntime();

// CopilotKit endpoint
app.use('/api/copilotkit', copilotRuntimeNodeExpressEndpoint({
  endpoint: '/api/copilotkit',
  runtime: copilotKit,
  serviceAdapter,
}));

// Direct Datadog API endpoint for testing
app.post('/api/datadog/query', async (req, res) => {
  try {
    const { query, from, to } = req.body;
    const result = await queryDatadog(query, from, to);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// LangFlow Datadog Agent endpoint
app.post('/api/langflow/agent', async (req, res) => {
  try {
    const { query, timeWindow = '1h' } = req.body;

    if (!LANGFLOW_API_KEY || !LANGFLOW_FLOW_ID) {
      return res.status(500).json({ error: 'LangFlow not configured. Please set LANGFLOW_API_KEY and LANGFLOW_FLOW_ID environment variables.' });
    }

    // Calculate timestamps based on timeWindow
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    // Include time context in the query for the agent
    const queryWithContext = `${query} (Use time range: from=${from} to=${now}, which is the last ${timeWindow})`;

    const response = await fetch(
      `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LANGFLOW_API_KEY,
        },
        body: JSON.stringify({
          input_value: queryWithContext,
          output_type: 'chat',
          input_type: 'chat',
          session_id: crypto.randomUUID(),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LangFlow API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const message = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text;

    // Parse structured data from agent response
    const parsed = parseAgentResponse(message || '');

    res.json({
      message,
      ...parsed,
      raw: data,
      queriedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Health check - includes storage and data status
app.get('/api/health', (_req, res) => {
  try {
    // Check storage accessibility
    const metadata = getStorageMetadata();
    const storageAccessible = fs.existsSync(path.join(__dirname, 'claude-scraper/console-usage-history'));

    // Check latest data availability and age
    let latestDataAge: number | null = null;
    let dataStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metadata.versionCount > 0 && metadata.newestTimestamp) {
      const newestDate = new Date(metadata.newestTimestamp);
      latestDataAge = Math.round((Date.now() - newestDate.getTime()) / 1000 / 60); // minutes

      if (latestDataAge > 30) {
        dataStatus = 'unhealthy';
      } else if (latestDataAge > 10) {
        dataStatus = 'degraded';
      }
    } else {
      dataStatus = 'unhealthy';
    }

    // Overall health status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (!storageAccessible) {
      overallStatus = 'unhealthy';
    } else if (dataStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (dataStatus === 'degraded') {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

    res.status(statusCode).json({
      status: overallStatus,
      storage: {
        accessible: storageAccessible,
        versionCount: metadata.versionCount,
      },
      latestData: {
        ageMinutes: latestDataAge,
        status: dataStatus,
        timestamp: metadata.newestTimestamp,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// =============================================================================
// MCP ORCHESTRATION LAYER ENDPOINTS
// These endpoints provide a unified interface to multiple MCP servers
// =============================================================================

// List all connected MCP servers and their status
app.get('/api/mcp/servers', async (req, res) => {
  try {
    if (!mcpRegistry) {
      return res.status(503).json({
        error: 'MCP Registry not available'
      });
    }

    const servers = mcpRegistry.getServerStatuses();
    res.json({
      servers,
      count: servers.length,
      connectedCount: servers.filter(s => s.status === 'connected').length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'mcp-registry'
    });
  }
});

// List all tools from all connected servers (namespaced)
app.get('/api/mcp/tools', async (req, res) => {
  try {
    if (!mcpRegistry) {
      return res.status(503).json({
        error: 'MCP Registry not available'
      });
    }

    const tools = await mcpRegistry.getAllTools();

    // Group tools by server for easier consumption
    const toolsByServer: Record<string, any[]> = {};
    for (const tool of tools) {
      if (!toolsByServer[tool.serverId]) {
        toolsByServer[tool.serverId] = [];
      }
      toolsByServer[tool.serverId].push({
        name: tool.name,
        namespacedName: `${tool.serverId}:${tool.name}`,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }

    res.json({
      tools: toolsByServer,
      totalCount: tools.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'mcp-registry'
    });
  }
});

// Generic tool execution endpoint - call any tool on any server
app.post('/api/mcp/call', async (req, res) => {
  try {
    if (!mcpRegistry) {
      return res.status(503).json({
        error: 'MCP Registry not available'
      });
    }

    const { serverId, toolName, args } = req.body;

    if (!serverId || !toolName) {
      return res.status(400).json({
        error: 'Missing required fields: serverId and toolName'
      });
    }

    const result = await mcpRegistry.callTool(serverId, toolName, args || {});

    res.json({
      serverId,
      toolName,
      result,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'mcp-registry'
    });
  }
});

// Call a tool using namespaced name (e.g., "datadog:get_system_metrics")
app.get('/api/mcp/call/:namespacedTool', async (req, res) => {
  try {
    if (!mcpRegistry) {
      return res.status(503).json({
        error: 'MCP Registry not available'
      });
    }

    const { namespacedTool } = req.params;
    const args = req.query as Record<string, any>;

    // Remove any non-arg query params if needed
    delete args._;

    const result = await mcpRegistry.callNamespacedTool(namespacedTool, args);

    res.json({
      tool: namespacedTool,
      result,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'mcp-registry'
    });
  }
});

// =============================================================================
// LEGACY MCP ENDPOINTS (backward compatibility)
// These will be deprecated in favor of the generic /api/mcp/call endpoint
// =============================================================================

// MCP System Metrics - legacy endpoint (uses registry internally)
app.get('/api/mcp/metrics/system', async (req, res) => {
  try {
    if (!mcpRegistry) {
      return res.status(503).json({
        error: 'MCP Registry not available',
        fallback: 'Use /api/metrics/overview/fast instead'
      });
    }

    const timeWindow = (req.query.timeWindow as string) || '1h';
    const result = await mcpRegistry.callTool('datadog', 'get_system_metrics', { timeWindow });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'mcp-endpoint'
    });
  }
});

// MCP Container Metrics - legacy endpoint (uses registry internally)
app.get('/api/mcp/metrics/containers', async (req, res) => {
  try {
    if (!mcpRegistry) {
      return res.status(503).json({
        error: 'MCP Registry not available',
        fallback: 'Use /api/metrics/containers-list instead'
      });
    }

    const timeWindow = (req.query.timeWindow as string) || '1h';
    const result = await mcpRegistry.callTool('datadog', 'get_container_metrics', { timeWindow });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'mcp-endpoint'
    });
  }
});

// MCP Workflow Metrics - legacy endpoint (uses registry internally)
app.get('/api/mcp/metrics/workflow/:workflow', async (req, res) => {
  try {
    if (!mcpRegistry) {
      return res.status(503).json({
        error: 'MCP Registry not available',
        fallback: 'Use /api/metrics/n8n/:workflow instead'
      });
    }

    const { workflow } = req.params;
    const timeWindow = (req.query.timeWindow as string) || '1d';

    if (workflow !== 'gmail_filter' && workflow !== 'image_generator') {
      return res.status(400).json({
        error: 'Invalid workflow. Must be gmail_filter or image_generator'
      });
    }

    const result = await mcpRegistry.callTool('datadog', 'get_workflow_metrics', { workflow, timeWindow });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'mcp-endpoint'
    });
  }
});

// =============================================================================
// END MCP ENDPOINTS
// =============================================================================

// Metrics configuration endpoint - for LangFlow agent to fetch available metrics
app.get('/api/metrics/config', (_req, res) => {
  res.json(getMetricsConfigForAgent());
});

// Search metrics by keywords endpoint - helps LangFlow find relevant metrics
app.post('/api/metrics/search', (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const matchedMetrics = findMetricsByKeywords(query);
  res.json({
    query,
    matches: matchedMetrics.map(m => ({
      id: m.id,
      displayName: m.displayName,
      query: m.query,
      keywords: m.keywords,
      description: m.description
    }))
  });
});

// Container CPU metrics endpoint - returns CPU usage for a specific container
app.get('/api/metrics/container/:containerName', async (req, res) => {
  try {
    const { containerName } = req.params;
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    const query = `avg:docker.cpu.usage{container_name:${containerName}}`;
    const data = await queryDatadog(query, from, now);

    if (data.series && data.series.length > 0) {
      const series = data.series[0];
      const points = series.pointlist || [];
      const currentValue = points.length > 0 ? points[points.length - 1][1] : null;

      // Determine status based on CPU thresholds
      let status = 'healthy';
      if (currentValue !== null) {
        if (currentValue >= 90) {
          status = 'critical';
        } else if (currentValue >= 70) {
          status = 'warning';
        }
      }

      res.json({
        containerName,
        metric: 'cpu_usage',
        displayName: `${containerName} CPU Usage`,
        currentValue: currentValue !== null ? parseFloat(currentValue.toFixed(2)) : null,
        unit: '%',
        status,
        queriedAt: new Date().toISOString(),
      });
    } else {
      res.json({
        containerName,
        metric: 'cpu_usage',
        displayName: `${containerName} CPU Usage`,
        currentValue: null,
        unit: '%',
        status: 'unknown',
        queriedAt: new Date().toISOString(),
        error: 'No data found for this container',
      });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// System overview endpoint - returns metrics formatted for dashboard
// Routes through LangFlow agent with a single comprehensive query
app.get('/api/metrics/overview', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    if (!LANGFLOW_API_KEY || !LANGFLOW_FLOW_ID) {
      return res.status(500).json({ error: 'LangFlow not configured' });
    }

    // Single comprehensive query for all system metrics
    const query = `Give me a system overview. For each metric, query Datadog and report the numeric value:
1. CPU Usage: Query system.cpu.user and report that percentage
2. Memory Usage: Query system.mem.usable and system.mem.total, calculate and report the percentage used
3. Load Average: Query system.load.1 and report the value
4. Disk Usage: Query system.disk.in_use and report as percentage

Format your response with clear labels like "CPU Usage: X%" for each metric.
(Use time range: from=${from} to=${now}, which is the last ${timeWindow})`;

    const response = await fetch(
      `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LANGFLOW_API_KEY,
        },
        body: JSON.stringify({
          input_value: query,
          output_type: 'chat',
          input_type: 'chat',
          session_id: crypto.randomUUID(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LangFlow API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text || '';

    // Parse metrics from the response
    const overviewMetrics = getSystemOverviewMetrics();
    const results = [];

    for (const metric of overviewMetrics) {
      let value: number | null = null;
      let interpretation: string | undefined;

      // Extract value based on metric type - try multiple patterns
      if (metric.id === 'cpu_total') {
        // Look for CPU followed by a percentage
        const match = message.match(/CPU[^%]*?(\d+\.?\d*)\s*%/i) ||
                      message.match(/cpu[^\d]*(\d+\.?\d*)/i);
        value = match ? parseFloat(match[1]) : null;
      } else if (metric.id === 'memory_used_percent') {
        // Look for memory usage percentage - prefer "usage is X%" or "used: X%"
        const match = message.match(/memory usage[^%]*?(\d+\.?\d*)\s*%/i) ||
                      message.match(/memory[^%]*?(\d{2,}\.?\d*)\s*%/i) ||
                      message.match(/(\d{2,}\.?\d*)%\s*(?:memory|used|usage)/i);
        value = match ? parseFloat(match[1]) : null;
      } else if (metric.id === 'load_1min') {
        // Look for load average value (usually a small decimal like 0.05)
        const match = message.match(/load[^:]*:?\s*(?:is\s+)?(?:approximately\s+)?(\d+\.?\d*)/i) ||
                      message.match(/system\.load\.1[^:]*:?\s*(\d+\.?\d*)/i);
        value = match ? parseFloat(match[1]) : null;
      } else if (metric.id === 'disk_used_percent') {
        // Look for disk usage percentage
        const match = message.match(/disk[^%]*?(\d+\.?\d*)\s*%/i) ||
                      message.match(/(\d+\.?\d*)%\s*disk/i);
        value = match ? parseFloat(match[1]) : null;
      }

      // Determine status
      let status = 'healthy';
      if (value !== null) {
        if (metric.critical !== undefined && value >= metric.critical) {
          status = 'critical';
        } else if (metric.warning !== undefined && value >= metric.warning) {
          status = 'warning';
        }
      } else {
        status = 'unknown';
      }

      // Extract interpretation for this metric
      const interpMatch = message.match(new RegExp(`${metric.displayName}[^.]*\\.[^.]*\\.`, 'i'));
      if (interpMatch) {
        interpretation = interpMatch[0].trim();
      }

      results.push({
        metric: metric.id,
        displayName: metric.displayName,
        currentValue: value,
        unit: metric.unit,
        status,
        interpretation,
        source: 'langflow-agent',
      });
    }

    res.json({
      metrics: results,
      queriedAt: new Date().toISOString(),
      source: 'langflow-datadog-agent',
      rawResponse: message,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Fast structured endpoint - queries Datadog directly (no LLM overhead)
// Use this for widgets that need instant data
app.get('/api/metrics/overview/fast', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    const overviewMetrics = getSystemOverviewMetrics();
    const results = [];

    // Query all metrics in parallel for speed
    const queries = overviewMetrics.map(metric => {
      const metricConfig = METRICS_CONFIG.find(m => m.id === metric.id);
      return metricConfig ? queryDatadog(metricConfig.query, from, now) : Promise.resolve(null);
    });

    const responses = await Promise.all(queries);

    for (let i = 0; i < overviewMetrics.length; i++) {
      const metric = overviewMetrics[i];
      const data = responses[i];

      let value: number | null = null;

      if (data?.series && data.series.length > 0) {
        const series = data.series[0];
        const points = series.pointlist || [];
        if (points.length > 0) {
          value = points[points.length - 1][1];
          // Round to 2 decimal places
          if (value !== null) {
            value = parseFloat(value.toFixed(2));
          }
        }
      }

      // Determine status based on thresholds
      let status = 'healthy';
      if (value !== null) {
        if (metric.critical !== undefined && value >= metric.critical) {
          status = 'critical';
        } else if (metric.warning !== undefined && value >= metric.warning) {
          status = 'warning';
        }
      } else {
        status = 'unknown';
      }

      results.push({
        metric: metric.id,
        displayName: metric.displayName,
        currentValue: value,
        unit: metric.unit,
        status,
        thresholds: {
          warning: metric.warning,
          critical: metric.critical,
        },
        source: 'datadog-direct',
      });
    }

    res.json({
      metrics: results,
      queriedAt: new Date().toISOString(),
      source: 'datadog-agent-fast',
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// AI interpretations endpoint - fetches insights from LangFlow for metrics
// Call this AFTER the fast endpoint to add AI analysis
app.get('/api/metrics/interpretations', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    if (!LANGFLOW_API_KEY || !LANGFLOW_FLOW_ID) {
      return res.status(500).json({ error: 'LangFlow not configured' });
    }

    // Ask LangFlow for interpretations of all system metrics
    const query = `Query Datadog for system infrastructure metrics. For each metric category, provide a single concise sentence describing its current state.

Format your response exactly like this (no numbers, no bullet points):
Uptime: [one sentence about system uptime/stability]
CPU: [one sentence about CPU usage]
CPUIdle: [one sentence about CPU headroom/availability]
Memory: [one sentence about memory health]
Load: [one sentence about load average]
Disk: [one sentence about disk usage]
IOWait: [one sentence about disk I/O wait]
NetworkIn: [one sentence about incoming network traffic]
NetworkOut: [one sentence about outgoing network traffic]
Swap: [one sentence about swap usage]
NetworkErrors: [one sentence about network errors]

(Use time range: from=${from} to=${now}, which is the last ${timeWindow})`;

    const response = await fetch(
      `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LANGFLOW_API_KEY,
        },
        body: JSON.stringify({
          input_value: query,
          output_type: 'chat',
          input_type: 'chat',
          session_id: crypto.randomUUID(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LangFlow API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text || '';

    // Parse interpretations from the response
    const interpretations: Record<string, { interpretation: string; insight?: string }> = {};

    // Helper to clean interpretation text
    const cleanText = (text: string): string => {
      return text
        .replace(/^\s*[-•]\s*/, '')
        .replace(/\*\*/g, '')
        .trim();
    };

    // Map of response keys to metric IDs
    const metricMappings: Array<{ pattern: RegExp; metricId: string }> = [
      { pattern: /Uptime:?\s*([^\n]+)/i, metricId: 'system_uptime' },
      { pattern: /CPU:?\s*([^\n]+)/i, metricId: 'cpu_total' },
      { pattern: /CPUIdle:?\s*([^\n]+)/i, metricId: 'cpu_idle' },
      { pattern: /Memory:?\s*([^\n]+)/i, metricId: 'memory_used_percent' },
      { pattern: /Load:?\s*([^\n]+)/i, metricId: 'load_1min' },
      { pattern: /Disk:?\s*([^\n]+)/i, metricId: 'disk_used_percent' },
      { pattern: /IOWait:?\s*([^\n]+)/i, metricId: 'cpu_iowait' },
      { pattern: /NetworkIn:?\s*([^\n]+)/i, metricId: 'network_bytes_recv' },
      { pattern: /NetworkOut:?\s*([^\n]+)/i, metricId: 'network_bytes_sent' },
      { pattern: /Swap:?\s*([^\n]+)/i, metricId: 'swap_used_percent' },
      { pattern: /NetworkErrors:?\s*([^\n]+)/i, metricId: 'network_errors' },
    ];

    for (const { pattern, metricId } of metricMappings) {
      const match = message.match(pattern);
      if (match) {
        interpretations[metricId] = { interpretation: cleanText(match[1]) };
      }
    }

    res.json({
      interpretations,
      rawResponse: message,
      queriedAt: new Date().toISOString(),
      source: 'langflow-agent',
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Container AI interpretations endpoint
app.get('/api/metrics/container-interpretations', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    if (!LANGFLOW_API_KEY || !LANGFLOW_FLOW_ID) {
      return res.status(500).json({ error: 'LangFlow not configured' });
    }

    // Ask LangFlow for container insights
    const query = `Query Datadog for Docker container metrics. Provide a brief assessment in this exact format:

Summary: [One sentence about overall container health and resource usage]
Actionable: [One specific recommendation]

(Use time range: from=${from} to=${now}, which is the last ${timeWindow})`;

    const response = await fetch(
      `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LANGFLOW_API_KEY,
        },
        body: JSON.stringify({
          input_value: query,
          output_type: 'chat',
          input_type: 'chat',
          session_id: crypto.randomUUID(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LangFlow API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text || '';

    // Extract Summary and Actionable from response
    const summaryMatch = message.match(/Summary:?\s*([^\n]+)/i);
    const actionableMatch = message.match(/Actionable:?\s*([^\n]+)/i);

    const interpretation = summaryMatch
      ? summaryMatch[1].replace(/\*\*/g, '').trim()
      : message.replace(/\n+/g, ' ').trim().slice(0, 150);

    const insight = actionableMatch
      ? actionableMatch[1].replace(/\*\*/g, '').trim()
      : undefined;

    res.json({
      interpretation,
      insight,
      rawResponse: message,
      queriedAt: new Date().toISOString(),
      source: 'langflow-agent',
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Running containers count endpoint
app.get('/api/metrics/running-containers', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    const query = `sum:docker.containers.running{${DEFAULT_HOST}}`;
    const data = await queryDatadog(query, from, now);

    if (data.series && data.series.length > 0) {
      const series = data.series[0];
      const points = series.pointlist || [];
      const currentValue = points.length > 0 ? points[points.length - 1][1] : null;

      res.json({
        metric: 'running_containers',
        displayName: 'Running Containers',
        currentValue: currentValue !== null ? Math.round(currentValue) : null,
        unit: '',
        status: 'healthy',
        queriedAt: new Date().toISOString(),
      });
    } else {
      res.json({
        metric: 'running_containers',
        displayName: 'Running Containers',
        currentValue: null,
        unit: '',
        status: 'unknown',
        queriedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Container memory usage endpoint
app.get('/api/metrics/container/:containerName/memory', async (req, res) => {
  try {
    const { containerName } = req.params;
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    const query = `avg:docker.mem.rss{container_name:${containerName}}`;
    const data = await queryDatadog(query, from, now);

    if (data.series && data.series.length > 0) {
      const series = data.series[0];
      const points = series.pointlist || [];
      const currentValue = points.length > 0 ? points[points.length - 1][1] : null;

      // Convert bytes to MiB
      const mibValue = currentValue !== null ? currentValue / (1024 * 1024) : null;

      // Determine status based on memory thresholds (500MB warning, 1GB critical)
      let status = 'healthy';
      if (mibValue !== null) {
        if (mibValue >= 1024) {
          status = 'critical';
        } else if (mibValue >= 500) {
          status = 'warning';
        }
      }

      res.json({
        containerName,
        metric: 'memory_usage',
        displayName: `${containerName} Memory Usage`,
        currentValue: mibValue !== null ? parseFloat(mibValue.toFixed(1)) : null,
        unit: 'MiB',
        status,
        queriedAt: new Date().toISOString(),
      });
    } else {
      res.json({
        containerName,
        metric: 'memory_usage',
        displayName: `${containerName} Memory Usage`,
        currentValue: null,
        unit: 'MiB',
        status: 'unknown',
        queriedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// n8n workflow execution metrics (Gmail Filter)
app.get('/api/metrics/n8n/gmail-filter', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1d';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    // Query for successful and failed executions
    const successQuery = 'sum:gmail_filter.executions{automation:gmail_filter,status:success}.as_count()';
    const failedQuery = 'sum:gmail_filter.executions{automation:gmail_filter,status:failure}.as_count()';
    const durationQuery = 'avg:gmail.filter_execution_time{*}';
    const runtimeQuery = 'avg:gmail_filter.runtime_seconds{automation:gmail_filter}';

    // Query all-time history (last 30 days as max for historical total)
    const historicalFrom = now - (30 * 24 * 3600); // 30 days ago
    const allTimeSuccessQuery = 'sum:gmail_filter.executions{automation:gmail_filter,status:success}.as_count()';
    const allTimeFailedQuery = 'sum:gmail_filter.executions{automation:gmail_filter,status:failure}.as_count()';

    const [successData, failedData, durationData, runtimeData, allTimeSuccessData, allTimeFailedData] = await Promise.all([
      queryDatadog(successQuery, from, now),
      queryDatadog(failedQuery, from, now),
      queryDatadog(durationQuery, from, now).catch(() => null), // Optional metric
      queryDatadog(runtimeQuery, from, now).catch(() => null), // Optional metric
      queryDatadog(allTimeSuccessQuery, historicalFrom, now),
      queryDatadog(allTimeFailedQuery, historicalFrom, now),
    ]);

    let successCount = 0;
    let failedCount = 0;

    if (successData.series && successData.series.length > 0) {
      const points = successData.series[0].pointlist || [];
      successCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    if (failedData.series && failedData.series.length > 0) {
      const points = failedData.series[0].pointlist || [];
      failedCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    const totalCount = successCount + failedCount;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;

    // Query previous period for trend calculation
    const periodLength = now - from;
    const prevFrom = from - periodLength;
    const prevTo = from;

    const [prevSuccessData, prevFailedData] = await Promise.all([
      queryDatadog(successQuery, prevFrom, prevTo),
      queryDatadog(failedQuery, prevFrom, prevTo),
    ]);

    let prevSuccessCount = 0;
    let prevFailedCount = 0;

    if (prevSuccessData.series && prevSuccessData.series.length > 0) {
      const points = prevSuccessData.series[0].pointlist || [];
      prevSuccessCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    if (prevFailedData.series && prevFailedData.series.length > 0) {
      const points = prevFailedData.series[0].pointlist || [];
      prevFailedCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    const prevTotalCount = prevSuccessCount + prevFailedCount;
    const prevSuccessRate = prevTotalCount > 0 ? (prevSuccessCount / prevTotalCount) * 100 : 100;

    // Calculate trend
    const trend = successRate - prevSuccessRate;
    const trendDirection = trend > 1 ? 'up' : trend < -1 ? 'down' : 'flat';

    // Calculate average execution duration
    let avgDuration = null;
    if (durationData && durationData.series && durationData.series.length > 0) {
      const points = durationData.series[0].pointlist || [];
      if (points.length > 0) {
        const sum = points.reduce((acc: number, point: number[]) => acc + (point[1] || 0), 0);
        avgDuration = parseFloat((sum / points.length).toFixed(2));
      }
    }

    // Calculate average runtime and last execution timestamp
    let avgRuntime = null;
    let lastRunTimestamp = null;
    if (runtimeData && runtimeData.series && runtimeData.series.length > 0) {
      const points = runtimeData.series[0].pointlist || [];
      if (points.length > 0) {
        const sum = points.reduce((acc: number, point: number[]) => acc + (point[1] || 0), 0);
        avgRuntime = parseFloat((sum / points.length).toFixed(2));

        // Get the most recent timestamp (last point in the series)
        const lastPoint = points[points.length - 1];
        lastRunTimestamp = lastPoint[0]; // timestamp is in milliseconds
      }
    }

    // Calculate all-time historical total
    let allTimeSuccessCount = 0;
    let allTimeFailedCount = 0;

    if (allTimeSuccessData && allTimeSuccessData.series && allTimeSuccessData.series.length > 0) {
      const points = allTimeSuccessData.series[0].pointlist || [];
      allTimeSuccessCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    if (allTimeFailedData && allTimeFailedData.series && allTimeFailedData.series.length > 0) {
      const points = allTimeFailedData.series[0].pointlist || [];
      allTimeFailedCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    const allTimeTotal = Math.round(allTimeSuccessCount + allTimeFailedCount);

    res.json({
      workflow: 'gmail_filter',
      displayName: 'Gmail Filter',
      metrics: {
        successful: Math.round(successCount),
        failed: Math.round(failedCount),
        successRate: parseFloat(successRate.toFixed(1)),
        totalExecutions: Math.round(totalCount),
        allTimeTotal,
        avgDuration,
        avgRuntime,
        lastRunTimestamp,
        trend: {
          direction: trendDirection,
          value: parseFloat(Math.abs(trend).toFixed(1)),
          period: `vs prev ${timeWindow}`,
        },
      },
      status: failedCount > 0 ? 'warning' : 'healthy',
      queriedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// n8n workflow execution metrics (Image Generator)
app.get('/api/metrics/n8n/image-generator', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1d';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    const successQuery = 'sum:image_generator.executions{status:success}.as_count()';
    const failedQuery = 'sum:image_generator.executions{status:failure}.as_count()';
    const durationQuery = 'avg:image_generator.execution_time{*}';
    const runtimeQuery = 'avg:image_generator.runtime_seconds{*}';

    // Query all-time history (last 30 days as max for historical total)
    const historicalFrom = now - (30 * 24 * 3600); // 30 days ago
    const allTimeSuccessQuery = 'sum:image_generator.executions{status:success}.as_count()';
    const allTimeFailedQuery = 'sum:image_generator.executions{status:failure}.as_count()';

    const [successData, failedData, durationData, runtimeData, allTimeSuccessData, allTimeFailedData] = await Promise.all([
      queryDatadog(successQuery, from, now),
      queryDatadog(failedQuery, from, now),
      queryDatadog(durationQuery, from, now).catch(() => null), // Optional metric
      queryDatadog(runtimeQuery, from, now).catch(() => null), // Optional metric
      queryDatadog(allTimeSuccessQuery, historicalFrom, now),
      queryDatadog(allTimeFailedQuery, historicalFrom, now),
    ]);

    let successCount = 0;
    let failedCount = 0;

    if (successData.series && successData.series.length > 0) {
      const points = successData.series[0].pointlist || [];
      successCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    if (failedData.series && failedData.series.length > 0) {
      const points = failedData.series[0].pointlist || [];
      failedCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    const totalCount = successCount + failedCount;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;

    // Query previous period for trend calculation
    const periodLength = now - from;
    const prevFrom = from - periodLength;
    const prevTo = from;

    const [prevSuccessData, prevFailedData] = await Promise.all([
      queryDatadog(successQuery, prevFrom, prevTo),
      queryDatadog(failedQuery, prevFrom, prevTo),
    ]);

    let prevSuccessCount = 0;
    let prevFailedCount = 0;

    if (prevSuccessData.series && prevSuccessData.series.length > 0) {
      const points = prevSuccessData.series[0].pointlist || [];
      prevSuccessCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    if (prevFailedData.series && prevFailedData.series.length > 0) {
      const points = prevFailedData.series[0].pointlist || [];
      prevFailedCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    const prevTotalCount = prevSuccessCount + prevFailedCount;
    const prevSuccessRate = prevTotalCount > 0 ? (prevSuccessCount / prevTotalCount) * 100 : 100;

    // Calculate trend
    const trend = successRate - prevSuccessRate;
    const trendDirection = trend > 1 ? 'up' : trend < -1 ? 'down' : 'flat';

    // Calculate average execution duration
    let avgDuration = null;
    if (durationData && durationData.series && durationData.series.length > 0) {
      const points = durationData.series[0].pointlist || [];
      if (points.length > 0) {
        const sum = points.reduce((acc: number, point: number[]) => acc + (point[1] || 0), 0);
        avgDuration = parseFloat((sum / points.length).toFixed(2));
      }
    }

    // Calculate average runtime and last execution timestamp
    let avgRuntime = null;
    let lastRunTimestamp = null;
    if (runtimeData && runtimeData.series && runtimeData.series.length > 0) {
      const points = runtimeData.series[0].pointlist || [];
      if (points.length > 0) {
        const sum = points.reduce((acc: number, point: number[]) => acc + (point[1] || 0), 0);
        avgRuntime = parseFloat((sum / points.length).toFixed(2));

        // Get the most recent timestamp (last point in the series)
        const lastPoint = points[points.length - 1];
        lastRunTimestamp = lastPoint[0]; // timestamp is in milliseconds
      }
    }

    // Calculate all-time historical total
    let allTimeSuccessCount = 0;
    let allTimeFailedCount = 0;

    if (allTimeSuccessData && allTimeSuccessData.series && allTimeSuccessData.series.length > 0) {
      const points = allTimeSuccessData.series[0].pointlist || [];
      allTimeSuccessCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    if (allTimeFailedData && allTimeFailedData.series && allTimeFailedData.series.length > 0) {
      const points = allTimeFailedData.series[0].pointlist || [];
      allTimeFailedCount = points.reduce((sum: number, point: number[]) => sum + (point[1] || 0), 0);
    }

    const allTimeTotal = Math.round(allTimeSuccessCount + allTimeFailedCount);

    res.json({
      workflow: 'image_generator',
      displayName: 'Image Generator',
      metrics: {
        successful: Math.round(successCount),
        failed: Math.round(failedCount),
        successRate: parseFloat(successRate.toFixed(1)),
        totalExecutions: Math.round(totalCount),
        allTimeTotal,
        avgDuration,
        avgRuntime,
        lastRunTimestamp,
        trend: {
          direction: trendDirection,
          value: parseFloat(Math.abs(trend).toFixed(1)),
          period: `vs prev ${timeWindow}`,
        },
      },
      status: failedCount > 0 ? 'warning' : 'healthy',
      queriedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Running containers list endpoint - returns table data for all containers
app.get('/api/metrics/containers-list', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    // Query for container memory, CPU, and restarts by container name
    const memoryQuery = `avg:docker.mem.rss{${DEFAULT_HOST}} by {container_name}`;
    const cpuQuery = `avg:docker.cpu.usage{${DEFAULT_HOST}} by {container_name}`;
    const restartQuery = `sum:docker.containers.restarts{${DEFAULT_HOST}} by {container_name}`;

    const [memoryData, cpuData, restartData] = await Promise.all([
      queryDatadog(memoryQuery, from, now),
      queryDatadog(cpuQuery, from, now),
      queryDatadog(restartQuery, from, now),
    ]);

    // Build a map of container metrics
    const containerMap = new Map<string, { memory: number | null; cpu: number | null; restarts: number | null }>();

    // Process memory data
    if (memoryData.series) {
      for (const series of memoryData.series) {
        const containerName = series.scope?.split(':')[1] || series.tag_set?.[0]?.split(':')[1];
        if (containerName) {
          const points = series.pointlist || [];
          const lastValue = points.length > 0 ? points[points.length - 1][1] : null;
          const mibValue = lastValue !== null ? lastValue / (1024 * 1024) : null;

          if (!containerMap.has(containerName)) {
            containerMap.set(containerName, { memory: null, cpu: null, restarts: null });
          }
          containerMap.get(containerName)!.memory = mibValue;
        }
      }
    }

    // Process CPU data
    if (cpuData.series) {
      for (const series of cpuData.series) {
        const containerName = series.scope?.split(':')[1] || series.tag_set?.[0]?.split(':')[1];
        if (containerName) {
          const points = series.pointlist || [];
          const lastValue = points.length > 0 ? points[points.length - 1][1] : null;

          if (!containerMap.has(containerName)) {
            containerMap.set(containerName, { memory: null, cpu: null, restarts: null });
          }
          containerMap.get(containerName)!.cpu = lastValue;
        }
      }
    }

    // Process restart data
    if (restartData.series) {
      for (const series of restartData.series) {
        const containerName = series.scope?.split(':')[1] || series.tag_set?.[0]?.split(':')[1];
        if (containerName) {
          const points = series.pointlist || [];
          const lastValue = points.length > 0 ? points[points.length - 1][1] : null;
          const roundedValue = lastValue !== null ? Math.round(lastValue) : null;

          if (!containerMap.has(containerName)) {
            containerMap.set(containerName, { memory: null, cpu: null, restarts: null });
          }
          containerMap.get(containerName)!.restarts = roundedValue;
        }
      }
    }

    // Convert to array and sort by memory usage (descending)
    const containers = Array.from(containerMap.entries())
      .map(([name, metrics]) => ({
        name,
        memory: metrics.memory !== null ? parseFloat(metrics.memory.toFixed(1)) : null,
        cpu: metrics.cpu !== null ? parseFloat(metrics.cpu.toFixed(2)) : null,
        restarts: metrics.restarts !== null ? metrics.restarts : null,
      }))
      .filter(c => c.memory !== null || c.cpu !== null || c.restarts !== null)
      .sort((a, b) => (b.memory || 0) - (a.memory || 0));

    res.json({
      containers,
      count: containers.length,
      queriedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// System uptime endpoint - returns uptime in human-readable format
app.get('/api/metrics/uptime', async (req, res) => {
  try {
    const timeWindow = (req.query.timeWindow as string) || '1h';
    const now = Math.floor(Date.now() / 1000);
    const from = now - parseTimeWindow(timeWindow);

    const query = `avg:system.uptime{${DEFAULT_HOST}}`;
    const data = await queryDatadog(query, from, now);

    if (data.series && data.series.length > 0) {
      const series = data.series[0];
      const points = series.pointlist || [];
      const uptimeSeconds = points.length > 0 ? points[points.length - 1][1] : null;

      // Convert seconds to human-readable format
      let displayValue = 'N/A';
      if (uptimeSeconds !== null) {
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);

        if (days > 0) {
          displayValue = `${days}d ${hours}h`;
        } else if (hours > 0) {
          displayValue = `${hours}h ${minutes}m`;
        } else {
          displayValue = `${minutes}m`;
        }
      }

      res.json({
        metric: 'uptime',
        displayName: 'System Uptime',
        currentValue: displayValue,
        rawSeconds: uptimeSeconds,
        unit: '',
        status: 'healthy',
        queriedAt: new Date().toISOString(),
      });
    } else {
      res.json({
        metric: 'uptime',
        displayName: 'System Uptime',
        currentValue: 'N/A',
        rawSeconds: null,
        unit: '',
        status: 'unknown',
        queriedAt: new Date().toISOString(),
        error: 'No uptime data found',
      });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// =============================================================================
// AWS COST ENDPOINTS
// =============================================================================

// AWS costs for current billing month
app.get('/api/costs/aws', async (_req, res) => {
  try {
    if (!costExplorerClient) {
      return res.status(503).json({
        error: 'AWS Cost Explorer not configured',
        message: 'Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY environment variables',
      });
    }

    const costs = await fetchAWSCosts();
    res.json(costs);
  } catch (error) {
    console.error('[AWS Costs] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'aws-cost-explorer',
    });
  }
});

// AWS cost forecast for end of billing month
app.get('/api/costs/aws/forecast', async (_req, res) => {
  try {
    if (!costExplorerClient) {
      return res.status(503).json({
        error: 'AWS Cost Explorer not configured',
        message: 'Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY environment variables',
      });
    }

    const forecast = await fetchAWSForecast();
    res.json(forecast);
  } catch (error) {
    console.error('[AWS Forecast] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'aws-cost-explorer',
    });
  }
});

// Demo data for AWS costs when not configured (using real-looking values)
const getAWSDemoData = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    totalCost: 113.49,
    currency: 'USD',
    period: {
      start: startOfMonth.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    },
    breakdown: [
      { name: 'AWS Cost Explorer', cost: 43.25, percentage: 38.1 },
      { name: 'Amazon Elastic Compute Cloud - Compute', cost: 39.34, percentage: 34.7 },
      { name: 'Amazon Registrar', cost: 15.00, percentage: 13.2 },
      { name: 'Tax', cost: 6.10, percentage: 5.4 },
      { name: 'EC2 - Other', cost: 4.40, percentage: 3.9 },
      { name: 'Amazon Virtual Private Cloud', cost: 3.03, percentage: 2.7 },
      { name: 'Amazon Route 53', cost: 1.03, percentage: 0.9 },
      { name: 'AWS Secrets Manager', cost: 0.65, percentage: 0.6 },
      { name: 'AmazonCloudWatch', cost: 0.51, percentage: 0.5 },
      { name: 'Amazon EC2 Container Registry (ECR)', cost: 0.12, percentage: 0.1 },
    ],
    dailyAverage: 4.36,
    projectedMonthEnd: 141.66,
    isDemo: true,
  };
};

const getAWSForecastDemoData = () => {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    forecastedCost: 141.66,
    currency: 'USD',
    period: {
      start: now.toISOString().split('T')[0],
      end: endOfMonth.toISOString().split('T')[0],
    },
    confidence: 'HIGH',
    isDemo: true,
  };
};

// Cache for AWS costs (24-hour TTL to minimize API calls)
let awsCostsCache: {
  data: any;
  timestamp: number;
} | null = null;

const AWS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Combined costs overview (AWS + forecast)
app.get('/api/costs/overview', async (_req, res) => {
  try {
    const result: {
      aws: any;
      forecast: any;
      totalCurrentCost: number;
      currency: string;
      queriedAt: string;
    } = {
      aws: null,
      forecast: null,
      totalCurrentCost: 0,
      currency: 'USD',
      queriedAt: new Date().toISOString(),
    };

    // Fetch AWS costs if configured, otherwise use demo data
    if (costExplorerClient) {
      try {
        const now = Date.now();

        // Check if we have valid cached data (less than 24 hours old)
        if (awsCostsCache && (now - awsCostsCache.timestamp) < AWS_CACHE_TTL) {
          console.log('[Costs Overview] Using cached data (age: ' +
            Math.round((now - awsCostsCache.timestamp) / 1000 / 60) + ' minutes)');
          res.json(awsCostsCache.data);
          return;
        }

        // Cache is stale or doesn't exist - fetch fresh data
        console.log('[Costs Overview] Fetching fresh AWS data (cache expired or missing)');
        const [awsCosts, awsForecast] = await Promise.all([
          fetchAWSCosts(),
          fetchAWSForecast().catch(() => null), // Forecast can fail, don't block
        ]);
        result.aws = awsCosts;
        result.forecast = awsForecast;
        result.totalCurrentCost = awsCosts.totalCost;

        // Update cache
        awsCostsCache = {
          data: result,
          timestamp: now,
        };
        console.log('[Costs Overview] Cache updated, next refresh in 24 hours');
      } catch (error) {
        // On error, fall back to demo data
        console.log('[Costs Overview] AWS fetch failed, using demo data');
        result.aws = getAWSDemoData();
        result.forecast = getAWSForecastDemoData();
        result.totalCurrentCost = result.aws.totalCost;
      }
    } else {
      // AWS not configured - use demo data
      console.log('[Costs Overview] AWS not configured, using demo data');
      result.aws = getAWSDemoData();
      result.forecast = getAWSForecastDemoData();
      result.totalCurrentCost = result.aws.totalCost;
    }

    res.json(result);
  } catch (error) {
    console.error('[Costs Overview] Error:', error);
    // Even on total failure, return demo data
    res.json({
      aws: getAWSDemoData(),
      forecast: getAWSForecastDemoData(),
      totalCurrentCost: getAWSDemoData().totalCost,
      currency: 'USD',
      queriedAt: new Date().toISOString(),
    });
  }
});

// =============================================================================
// AWS ECR ENDPOINTS
// =============================================================================

// Get ECR repositories summary
app.get('/api/ecr/summary', async (_req, res) => {
  // Demo data for when ECR access is not available
  const getDemoData = () => ({
    repositoryCount: 1,
    repositories: [
      {
        name: 'generative-ui',
        uri: '070322435379.dkr.ecr.us-east-1.amazonaws.com/generative-ui',
        created: '2024-12-15T10:30:00.000Z',
        totalImages: 8,
        recentImages: [
          { tags: ['latest', 'v1.2.8'], pushed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), size: '245.32 MB' },
          { tags: ['v1.2.7'], pushed: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), size: '243.18 MB' },
          { tags: ['v1.2.6'], pushed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), size: '241.55 MB' },
        ],
      },
    ],
    queriedAt: new Date().toISOString(),
    source: 'aws-ecr',
  });

  if (!ecrClient) {
    console.log('[ECR] Client not configured, returning demo data');
    return res.json(getDemoData());
  }

  try {
    // Get all repositories
    const reposResponse = await ecrClient.send(new DescribeRepositoriesCommand({}));
    const repositories = reposResponse.repositories || [];

    // Get images for each repository
    const repoDetails = await Promise.all(
      repositories.map(async (repo) => {
        try {
          const imagesResponse = await ecrClient!.send(
            new DescribeImagesCommand({
              repositoryName: repo.repositoryName,
              maxResults: 10,
              filter: { tagStatus: 'TAGGED' },
            })
          );

          const images = imagesResponse.imageDetails || [];
          const recentImages = images
            .sort((a, b) => {
              const dateA = a.imagePushedAt ? new Date(a.imagePushedAt).getTime() : 0;
              const dateB = b.imagePushedAt ? new Date(b.imagePushedAt).getTime() : 0;
              return dateB - dateA;
            })
            .slice(0, 3)
            .map((img) => ({
              tags: img.imageTags || [],
              pushed: img.imagePushedAt ? img.imagePushedAt.toISOString() : 'Unknown',
              size: img.imageSizeInBytes
                ? `${(img.imageSizeInBytes / 1024 / 1024).toFixed(2)} MB`
                : 'Unknown',
            }));

          return {
            name: repo.repositoryName || 'Unknown',
            uri: repo.repositoryUri || '',
            created: repo.createdAt ? repo.createdAt.toISOString() : 'Unknown',
            totalImages: images.length,
            recentImages,
          };
        } catch (err) {
          console.error(`[ECR] Error fetching images for ${repo.repositoryName}:`, err);
          return {
            name: repo.repositoryName || 'Unknown',
            uri: repo.repositoryUri || '',
            created: repo.createdAt ? repo.createdAt.toISOString() : 'Unknown',
            totalImages: 0,
            recentImages: [],
            error: err instanceof Error ? err.message : 'Failed to fetch images',
          };
        }
      })
    );

    res.json({
      repositoryCount: repositories.length,
      repositories: repoDetails,
      queriedAt: new Date().toISOString(),
      source: 'aws-ecr',
    });
  } catch (error) {
    console.error('[ECR Summary] Error:', error);
    // Return demo data on error instead of failing
    console.log('[ECR] Returning demo data due to error');
    res.json(getDemoData());
  }
});

// =============================================================================
// CLAUDE USAGE ENDPOINTS
// =============================================================================

// Get Claude Code usage for current project
app.get('/api/claude-usage/code', async (req, res) => {
  try {
    // Get current project path from query or use default
    const projectPath = (req.query.projectPath as string) || process.cwd();
    const plan = (req.query.plan as string) || 'pro';

    // Validate plan
    const validPlans = ['free', 'pro', 'max5', 'max20'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        error: `Invalid plan. Must be one of: ${validPlans.join(', ')}`,
      });
    }

    const usage = await getClaudeCodeUsage(
      projectPath,
      plan as 'free' | 'pro' | 'max5' | 'max20'
    );

    res.json({
      ...usage,
      queriedAt: new Date().toISOString(),
      source: 'local-jsonl',
    });
  } catch (error) {
    console.error('[Claude Usage] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'claude-usage',
    });
  }
});

// Get API credits usage (manual entry data)
app.get('/api/claude-usage/api-credits', async (_req, res) => {
  try {
    const credits = getApiCreditsUsage();

    if (!credits) {
      return res.json({
        configured: false,
        message: 'No API credits data configured. Use POST to set initial balance.',
      });
    }

    res.json({
      ...credits,
      configured: true,
      queriedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API Credits] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'api-credits',
    });
  }
});

// Update API credits balance (manual entry)
app.post('/api/claude-usage/api-credits', async (req, res) => {
  try {
    const { balance } = req.body;

    if (typeof balance !== 'number' || balance < 0) {
      return res.status(400).json({
        error: 'Invalid balance. Must be a non-negative number.',
      });
    }

    const storage = updateBalance(balance, 'manual');
    const credits = getApiCreditsUsage();

    res.json({
      success: true,
      message: 'Balance updated successfully',
      data: credits,
      updatedAt: storage.lastUpdated,
    });
  } catch (error) {
    console.error('[API Credits] Error updating balance:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'api-credits',
    });
  }
});

// Get API token usage from Anthropic Admin API
app.get('/api/claude-usage/api-tokens', async (_req, res) => {
  try {
    // Check for Admin API key in environment or storage
    const apiKey = process.env.ANTHROPIC_ADMIN_API_KEY || getAdminApiKey();

    if (!apiKey) {
      return res.status(400).json({
        error: 'Admin API key not configured',
        message: 'Set ANTHROPIC_ADMIN_API_KEY environment variable or configure via POST /api/claude-usage/admin-api-key',
        hasAdminApi: false,
      });
    }

    const tokenUsage = await getAnthropicTokenUsage(apiKey);

    res.json({
      ...tokenUsage,
      hasAdminApi: true,
      queriedAt: new Date().toISOString(),
      source: 'anthropic-admin-api',
    });
  } catch (error) {
    console.error('[Admin API] Error fetching token usage:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    // Check if it's a rate limit error and return appropriate status
    const isRateLimit = errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate');
    res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit ? 'Rate limit exceeded - too many API requests' : errorMsg,
      source: 'anthropic-admin-api',
    });
  }
});

// Configure Admin API key
app.post('/api/claude-usage/admin-api-key', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({
        error: 'Invalid API key. Must be a non-empty string.',
      });
    }

    // Validate the key by making a test request
    const isValid = await validateAdminApiKey(apiKey);

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid Admin API key. The key could not be validated.',
        message: 'Ensure you are using an Admin API key (starts with sk-ant-admin...)',
      });
    }

    // Save the key
    saveAdminApiKey(apiKey);

    res.json({
      success: true,
      message: 'Admin API key configured successfully',
      hasAdminApi: true,
    });
  } catch (error) {
    console.error('[Admin API] Error configuring key:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'admin-api-config',
    });
  }
});

// Check Admin API configuration status
app.get('/api/claude-usage/admin-api-status', async (_req, res) => {
  try {
    const envKey = process.env.ANTHROPIC_ADMIN_API_KEY;
    const storedKey = getAdminApiKey();
    const hasKey = !!(envKey || storedKey);

    res.json({
      hasAdminApi: hasKey,
      keySource: envKey ? 'environment' : storedKey ? 'storage' : 'none',
    });
  } catch (error) {
    console.error('[Admin API] Error checking status:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'admin-api-status',
    });
  }
});

// =============================================================================
// ERROR RESPONSE HELPERS (Phase 34)
// =============================================================================

/**
 * Generate unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Error codes for programmatic handling
 */
enum ErrorCode {
  AUTH_MISSING = 'AUTH_MISSING',
  AUTH_INVALID = 'AUTH_INVALID',
  VALIDATION_MISSING_FIELD = 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_TYPE = 'VALIDATION_INVALID_TYPE',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Build detailed error response
 */
function buildErrorResponse(
  errorCode: ErrorCode,
  message: string,
  suggestion: string,
  requestId?: string
): object {
  return {
    errorCode,
    message,
    suggestion,
    requestId: requestId || generateRequestId(),
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// CLAUDE CONSOLE SCRAPED DATA
// =============================================================================

import fs from 'fs';
import { initializeStorage, saveVersion, cleanupOldVersions, listVersions, getStorageMetadata, parseTimestampFromFilename } from './console-storage.js';

const CONSOLE_USAGE_FILE = path.join(__dirname, 'claude-scraper/usage-data.json');
const CONSOLE_USAGE_SYNCED_FILE = path.join(__dirname, 'claude-scraper/console-usage-synced.json');
const CLAUDE_CONFIG_FILE = path.join(__dirname, 'claude-config.json');

// Get Claude plan config
app.get('/api/claude-usage/config', async (_req, res) => {
  try {
    if (!fs.existsSync(CLAUDE_CONFIG_FILE)) {
      return res.status(404).json({ error: 'No config file. Create server/claude-config.json' });
    }
    const config = JSON.parse(fs.readFileSync(CLAUDE_CONFIG_FILE, 'utf-8'));
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// ============================================================================
// Claude Console Usage - EC2 Sync Architecture
// ============================================================================
// Widget fetches from GET /api/claude/console-usage (synced data)
// Scraper POSTs to POST /api/claude/console-usage (sync new data)
// Legacy endpoints (local scraper file) removed in Phase 33

// GET endpoint for serving synced Claude Console usage data
// Supports optional query parameters for version-based and timestamp-based retrieval
app.get('/api/claude/console-usage', async (req, res) => {
  const requestId = generateRequestId();

  try {
    const versionParam = req.query.version as string | undefined;
    const timestampParam = req.query.timestamp as string | undefined;

    // Get storage metadata for version info
    const metadata = getStorageMetadata();

    // If no versions exist, return 404
    if (metadata.versionCount === 0) {
      console.log(`[Console GET] No versions available (${requestId})`);
      return res.status(404).json({
        ...buildErrorResponse(
          ErrorCode.NOT_FOUND,
          'No usage data available',
          'The scraper needs to run and sync data first. Check scraper status.',
          requestId
        ),
        versionsAvailable: 0,
        source: 'ec2-sync',
      });
    }

    let selectedFile: string | null = null;
    let versionNumber: number = metadata.versionCount; // Default to latest

    // CASE 1: Timestamp-based retrieval
    if (timestampParam) {
      console.log(`[Console GET] Timestamp query: ${timestampParam}`);

      // Validate timestamp format
      const requestedTime = new Date(timestampParam);
      if (isNaN(requestedTime.getTime())) {
        return res.status(400).json({
          error: 'Invalid timestamp format',
          message: 'Timestamp must be a valid ISO 8601 date string',
          example: '2025-01-24T10:00:00Z',
        });
      }

      // Find nearest version by timestamp
      const allVersions = listVersions();
      if (allVersions.length === 0) {
        return res.status(404).json({
          error: 'No versions available',
          versionsAvailable: 0,
        });
      }

      const targetTime = requestedTime.getTime();
      let closestFile: string | null = null;
      let smallestDiff = Infinity;
      let closestIndex = -1;

      for (let i = 0; i < allVersions.length; i++) {
        const filepath = allVersions[i];
        const filename = path.basename(filepath);
        const fileTime = parseTimestampFromFilename(filename);

        if (fileTime) {
          const diff = Math.abs(fileTime.getTime() - targetTime);
          if (diff < smallestDiff) {
            smallestDiff = diff;
            closestFile = filepath;
            closestIndex = i;
          }
        }
      }

      if (!closestFile) {
        return res.status(404).json({
          error: 'No valid versions found',
          versionsAvailable: allVersions.length,
        });
      }

      selectedFile = closestFile;
      versionNumber = allVersions.length - closestIndex; // Convert to 1-based
      console.log(`[Console GET] Found nearest version: ${path.basename(closestFile)} (diff: ${Math.round(smallestDiff / 1000)}s)`);
    }
    // CASE 2: Version-based retrieval
    else if (versionParam) {
      console.log(`[Console GET] Version query: ${versionParam}`);

      const versionInt = parseInt(versionParam, 10);
      if (isNaN(versionInt)) {
        return res.status(400).json({
          error: 'Invalid version parameter',
          message: 'Version must be an integer',
          validRange: `1 to ${metadata.versionCount} or -1 to -${metadata.versionCount}`,
        });
      }

      // Get all versions (sorted newest-first)
      const allVersions = listVersions();

      // Convert version number to array index
      let arrayIndex: number;
      if (versionInt < 0) {
        // Negative indexing: -1 = latest, -2 = second-latest
        arrayIndex = Math.abs(versionInt) - 1;
      } else if (versionInt > 0) {
        // Positive indexing: 1 = oldest, 2 = second-oldest
        arrayIndex = allVersions.length - versionInt;
      } else {
        return res.status(400).json({
          error: 'Invalid version number',
          message: 'Version cannot be 0',
          validRange: `1 to ${metadata.versionCount} or -1 to -${metadata.versionCount}`,
        });
      }

      // Check if version is in range
      if (arrayIndex < 0 || arrayIndex >= allVersions.length) {
        return res.status(400).json({
          error: 'Version out of range',
          message: `Version ${versionInt} does not exist`,
          validRange: `1 to ${metadata.versionCount} or -1 to -${metadata.versionCount}`,
          versionsAvailable: metadata.versionCount,
        });
      }

      selectedFile = allVersions[arrayIndex];
      versionNumber = versionInt < 0 ? allVersions.length + versionInt + 1 : versionInt;
      console.log(`[Console GET] Selected version ${versionNumber}: ${path.basename(selectedFile)}`);
    }
    // CASE 3: Latest version (no query params)
    else {
      console.log('[Console GET] Latest version request');

      // Try to read from latest symlink file first
      if (fs.existsSync(CONSOLE_USAGE_SYNCED_FILE)) {
        selectedFile = CONSOLE_USAGE_SYNCED_FILE;
      } else {
        // Fall back to newest versioned file
        const versions = listVersions(1);
        if (versions.length > 0) {
          selectedFile = versions[0];
        }
      }

      if (!selectedFile) {
        return res.status(404).json({
          error: 'No data available',
          message: 'No synced data found',
          versionsAvailable: 0,
        });
      }

      versionNumber = metadata.versionCount;
    }

    // Read the selected file
    if (!fs.existsSync(selectedFile)) {
      console.error(`[Console GET] File not found: ${selectedFile}`);
      return res.status(500).json({
        error: 'Data file not found',
        message: 'Selected version file is missing',
      });
    }

    const fileData = fs.readFileSync(selectedFile, 'utf-8');
    const data: ConsoleUsageDataSync = JSON.parse(fileData);

    // Calculate data freshness
    const lastUpdatedDate = new Date(data.lastUpdated);
    const ageMinutes = Math.round((Date.now() - lastUpdatedDate.getTime()) / 1000 / 60);
    const isStale = ageMinutes > 10;

    // Extract file timestamp
    const filename = path.basename(selectedFile);
    const fileTimestamp = parseTimestampFromFilename(filename);
    const fileTimestampString = fileTimestamp ? fileTimestamp.toISOString() : data.lastUpdated;

    // Build response with metadata
    const response: ConsoleUsageResponse = {
      ...data,
      isStale,
      ageMinutes,
      source: 'ec2-sync',
      versionInfo: {
        current: versionNumber,
        total: metadata.versionCount,
        timestamp: fileTimestampString,
        filename: filename,
      },
    };

    // Set cache headers based on data freshness
    let cacheControl: string;
    if (ageMinutes < 5) {
      // Fresh data: cache for 1 minute
      cacheControl = 'public, max-age=60';
    } else if (ageMinutes < 10) {
      // Slightly stale: cache for 30 seconds
      cacheControl = 'public, max-age=30';
    } else {
      // Very stale: don't cache
      cacheControl = 'no-cache';
    }

    res.set('Cache-Control', cacheControl);

    // Set Last-Modified header
    res.set('Last-Modified', lastUpdatedDate.toUTCString());

    // Set ETag based on lastUpdated timestamp
    const etag = `"${lastUpdatedDate.getTime()}"`;
    res.set('ETag', etag);

    // Support conditional requests
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    if (ifNoneMatch === etag) {
      console.log('[Console GET] 304 Not Modified (ETag match)');
      return res.status(304).end();
    }

    if (ifModifiedSince) {
      const modifiedSinceDate = new Date(ifModifiedSince);
      if (!isNaN(modifiedSinceDate.getTime()) && lastUpdatedDate <= modifiedSinceDate) {
        console.log('[Console GET] 304 Not Modified (If-Modified-Since)');
        return res.status(304).end();
      }
    }

    // Log successful response
    console.log(
      `[Console GET] Served version ${versionNumber}/${metadata.versionCount} ` +
      `(age: ${ageMinutes}min, stale: ${isStale}, ` +
      `file: ${filename}, ` +
      `params: ${versionParam ? `version=${versionParam}` : timestampParam ? `timestamp=${timestampParam}` : 'latest'})`
    );

    res.json(response);
  } catch (error) {
    console.error(`[Console GET] Error (${requestId}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (errorStack) {
      console.error(`[Console GET] Stack trace (${requestId}):`, errorStack);
    }

    res.status(500).json({
      ...buildErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        errorMessage,
        'Check server logs for details or retry the request',
        requestId
      ),
      source: 'ec2-sync',
    });
  }
});

// POST endpoint for scraper-to-EC2 sync (receives usage data from laptop scraper)
app.post('/api/claude/console-usage', async (req, res) => {
  const requestId = generateRequestId();

  try {
    // Authenticate request
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      console.warn(`[Console Sync] Missing API key (${requestId})`);
      return res.status(401).json({
        ...buildErrorResponse(
          ErrorCode.AUTH_MISSING,
          'Missing API key',
          'Set CLAUDE_SYNC_API_KEY environment variable on scraper and EC2',
          requestId
        ),
        success: false,
      } as SyncResponse & { errorCode: string; suggestion: string; requestId: string });
    }

    if (apiKey !== CLAUDE_SYNC_API_KEY) {
      console.warn(`[Console Sync] Invalid API key (${requestId})`);
      return res.status(401).json({
        ...buildErrorResponse(
          ErrorCode.AUTH_INVALID,
          'Invalid API key',
          'Verify CLAUDE_SYNC_API_KEY matches on scraper and EC2',
          requestId
        ),
        success: false,
      } as SyncResponse & { errorCode: string; suggestion: string; requestId: string });
    }

    const data = req.body as ConsoleUsageDataSync;

    // Validate required structure
    if (!data.lastUpdated) {
      console.warn(`[Console Sync] Missing lastUpdated field (${requestId})`);
      return res.status(400).json({
        ...buildErrorResponse(
          ErrorCode.VALIDATION_MISSING_FIELD,
          'Missing required field: lastUpdated',
          'Ensure scraper includes lastUpdated timestamp in ISO 8601 format',
          requestId
        ),
        success: false,
      } as SyncResponse & { errorCode: string; suggestion: string; requestId: string });
    }

    // Validate lastUpdated is valid ISO string
    const lastUpdatedDate = new Date(data.lastUpdated);
    if (isNaN(lastUpdatedDate.getTime())) {
      console.warn(`[Console Sync] Invalid lastUpdated format (${requestId})`);
      return res.status(400).json({
        ...buildErrorResponse(
          ErrorCode.VALIDATION_INVALID_TYPE,
          'Invalid lastUpdated format',
          'lastUpdated must be a valid ISO 8601 timestamp (e.g., 2025-01-24T10:00:00Z)',
          requestId
        ),
        success: false,
      } as SyncResponse & { errorCode: string; suggestion: string; requestId: string });
    }

    // Validate currentSession if present
    if (data.currentSession) {
      if (!data.currentSession.resetsIn || typeof data.currentSession.resetsIn !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Invalid data: currentSession.resetsIn must be non-empty string',
          timestamp: new Date().toISOString(),
        } as SyncResponse);
      }
      if (typeof data.currentSession.percentageUsed !== 'number' ||
          data.currentSession.percentageUsed < 0 ||
          data.currentSession.percentageUsed > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid data: currentSession.percentageUsed must be 0-100',
          timestamp: new Date().toISOString(),
        } as SyncResponse);
      }
    }

    // Validate weeklyLimits if present
    if (data.weeklyLimits) {
      const { allModels, sonnetOnly } = data.weeklyLimits;

      if (!allModels || !sonnetOnly) {
        return res.status(400).json({
          success: false,
          message: 'Invalid data: weeklyLimits must include allModels and sonnetOnly',
          timestamp: new Date().toISOString(),
        } as SyncResponse);
      }

      // Validate allModels
      if (!allModels.resetsIn || typeof allModels.resetsIn !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Invalid data: weeklyLimits.allModels.resetsIn must be non-empty string',
          timestamp: new Date().toISOString(),
        } as SyncResponse);
      }
      if (typeof allModels.percentageUsed !== 'number' ||
          allModels.percentageUsed < 0 ||
          allModels.percentageUsed > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid data: weeklyLimits.allModels.percentageUsed must be 0-100',
          timestamp: new Date().toISOString(),
        } as SyncResponse);
      }

      // Validate sonnetOnly
      if (!sonnetOnly.resetsIn || typeof sonnetOnly.resetsIn !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Invalid data: weeklyLimits.sonnetOnly.resetsIn must be non-empty string',
          timestamp: new Date().toISOString(),
        } as SyncResponse);
      }
      if (typeof sonnetOnly.percentageUsed !== 'number' ||
          sonnetOnly.percentageUsed < 0 ||
          sonnetOnly.percentageUsed > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid data: weeklyLimits.sonnetOnly.percentageUsed must be 0-100',
          timestamp: new Date().toISOString(),
        } as SyncResponse);
      }
    }

    // Require at least currentSession or weeklyLimits
    if (!data.currentSession && !data.weeklyLimits) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data: must include at least currentSession or weeklyLimits',
        timestamp: new Date().toISOString(),
      } as SyncResponse);
    }

    // Save versioned data and update latest symlink
    let savedFilepath: string;
    try {
      savedFilepath = await saveVersion(data);
    } catch (writeError) {
      console.error(`[Console Sync] Storage error (${requestId}):`, writeError);
      const errorMessage = writeError instanceof Error ? writeError.message : 'Unknown storage error';

      // Categorize storage errors
      let suggestion = 'Check server logs and disk space';
      if (errorMessage.includes('ENOSPC')) {
        suggestion = 'Disk full - free up space on EC2 instance';
      } else if (errorMessage.includes('EACCES')) {
        suggestion = 'Permission denied - check directory permissions';
      } else if (errorMessage.includes('EROFS')) {
        suggestion = 'Read-only filesystem - check mount status';
      }

      return res.status(500).json({
        ...buildErrorResponse(
          ErrorCode.STORAGE_WRITE_FAILED,
          `Storage write failed: ${errorMessage}`,
          suggestion,
          requestId
        ),
        success: false,
      } as SyncResponse & { errorCode: string; suggestion: string; requestId: string });
    }

    // Trigger cleanup asynchronously (non-blocking)
    cleanupOldVersions().catch(err => {
      console.error('[Console Storage] Cleanup failed:', err);
      // Don't fail the request if cleanup fails
    });

    // Calculate data freshness
    const ageMinutes = Math.round((Date.now() - lastUpdatedDate.getTime()) / 1000 / 60);

    console.log(
      `[Console Sync] Data synced successfully (age: ${ageMinutes}min, ` +
      `partial: ${data.isPartial || false}, ` +
      `sections: ${data.currentSession ? 'session' : ''}${data.currentSession && data.weeklyLimits ? '+' : ''}${data.weeklyLimits ? 'limits' : ''}, ` +
      `saved: ${path.basename(savedFilepath)})`
    );

    res.json({
      success: true,
      message: 'Usage data synced successfully',
      timestamp: new Date().toISOString(),
    } as SyncResponse);
  } catch (error) {
    console.error(`[Console Sync] Unexpected error (${requestId}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (errorStack) {
      console.error(`[Console Sync] Stack trace (${requestId}):`, errorStack);
    }

    res.status(500).json({
      ...buildErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        errorMessage,
        'Check server logs for details or contact support',
        requestId
      ),
      success: false,
    } as SyncResponse & { errorCode: string; suggestion: string; requestId: string });
  }
});

// Trigger immediate scrape (manual refresh)
app.post('/api/claude/console-usage/trigger', async (req, res) => {
  const requestId = `trigger-${Date.now()}`;
  console.log(`[Console Trigger] Manual scrape triggered (${requestId})`);

  // Optional: Require API key for trigger endpoint (security)
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.CLAUDE_SYNC_API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid or missing API key',
      requestId,
    });
  }

  try {
    // Run scraper immediately
    const { scrape } = await import('./claude-scraper/scrape.js');
    console.log(`[Console Trigger] Running scraper (${requestId})...`);

    await scrape();

    console.log(`[Console Trigger] Scrape completed successfully (${requestId})`);

    res.json({
      success: true,
      message: 'Scrape triggered and completed successfully',
      timestamp: new Date().toISOString(),
      requestId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Console Trigger] Scrape failed (${requestId}):`, errorMessage);

    res.status(500).json({
      success: false,
      message: `Scrape failed: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Initialize Console usage storage layer
try {
  initializeStorage();
  console.log('[Console Storage] Initialized with versioning and retention policies');
} catch (error) {
  console.error('[Console Storage] Failed to initialize:', error);
  // Non-fatal - server can continue but sync will fail
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`CopilotKit endpoint: http://localhost:${PORT}/api/copilotkit`);

  // Log Console sync endpoint configuration
  if (CLAUDE_SYNC_API_KEY) {
    console.log(`[Console Sync] Endpoint configured: POST /api/claude/console-usage (authenticated)`);
  } else {
    console.log(`[Console Sync] Endpoint available but not secured (CLAUDE_SYNC_API_KEY not set)`);
  }
});
