#!/usr/bin/env node

/**
 * MCP Server - Datadog Metrics
 *
 * This MCP server exposes Datadog metrics endpoints as standardized MCP tools.
 * It wraps the existing Datadog query functionality to demonstrate the MCP
 * orchestration layer between the UI agent and backend services.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
const DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
const DATADOG_SITE = process.env.DATADOG_SITE || 'us5.datadoghq.com';

/**
 * Helper function to parse time window strings (e.g., "1h", "1d", "7d")
 */
function parseTimeWindow(timeWindow: string): number {
  const match = timeWindow.match(/^(\d+)([smhdwo])$/);
  if (!match) return 3600; // default to 1 hour

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    case 'w': return value * 604800;
    case 'o': return value * 2592000; // month (30 days)
    default: return 3600;
  }
}

/**
 * Query Datadog API
 */
async function queryDatadog(query: string, from: number, to: number): Promise<any> {
  const url = new URL(`https://api.${DATADOG_SITE}/api/v1/query`);
  url.searchParams.set('query', query);
  url.searchParams.set('from', from.toString());
  url.searchParams.set('to', to.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'DD-API-KEY': DATADOG_API_KEY || '',
      'DD-APPLICATION-KEY': DATADOG_APP_KEY || '',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Datadog API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: 'datadog-metrics-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_system_metrics',
        description: 'Get current system metrics (CPU, Memory, Load, Disk) from Datadog',
        inputSchema: {
          type: 'object',
          properties: {
            timeWindow: {
              type: 'string',
              description: 'Time window for metrics (e.g., "1h", "1d", "7d")',
              default: '1h',
            },
          },
        },
      },
      {
        name: 'get_container_metrics',
        description: 'Get Docker container metrics (CPU, Memory) from Datadog',
        inputSchema: {
          type: 'object',
          properties: {
            timeWindow: {
              type: 'string',
              description: 'Time window for metrics (e.g., "1h", "1d", "7d")',
              default: '1h',
            },
          },
        },
      },
      {
        name: 'get_workflow_metrics',
        description: 'Get n8n workflow execution metrics from Datadog',
        inputSchema: {
          type: 'object',
          properties: {
            workflow: {
              type: 'string',
              description: 'Workflow name (gmail_filter or image_generator)',
              enum: ['gmail_filter', 'image_generator'],
            },
            timeWindow: {
              type: 'string',
              description: 'Time window for metrics (e.g., "1h", "1d", "7d")',
              default: '1d',
            },
          },
          required: ['workflow'],
        },
      },
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_system_metrics') {
      const timeWindow = (args?.timeWindow as string) || '1h';
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      // Query system metrics
      const [cpuData, memData, loadData, diskData] = await Promise.all([
        queryDatadog('avg:system.cpu.user{*}', from, now),
        queryDatadog('avg:system.mem.pct_usable{*}', from, now),
        queryDatadog('avg:system.load.1{*}', from, now),
        queryDatadog('avg:system.disk.in_use{*}', from, now),
      ]);

      // Extract latest values
      const extractValue = (data: any) => {
        if (data?.series?.[0]?.pointlist?.length > 0) {
          const points = data.series[0].pointlist;
          return points[points.length - 1][1];
        }
        return null;
      };

      const cpuUsage = extractValue(cpuData);
      const memUsable = extractValue(memData);
      const memUsed = memUsable !== null ? 100 - memUsable : null;
      const loadAvg = extractValue(loadData);
      const diskUsage = extractValue(diskData);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              metrics: {
                cpu_usage: cpuUsage !== null ? parseFloat(cpuUsage.toFixed(2)) : null,
                memory_usage: memUsed !== null ? parseFloat(memUsed.toFixed(2)) : null,
                load_average: loadAvg !== null ? parseFloat(loadAvg.toFixed(2)) : null,
                disk_usage: diskUsage !== null ? parseFloat(diskUsage.toFixed(2)) : null,
              },
              queriedAt: new Date().toISOString(),
              source: 'mcp-datadog-server',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_container_metrics') {
      const timeWindow = (args?.timeWindow as string) || '1h';
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      // Query container metrics
      const [memoryData, cpuData] = await Promise.all([
        queryDatadog('avg:docker.mem.rss{*} by {container_name}', from, now),
        queryDatadog('avg:docker.cpu.usage{*} by {container_name}', from, now),
      ]);

      const containers: any[] = [];
      const containerMap = new Map<string, any>();

      // Process memory data
      if (memoryData?.series) {
        for (const series of memoryData.series) {
          const containerName = series.scope?.split(':')[1] || 'unknown';
          const points = series.pointlist || [];
          if (points.length > 0) {
            const lastValue = points[points.length - 1][1];
            const mibValue = lastValue / (1024 * 1024);
            containerMap.set(containerName, {
              name: containerName,
              memory: parseFloat(mibValue.toFixed(1)),
              cpu: null,
            });
          }
        }
      }

      // Process CPU data
      if (cpuData?.series) {
        for (const series of cpuData.series) {
          const containerName = series.scope?.split(':')[1] || 'unknown';
          const points = series.pointlist || [];
          if (points.length > 0) {
            const lastValue = points[points.length - 1][1];
            const existing = containerMap.get(containerName) || { name: containerName, memory: null };
            existing.cpu = parseFloat(lastValue.toFixed(1));
            containerMap.set(containerName, existing);
          }
        }
      }

      containerMap.forEach((container) => containers.push(container));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              containers,
              count: containers.length,
              queriedAt: new Date().toISOString(),
              source: 'mcp-datadog-server',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_workflow_metrics') {
      const workflow = args?.workflow as string;
      const timeWindow = (args?.timeWindow as string) || '1d';
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      if (!workflow) {
        throw new Error('workflow parameter is required');
      }

      // Build queries based on workflow
      const successQuery = workflow === 'gmail_filter'
        ? 'sum:gmail_filter.executions{automation:gmail_filter,status:success}.as_count()'
        : 'sum:image_generator.executions{status:success}.as_count()';

      const failedQuery = workflow === 'gmail_filter'
        ? 'sum:gmail_filter.executions{automation:gmail_filter,status:failure}.as_count()'
        : 'sum:image_generator.executions{status:failure}.as_count()';

      const [successData, failedData] = await Promise.all([
        queryDatadog(successQuery, from, now),
        queryDatadog(failedQuery, from, now),
      ]);

      // Count executions
      const countPoints = (data: any) => {
        if (data?.series?.[0]?.pointlist) {
          return data.series[0].pointlist.reduce((sum: number, point: any) => sum + (point[1] || 0), 0);
        }
        return 0;
      };

      const successCount = Math.round(countPoints(successData));
      const failedCount = Math.round(countPoints(failedData));
      const totalCount = successCount + failedCount;
      const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              workflow,
              metrics: {
                successful: successCount,
                failed: failedCount,
                successRate: parseFloat(successRate.toFixed(1)),
                totalExecutions: totalCount,
              },
              status: failedCount > 0 ? 'warning' : 'healthy',
              queriedAt: new Date().toISOString(),
              source: 'mcp-datadog-server',
            }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            tool: name,
          }),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Datadog Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
