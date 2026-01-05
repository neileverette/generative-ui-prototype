/**
 * MCP API Client for Frontend
 *
 * This client abstracts all data fetching through the MCP orchestration layer.
 * The frontend doesn't need to know about specific data sources (Datadog, ServiceNow, etc.)
 * - it just calls tools through MCP.
 *
 * For tools that don't exist yet in MCP, it falls back to direct API calls.
 * This allows incremental migration as more MCP tools are added.
 */

// Types
export interface MCPServer {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
  toolCount: number;
}

export interface MCPTool {
  name: string;
  namespacedName: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPToolsByServer {
  [serverId: string]: MCPTool[];
}

export interface SystemMetricsResult {
  metrics: {
    cpu_usage: number;
    memory_usage: number;
    load_average: number;
    disk_usage: number;
  };
  queriedAt: string;
  source: string;
}

export interface ContainerMetricsResult {
  containers: Array<{
    name: string;
    memory: number;
    cpu: number;
  }>;
  queriedAt: string;
  source: string;
}

export interface WorkflowMetricsResult {
  workflow: string;
  displayName: string;
  metrics: {
    successful: number;
    failed: number;
    successRate: number;
    totalExecutions: number;
    allTimeTotal: number;
    avgDuration: number | null;
    avgRuntime: number | null;
    lastRunTimestamp: number | null;
    trend: {
      direction: 'up' | 'down' | 'flat';
      value: number;
      period: string;
    };
  };
  status: 'healthy' | 'warning' | 'critical';
  queriedAt: string;
}

/**
 * MCP API Client - abstracts all data fetching through MCP orchestration layer
 * Falls back to direct API calls for endpoints not yet exposed as MCP tools
 */
class MCPClient {
  private mcpBaseUrl: string;
  private directBaseUrl: string;

  constructor(mcpBaseUrl: string = '/api/mcp', directBaseUrl: string = '/api') {
    this.mcpBaseUrl = mcpBaseUrl;
    this.directBaseUrl = directBaseUrl;
  }

  // ==========================================================================
  // Core MCP Methods
  // ==========================================================================

