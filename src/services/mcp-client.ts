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
  // MCP-Powered Methods (Sprint 3 - migrated from fallbacks)
  // ==========================================================================

  /**
   * Get fast overview metrics via MCP
   * Uses: datadog:get_overview_metrics
   */
  async getOverviewFast(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getOverviewFast via MCP');
    return this.callTool('datadog', 'get_overview_metrics', { timeWindow });
  }

  /**
   * Get system uptime via MCP
   * Uses: datadog:get_uptime
   */
  async getUptime(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getUptime via MCP');
    return this.callTool('datadog', 'get_uptime', { timeWindow });
  }

  /**
   * Get running containers count via MCP
   * Uses: datadog:get_running_containers
   */
  async getRunningContainers(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getRunningContainers via MCP');
    return this.callTool('datadog', 'get_running_containers', { timeWindow });
  }

  /**
   * Get containers list via MCP
   * Uses: datadog:get_containers_list
   */
  async getContainersList(timeWindow: string = '1h'): Promise<any> {
    console.log('[MCP Client] getContainersList via MCP');
    return this.callTool('datadog', 'get_containers_list', { timeWindow });
  }

  /**
   * Get specific container CPU via MCP
   * Uses: datadog:get_container_cpu
   */
  async getContainerCPU(containerName: string, timeWindow: string = '1h'): Promise<any> {
    console.log(`[MCP Client] getContainerCPU (${containerName}) via MCP`);
    return this.callTool('datadog', 'get_container_cpu', { containerName, timeWindow });
  }

  /**
   * Get specific container memory via MCP
   * Uses: datadog:get_container_memory
   */
  async getContainerMemory(containerName: string, timeWindow: string = '1h'): Promise<any> {
    console.log(`[MCP Client] getContainerMemory (${containerName}) via MCP`);
    return this.callTool('datadog', 'get_container_memory', { containerName, timeWindow });
  }

  // ==========================================================================
  // Remaining Fallback Methods (require LangFlow or different data format)
  // ==========================================================================

  /**
   * Get n8n gmail filter metrics (direct call - MCP tool exists but returns different format)
   * Uses direct API for full workflow metrics with trends
   */
  async getGmailFilterMetrics(timeWindow: string = '1d'): Promise<any> {
    console.log('[MCP Client] getGmailFilterMetrics via direct API (richer data format)');
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

  // ==========================================================================
  // AWS Cost Explorer Methods
  // ==========================================================================

  /**
   * Get AWS costs for current billing month
   */
  async getAWSCosts(): Promise<any> {
    console.log('[MCP Client] getAWSCosts via direct API');
    const response = await fetch(`${this.directBaseUrl}/costs/aws`);
    if (!response.ok) throw new Error(`Failed to fetch AWS costs: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get AWS cost forecast for end of billing month
   */
  async getAWSForecast(): Promise<any> {
    console.log('[MCP Client] getAWSForecast via direct API');
    const response = await fetch(`${this.directBaseUrl}/costs/aws/forecast`);
    if (!response.ok) throw new Error(`Failed to fetch AWS forecast: ${response.statusText}`);
    return response.json();
  }

  /**
   * Get combined costs overview (AWS current + forecast)
   */
  async getCostsOverview(): Promise<any> {
    console.log('[MCP Client] getCostsOverview via direct API');
    const response = await fetch(`${this.directBaseUrl}/costs/overview`);
    if (!response.ok) throw new Error(`Failed to fetch costs overview: ${response.statusText}`);
    return response.json();
  }

  // ==========================================================================
  // AWS ECR Methods
  // ==========================================================================

  /**
   * Get ECR repositories summary
   * Uses direct API endpoint
   */
  async getECRSummary(): Promise<any> {
    console.log('[MCP Client] getECRSummary via direct API');
    const response = await fetch(`${this.directBaseUrl}/ecr/summary`);
    if (!response.ok) throw new Error(`Failed to fetch ECR summary: ${response.statusText}`);
    return response.json();
  }

  // ==========================================================================
  // Claude Usage Methods
  // ==========================================================================

  /**
   * Get Claude Code usage data from local JSONL files
   * Uses direct API endpoint (no MCP tool yet)
   */
  async getClaudeCodeUsage(
    projectPath?: string,
    plan: 'free' | 'pro' | 'max5' | 'max20' = 'pro'
  ): Promise<any> {
    console.log('[MCP Client] getClaudeCodeUsage via direct API');

    const params = new URLSearchParams();
    if (projectPath) params.append('projectPath', projectPath);
    params.append('plan', plan);

    const url = `${this.directBaseUrl}/claude-usage/code${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to fetch Claude usage: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get API Credits usage data (manual entry or Admin API)
   * Uses direct API endpoint
   */
  async getApiCredits(): Promise<any> {
    console.log('[MCP Client] getApiCredits via direct API');

    const response = await fetch(`${this.directBaseUrl}/claude-usage/api-credits`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to fetch API credits: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update API Credits balance (manual entry)
   * Uses direct API endpoint
   */
  async updateApiCredits(balance: number): Promise<any> {
    console.log('[MCP Client] updateApiCredits via direct API');

    const response = await fetch(`${this.directBaseUrl}/claude-usage/api-credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to update API credits: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get API Token usage from Anthropic Admin API
   * Returns daily and monthly token counts with model breakdown
   */
  async getApiTokens(): Promise<any> {
    console.log('[MCP Client] getApiTokens via direct API');

    const response = await fetch(`${this.directBaseUrl}/claude-usage/api-tokens`);

    if (!response.ok) {
      // Return a default response indicating Admin API is not configured
      if (response.status === 400) {
        return { hasAdminApi: false };
      }
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to fetch API tokens: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Configure Admin API key for token tracking
   * Uses direct API endpoint
   */
  async configureAdminApiKey(apiKey: string): Promise<any> {
    console.log('[MCP Client] configureAdminApiKey via direct API');

    const response = await fetch(`${this.directBaseUrl}/claude-usage/admin-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to configure Admin API key: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check Admin API configuration status
   */
  async getAdminApiStatus(): Promise<any> {
    console.log('[MCP Client] getAdminApiStatus via direct API');

    const response = await fetch(`${this.directBaseUrl}/claude-usage/admin-api-status`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to get Admin API status: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const mcpClient = new MCPClient();

// Also export class for testing/custom instances
export { MCPClient };
