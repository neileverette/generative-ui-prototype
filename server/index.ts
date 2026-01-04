import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import express from 'express';

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

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
const DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
const DATADOG_SITE = process.env.DATADOG_SITE || 'us5.datadoghq.com';
const LANGFLOW_URL = process.env.LANGFLOW_URL || 'https://langflow.neil-everette.com';
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;

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

  return response.json();
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
          value = parseFloat(value.toFixed(2));
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
    const query = `Query Datadog for CPU, Memory, Load, and Disk metrics. For each metric, provide a single concise sentence describing its current state and health.

Format your response exactly like this (no numbers, no bullet points):
CPU: [one sentence about current CPU state]
Memory: [one sentence about memory health]
Load: [one sentence about load average]
Disk: [one sentence about disk usage]

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

    // Extract CPU interpretation (format: "CPU: sentence")
    const cpuMatch = message.match(/CPU:?\s*([^\n]+)/i);
    if (cpuMatch) {
      interpretations['cpu_total'] = { interpretation: cleanText(cpuMatch[1]) };
    }

    // Extract Memory interpretation
    const memMatch = message.match(/Memory:?\s*([^\n]+)/i);
    if (memMatch) {
      interpretations['memory_used_percent'] = { interpretation: cleanText(memMatch[1]) };
    }

    // Extract Load interpretation
    const loadMatch = message.match(/Load:?\s*([^\n]+)/i);
    if (loadMatch) {
      interpretations['load_1min'] = { interpretation: cleanText(loadMatch[1]) };
    }

    // Extract Disk interpretation
    const diskMatch = message.match(/Disk:?\s*([^\n]+)/i);
    if (diskMatch) {
      interpretations['disk_used_percent'] = { interpretation: cleanText(diskMatch[1]) };
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
    const successQuery = 'sum:gmail.filter_executions{status:success}.as_count()';
    const failedQuery = 'sum:gmail.filter_executions{status:failure}.as_count()';

    const [successData, failedData] = await Promise.all([
      queryDatadog(successQuery, from, now),
      queryDatadog(failedQuery, from, now),
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
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    res.json({
      workflow: 'gmail_filter',
      displayName: 'Gmail Filter',
      metrics: {
        successful: Math.round(successCount),
        failed: Math.round(failedCount),
        successRate: parseFloat(successRate.toFixed(1)),
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

    const [successData, failedData] = await Promise.all([
      queryDatadog(successQuery, from, now),
      queryDatadog(failedQuery, from, now),
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
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    res.json({
      workflow: 'image_generator',
      displayName: 'Image Generator',
      metrics: {
        successful: Math.round(successCount),
        failed: Math.round(failedCount),
        successRate: parseFloat(successRate.toFixed(1)),
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

    // Query for container memory and CPU by container name
    const memoryQuery = `avg:docker.mem.rss{${DEFAULT_HOST}} by {container_name}`;
    const cpuQuery = `avg:docker.cpu.usage{${DEFAULT_HOST}} by {container_name}`;

    const [memoryData, cpuData] = await Promise.all([
      queryDatadog(memoryQuery, from, now),
      queryDatadog(cpuQuery, from, now),
    ]);

    // Build a map of container metrics
    const containerMap = new Map<string, { memory: number | null; cpu: number | null }>();

    // Process memory data
    if (memoryData.series) {
      for (const series of memoryData.series) {
        const containerName = series.scope?.split(':')[1] || series.tag_set?.[0]?.split(':')[1];
        if (containerName) {
          const points = series.pointlist || [];
          const lastValue = points.length > 0 ? points[points.length - 1][1] : null;
          const mibValue = lastValue !== null ? lastValue / (1024 * 1024) : null;

          if (!containerMap.has(containerName)) {
            containerMap.set(containerName, { memory: null, cpu: null });
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
            containerMap.set(containerName, { memory: null, cpu: null });
          }
          containerMap.get(containerName)!.cpu = lastValue;
        }
      }
    }

    // Convert to array and sort by memory usage (descending)
    const containers = Array.from(containerMap.entries())
      .map(([name, metrics]) => ({
        name,
        memory: metrics.memory !== null ? parseFloat(metrics.memory.toFixed(1)) : null,
        cpu: metrics.cpu !== null ? parseFloat(metrics.cpu.toFixed(2)) : null,
      }))
      .filter(c => c.memory !== null || c.cpu !== null)
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

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`CopilotKit endpoint: http://localhost:${PORT}/api/copilotkit`);
});