  /**
   * List all connected MCP servers
   */
  async listServers(): Promise<{ servers: MCPServer[]; count: number; connectedCount: number }> {
    const response = await fetch(`${this.mcpBaseUrl}/servers`);
    if (!response.ok) {
      throw new Error(`Failed to list servers: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * List all available tools from all servers
   */
  async listTools(): Promise<{ tools: MCPToolsByServer; totalCount: number }> {
    const response = await fetch(`${this.mcpBaseUrl}/tools`);
    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Call a tool on a specific server
   */
  async callTool<T = any>(
    serverId: string,
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<T> {
    const response = await fetch(`${this.mcpBaseUrl}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, toolName, args }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Tool call failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.result;
  }

  // ==========================================================================
  // MCP-Powered Methods (route through MCP orchestration layer)
  // ==========================================================================

  /**
   * Get system metrics (CPU, Memory, Load, Disk) via MCP
   * Uses: datadog:get_system_metrics
   */
  async getSystemMetrics(timeWindow: string = '1h'): Promise<SystemMetricsResult> {
    console.log('[MCP Client] getSystemMetrics via MCP');
    return this.callTool('datadog', 'get_system_metrics', { timeWindow });
  }

  /**
   * Get container metrics via MCP
   * Uses: datadog:get_container_metrics
   */
  async getContainerMetrics(timeWindow: string = '1h'): Promise<ContainerMetricsResult> {
    console.log('[MCP Client] getContainerMetrics via MCP');
    return this.callTool('datadog', 'get_container_metrics', { timeWindow });
  }

  /**
   * Get workflow metrics via MCP
   * Uses: datadog:get_workflow_metrics
   */
  async getWorkflowMetrics(
    workflow: 'gmail_filter' | 'image_generator',
    timeWindow: string = '1d'
  ): Promise<WorkflowMetricsResult> {
    console.log(`[MCP Client] getWorkflowMetrics (${workflow}) via MCP`);
    return this.callTool('datadog', 'get_workflow_metrics', { workflow, timeWindow });
  }

  // ==========================================================================
  // Fallback Methods (direct API calls - will be migrated to MCP in Sprint 3)
  // These exist because the MCP server doesn't have these tools yet
  // ==========================================================================

  /**
   * Get fast overview metrics (direct call - no MCP tool yet)
   * TODO: Add get_overview_fast tool to MCP server
   */
  async getOverviewFast(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getOverviewFast via direct API (fallback)');
    const response = await fetch(`${this.directBaseUrl}/metrics/overview/fast?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch overview: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get system uptime (direct call - no MCP tool yet)
   * TODO: Add get_uptime tool to MCP server
   */
  async getUptime(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getUptime via direct API (fallback)');
    const response = await fetch(`${this.directBaseUrl}/metrics/uptime?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch uptime: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get running containers count (direct call - no MCP tool yet)
   * TODO: Add get_running_containers tool to MCP server
   */
  async getRunningContainers(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getRunningContainers via direct API (fallback)');
    const response = await fetch(`${this.directBaseUrl}/metrics/running-containers?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch running containers: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get containers list (direct call - no MCP tool yet)
   * TODO: Add get_containers_list tool to MCP server
   */
  async getContainersList(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getContainersList via direct API (fallback)');
    const response = await fetch(`${this.directBaseUrl}/metrics/containers-list?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch containers list: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get specific container CPU (direct call - no MCP tool yet)
   * TODO: Add get_container_cpu tool to MCP server
   */
  async getContainerCPU(containerName: string, timeWindow: string = '1h'): Promise<any> {
    console.log(`[MCP Client] getContainerCPU (${containerName}) via direct API (fallback)`);
    const response = await fetch(
      `${this.directBaseUrl}/metrics/container/${encodeURIComponent(containerName)}?timeWindow=${timeWindow}`
    );
    if (!response.ok) throw new Error(`Failed to fetch container CPU: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get specific container memory (direct call - no MCP tool yet)
   * TODO: Add get_container_memory tool to MCP server
   */
  async getContainerMemory(containerName: string, timeWindow: string = '1h'): Promise<any> {
    console.log(`[MCP Client] getContainerMemory (${containerName}) via direct API (fallback)`);
    const response = await fetch(
      `${this.directBaseUrl}/metrics/container/${encodeURIComponent(containerName)}/memory?timeWindow=${timeWindow}`
    );
    if (!response.ok) throw new Error(`Failed to fetch container memory: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get n8n gmail filter metrics (direct call - MCP tool exists but returns different format)
   * Uses direct API for full workflow metrics with trends
   */
  async getGmailFilterMetrics(timeWindow: string = '1d'): Promise<any> {
    console.log('[MCP Client] getGmailFilterMetrics via direct API (fallback - richer data)');
    const response = await fetch(`${this.directBaseUrl}/metrics/n8n/gmail-filter?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch gmail filter metrics: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get n8n image generator metrics (direct call - MCP tool exists but returns different format)
   * Uses direct API for full workflow metrics with trends
   */
  async getImageGeneratorMetrics(timeWindow: string = '1d'): Promise<any> {
    console.log('[MCP Client] getImageGeneratorMetrics via direct API (fallback - richer data)');
    const response = await fetch(`${this.directBaseUrl}/metrics/n8n/image-generator?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch image generator metrics: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get AI interpretations for metrics (direct call - no MCP tool yet)
   * TODO: Add get_interpretations tool to MCP server (requires LangFlow)
   */
  async getInterpretations(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getInterpretations via direct API (fallback)');
    const response = await fetch(`${this.directBaseUrl}/metrics/interpretations?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch interpretations: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get AI interpretations for containers (direct call - no MCP tool yet)
   * TODO: Add get_container_interpretations tool to MCP server (requires LangFlow)
   */
  async getContainerInterpretations(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getContainerInterpretations via direct API (fallback)');
    const response = await fetch(`${this.directBaseUrl}/metrics/container-interpretations?timeWindow=${timeWindow}`);
    if (!response.ok) throw new Error(`Failed to fetch container interpretations: ${response.statusText}`);
    return response.json();
  }

  /**
   * Query LangFlow agent directly (direct call - no MCP tool yet)
   * TODO: Consider adding as MCP tool
   */
  async queryAgent(query: string, timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] queryAgent via direct API (fallback)');
    const response = await fetch(`${this.directBaseUrl}/langflow/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, timeWindow }),
    });
    if (!response.ok) throw new Error(`Failed to query agent: ${response.statusText}`);
    return response.json();
  }
}

// Export singleton instance
export const mcpClient = new MCPClient();

// Also export class for testing/custom instances
export { MCPClient };
