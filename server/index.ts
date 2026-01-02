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

// System overview endpoint - returns metrics formatted for dashboard
app.get('/api/metrics/overview', async (_req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600; // Last hour

    const overviewMetrics = [
      { name: 'cpuTotal', query: 'avg:system.cpu.user{host:i-040ac6026761030ac} + avg:system.cpu.system{host:i-040ac6026761030ac}', displayName: 'CPU Usage', unit: '%', warning: 70, critical: 90 },
      { name: 'memUsedPercent', query: '100 * (avg:system.mem.total{host:i-040ac6026761030ac} - avg:system.mem.usable{host:i-040ac6026761030ac}) / avg:system.mem.total{host:i-040ac6026761030ac}', displayName: 'Memory Usage', unit: '%', warning: 80, critical: 95 },
      { name: 'loadAvg1', query: 'avg:system.load.1{host:i-040ac6026761030ac}', displayName: 'Load (1m)', unit: '', warning: 2, critical: 4 },
      { name: 'diskUsedPercent', query: 'avg:system.disk.in_use{host:i-040ac6026761030ac} * 100', displayName: 'Disk Usage', unit: '%', warning: 80, critical: 95 },
    ];

    const results = [];

    for (const metric of overviewMetrics) {
      try {
        const data = await queryDatadog(metric.query, from, now);
        if (data.series && data.series.length > 0) {
          const series = data.series[0];
          const points = series.pointlist || [];
          const currentValue = points.length > 0 ? points[points.length - 1][1] : null;

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
          });
        }
      } catch (error) {
        console.error(`Error fetching ${metric.name}:`, error);
      }
    }

    res.json({ metrics: results, queriedAt: new Date().toISOString() });
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