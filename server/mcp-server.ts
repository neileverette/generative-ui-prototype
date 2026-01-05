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
      {
        name: 'get_uptime',
        description: 'Get system uptime in human-readable format',
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
        name: 'get_running_containers',
        description: 'Get the count of running Docker containers',
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
        name: 'get_containers_list',
        description: 'Get a list of all running containers with their CPU and memory usage',
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
        name: 'get_container_cpu',
        description: 'Get CPU usage for a specific container',
        inputSchema: {
          type: 'object',
          properties: {
            containerName: {
              type: 'string',
              description: 'Name of the container',
            },
            timeWindow: {
              type: 'string',
              description: 'Time window for metrics (e.g., "1h", "1d", "7d")',
              default: '1h',
            },
          },
          required: ['containerName'],
        },
      },
      {
        name: 'get_container_memory',
        description: 'Get memory usage for a specific container',
        inputSchema: {
          type: 'object',
          properties: {
            containerName: {
              type: 'string',
              description: 'Name of the container',
            },
            timeWindow: {
              type: 'string',
              description: 'Time window for metrics (e.g., "1h", "1d", "7d")',
              default: '1h',
            },
          },
          required: ['containerName'],
        },
      },
      {
        name: 'get_overview_metrics',
        description: 'Get a comprehensive overview of system metrics including CPU, memory, load, disk, network, and uptime with status indicators',
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

    if (name === 'get_uptime') {
      const timeWindow = (args?.timeWindow as string) || '1h';
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      const query = 'avg:system.uptime{*}';
      const data = await queryDatadog(query, from, now);

      let uptimeSeconds: number | null = null;
      let displayValue = 'N/A';

      if (data?.series?.[0]?.pointlist?.length > 0) {
        const points = data.series[0].pointlist;
        uptimeSeconds = points[points.length - 1][1];

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
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              metric: 'uptime',
              displayName: 'System Uptime',
              currentValue: displayValue,
              rawSeconds: uptimeSeconds,
              unit: '',
              status: 'healthy',
              queriedAt: new Date().toISOString(),
              source: 'mcp-datadog-server',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_running_containers') {
      const timeWindow = (args?.timeWindow as string) || '1h';
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      const query = 'sum:docker.containers.running{*}';
      const data = await queryDatadog(query, from, now);

      let currentValue: number | null = null;

      if (data?.series?.[0]?.pointlist?.length > 0) {
        const points = data.series[0].pointlist;
        currentValue = Math.round(points[points.length - 1][1]);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              metric: 'running_containers',
              displayName: 'Running Containers',
              currentValue,
              unit: '',
              status: currentValue !== null ? 'healthy' : 'unknown',
              queriedAt: new Date().toISOString(),
              source: 'mcp-datadog-server',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_containers_list') {
      const timeWindow = (args?.timeWindow as string) || '1h';
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      const [memoryData, cpuData] = await Promise.all([
        queryDatadog('avg:docker.mem.rss{*} by {container_name}', from, now),
        queryDatadog('avg:docker.cpu.usage{*} by {container_name}', from, now),
      ]);

      const containerMap = new Map<string, { memory: number | null; cpu: number | null }>();

      // Process memory data
      if (memoryData?.series) {
        for (const series of memoryData.series) {
          const containerName = series.scope?.split(':')[1] || series.tag_set?.[0]?.split(':')[1] || 'unknown';
          const points = series.pointlist || [];
          if (points.length > 0) {
            const lastValue = points[points.length - 1][1];
            const mibValue = lastValue !== null ? lastValue / (1024 * 1024) : null;
            containerMap.set(containerName, { memory: mibValue, cpu: null });
          }
        }
      }

      // Process CPU data
      if (cpuData?.series) {
        for (const series of cpuData.series) {
          const containerName = series.scope?.split(':')[1] || series.tag_set?.[0]?.split(':')[1] || 'unknown';
          const points = series.pointlist || [];
          if (points.length > 0) {
            const lastValue = points[points.length - 1][1];
            const existing = containerMap.get(containerName) || { memory: null, cpu: null };
            existing.cpu = lastValue;
            containerMap.set(containerName, existing);
          }
        }
      }

      const containers = Array.from(containerMap.entries())
        .map(([name, metrics]) => ({
          name,
          memory: metrics.memory !== null ? parseFloat(metrics.memory.toFixed(1)) : null,
          cpu: metrics.cpu !== null ? parseFloat(metrics.cpu.toFixed(2)) : null,
        }))
        .filter(c => c.memory !== null || c.cpu !== null)
        .sort((a, b) => (b.memory || 0) - (a.memory || 0));

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

    if (name === 'get_container_cpu') {
      const containerName = args?.containerName as string;
      const timeWindow = (args?.timeWindow as string) || '1h';

      if (!containerName) {
        throw new Error('containerName parameter is required');
      }

      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      const query = `avg:docker.cpu.usage{container_name:${containerName}}`;
      const data = await queryDatadog(query, from, now);

      let currentValue: number | null = null;
      let status = 'unknown';

      if (data?.series?.[0]?.pointlist?.length > 0) {
        const points = data.series[0].pointlist;
        currentValue = parseFloat(points[points.length - 1][1].toFixed(2));

        if (currentValue >= 90) {
          status = 'critical';
        } else if (currentValue >= 70) {
          status = 'warning';
        } else {
          status = 'healthy';
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              containerName,
              metric: 'cpu_usage',
              displayName: `${containerName} CPU Usage`,
              currentValue,
              unit: '%',
              status,
              queriedAt: new Date().toISOString(),
              source: 'mcp-datadog-server',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_container_memory') {
      const containerName = args?.containerName as string;
      const timeWindow = (args?.timeWindow as string) || '1h';

      if (!containerName) {
        throw new Error('containerName parameter is required');
      }

      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      const query = `avg:docker.mem.rss{container_name:${containerName}}`;
      const data = await queryDatadog(query, from, now);

      let currentValue: number | null = null;
      let status = 'unknown';

      if (data?.series?.[0]?.pointlist?.length > 0) {
        const points = data.series[0].pointlist;
        const rawValue = points[points.length - 1][1];
        currentValue = parseFloat((rawValue / (1024 * 1024)).toFixed(1)); // Convert to MiB
        status = 'healthy';
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              containerName,
              metric: 'memory_usage',
              displayName: `${containerName} Memory Usage`,
              currentValue,
              unit: 'MiB',
              status,
              queriedAt: new Date().toISOString(),
              source: 'mcp-datadog-server',
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_overview_metrics') {
      const timeWindow = (args?.timeWindow as string) || '1h';
      const now = Math.floor(Date.now() / 1000);
      const from = now - parseTimeWindow(timeWindow);

      // Define overview metrics with their queries, thresholds, and units
      const overviewMetrics = [
        { id: 'system_uptime', displayName: 'System Uptime', query: 'avg:system.uptime{*}', unit: 'seconds' },
        { id: 'cpu_total', displayName: 'CPU Usage', query: 'avg:system.cpu.user{*} + avg:system.cpu.system{*}', unit: '%', warning: 70, critical: 90 },
        { id: 'cpu_idle', displayName: 'CPU Idle', query: 'avg:system.cpu.idle{*}', unit: '%' },
        { id: 'memory_used_percent', displayName: 'Memory Usage', query: '100 * (avg:system.mem.total{*} - avg:system.mem.usable{*}) / avg:system.mem.total{*}', unit: '%', warning: 80, critical: 95 },
        { id: 'load_1min', displayName: 'Load Average (1m)', query: 'avg:system.load.1{*}', unit: '', warning: 2, critical: 4 },
        { id: 'disk_used_percent', displayName: 'Disk Usage', query: 'avg:system.disk.in_use{*} * 100', unit: '%', warning: 80, critical: 95 },
        { id: 'io_wait', displayName: 'IO Wait', query: 'avg:system.cpu.iowait{*}', unit: '%', warning: 10, critical: 25 },
        { id: 'network_bytes_sent', displayName: 'Network Out', query: 'avg:system.net.bytes_sent{*}', unit: 'bytes' },
        { id: 'network_bytes_recv', displayName: 'Network In', query: 'avg:system.net.bytes_rcvd{*}', unit: 'bytes' },
        { id: 'swap_used_percent', displayName: 'Swap Usage', query: 'avg:system.swap.pct_free{*}', unit: '%', warning: 50, critical: 80 },
      ];

      // Query all metrics in parallel
      const responses = await Promise.all(
        overviewMetrics.map(metric => queryDatadog(metric.query, from, now))
      );

      const results = [];

      for (let i = 0; i < overviewMetrics.length; i++) {
        const metric = overviewMetrics[i];
        const data = responses[i];

        let value: number | null = null;

        if (data?.series?.[0]?.pointlist?.length > 0) {
          const points = data.series[0].pointlist;
          value = points[points.length - 1][1];
          if (value !== null) {
            value = parseFloat(value.toFixed(2));
          }
        }

        // Determine status based on thresholds
        let status = 'healthy';
        if (value !== null) {
          const m = metric as any;
          if (m.critical !== undefined && value >= m.critical) {
            status = 'critical';
          } else if (m.warning !== undefined && value >= m.warning) {
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
            warning: (metric as any).warning,
            critical: (metric as any).critical,
          },
          source: 'mcp-datadog-server',
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              metrics: results,
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
