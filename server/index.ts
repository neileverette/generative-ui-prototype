import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import express from 'express';

import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from '@copilotkit/runtime';

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
const DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
const DATADOG_SITE = process.env.DATADOG_SITE || 'us5.datadoghq.com';

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Container CPU metrics endpoint - returns CPU usage for a specific container
app.get('/api/metrics/container/:containerName', async (req, res) => {
  try {
    const { containerName } = req.params;
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600; // Last hour

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
app.get('/api/metrics/overview', async (_req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600; // Last hour
    const twoDaysAgo = now - (2 * 24 * 3600); // 2 days ago

    const overviewMetrics = [
      { name: 'cpuTotal', query: 'avg:system.cpu.user{host:i-040ac6026761030ac} + avg:system.cpu.system{host:i-040ac6026761030ac}', displayName: 'CPU Usage', unit: '%', warning: 70, critical: 90 },
      { name: 'memUsedPercent', query: '100 * (avg:system.mem.total{host:i-040ac6026761030ac} - avg:system.mem.usable{host:i-040ac6026761030ac}) / avg:system.mem.total{host:i-040ac6026761030ac}', displayName: 'Memory Usage', unit: '%', warning: 80, critical: 95 },
      { name: 'loadAvg1', query: 'avg:system.load.1{host:i-040ac6026761030ac}', displayName: 'Load (1m)', unit: '', warning: 2, critical: 4 },
      { name: 'diskUsedPercent', query: 'avg:system.disk.in_use{host:i-040ac6026761030ac} * 100', displayName: 'Disk Usage', unit: '%', warning: 80, critical: 95 },
    ];

    const results = [];

    for (const metric of overviewMetrics) {
      try {
        // Fetch current data (last hour)
        const currentData = await queryDatadog(metric.query, from, now);

        // Fetch historical data (2 days ago, 1 hour window)
        const historicalData = await queryDatadog(metric.query, twoDaysAgo - 3600, twoDaysAgo);

        let currentValue = null;
        let previousValue = null;
        let change = null;

        if (currentData.series && currentData.series.length > 0) {
          const series = currentData.series[0];
          const points = series.pointlist || [];
          currentValue = points.length > 0 ? points[points.length - 1][1] : null;
        }

        if (historicalData.series && historicalData.series.length > 0) {
          const series = historicalData.series[0];
          const points = series.pointlist || [];
          previousValue = points.length > 0 ? points[points.length - 1][1] : null;
        }

        // Calculate percentage change
        if (currentValue !== null && previousValue !== null && previousValue !== 0) {
          const changePercent = ((currentValue - previousValue) / previousValue) * 100;
          change = {
            value: parseFloat(Math.abs(changePercent).toFixed(1)),
            direction: changePercent > 0.5 ? 'up' : changePercent < -0.5 ? 'down' : 'flat',
            period: 'vs 2 days ago',
          };
        }

        let status = 'healthy';
        if (metric.critical !== undefined && currentValue >= metric.critical) {
          status = 'critical';
        } else if (metric.warning !== undefined && currentValue >= metric.warning) {
          status = 'warning';
        }

        results.push({
          metric: metric.name,
          displayName: metric.displayName,
          currentValue: currentValue !== null ? parseFloat(currentValue.toFixed(2)) : null,
          unit: metric.unit,
          status,
          change,
        });
      } catch (error) {
        console.error(`Error fetching ${metric.name}:`, error);
      }
    }

    res.json({ metrics: results, queriedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// System uptime endpoint - returns uptime in human-readable format
app.get('/api/metrics/uptime', async (_req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600; // Last hour

    const query = 'avg:system.uptime{host:i-040ac6026761030ac}';
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