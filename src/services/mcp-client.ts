/**
 * MCP API Client for Frontend
 *
 * This client abstracts all data fetching through the MCP orchestration layer.
 * The frontend doesn't need to know about specific data sources (Datadog, ServiceNow, etc.)
 * - it just calls tools through MCP.
 *
 * For tools that don't exist yet in MCP, it falls back to direct API calls.
 * This allows incremental migration as more MCP tools are added.
 *
 * Includes retry logic and circuit breaker for resilience.
 */

// Error categories for widget fetch operations
export enum FetchErrorCategory {
  NETWORK = 'NETWORK',     // Retry - network issues
  NOT_FOUND = 'NOT_FOUND', // No retry - data doesn't exist
  SERVER = 'SERVER',       // Retry - server errors (500, 502, 503)
  UNKNOWN = 'UNKNOWN'      // Retry - unknown errors
}

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Blocking requests (too many failures)
  HALF_OPEN = 'HALF_OPEN'  // Testing recovery
}

/**
 * Simple Circuit Breaker for Widget Fetch Operations
 * Prevents hammering EC2 when it's consistently failing
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold = 3;
  private readonly successThreshold = 2;
  private readonly openDurationMs = 60000; // 60 seconds

  /**
   * Check if circuit is open (blocking requests)
   */
  isOpen(): boolean {
    if (this.state !== CircuitState.OPEN) {
      return false;
    }

    // Check if cooldown period elapsed
    if (this.openedAt !== null) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.openDurationMs) {
        // Transition to HALF_OPEN to test recovery
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return false;
      }
    }

    return true;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get remaining cooldown time in seconds
   */
  getRemainingCooldown(): number {
    if (this.state !== CircuitState.OPEN || !this.openedAt) {
      return 0;
    }
    const elapsed = Date.now() - this.openedAt;
    const remaining = Math.max(0, this.openDurationMs - elapsed);
    return Math.ceil(remaining / 1000);
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        // Close circuit after threshold successes
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.openedAt = null;
        console.log('[Circuit Breaker] Circuit CLOSED - service recovered');
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in HALF_OPEN -> back to OPEN
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
      this.successCount = 0;
      this.failureCount++;
      console.warn('[Circuit Breaker] Circuit re-OPENED - test request failed');
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        // Open circuit after threshold failures
        this.state = CircuitState.OPEN;
        this.openedAt = Date.now();
        console.warn(`[Circuit Breaker] Circuit OPEN - ${this.failureCount} consecutive failures`);
      }
    }
  }

  /**
   * Reset circuit state (for manual recovery or testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = null;
  }
}

// Global circuit breaker for console usage endpoint
const consoleUsageCircuitBreaker = new CircuitBreaker();

/**
 * Retry configuration for widget fetch operations
 */
interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  delayMs: 2000, // 2 seconds between attempts
};

/**
 * Fetch with retry logic
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param config - Retry configuration
 * @returns Response
 * @throws Error if all retries fail or error is not retryable
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success!
      return response;
    } catch (error) {
      lastError = error as Error;

      // Classify error
      const errorCategory = classifyFetchError(lastError);

      // Check if we should retry
      if (!shouldRetryFetch(errorCategory, attempt, config.maxAttempts)) {
        throw lastError;
      }

      // Log retry
      console.warn(
        `[Fetch Retry] ${errorCategory} error on attempt ${attempt}/${config.maxAttempts}: ${lastError.message}`
      );

      if (attempt < config.maxAttempts) {
        console.warn(`[Fetch Retry] Retrying in ${config.delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, config.delayMs));
      }
    }
  }

  throw lastError || new Error('Fetch failed for unknown reason');
}

/**
 * Classify fetch error for retry decision
 */
function classifyFetchError(error: Error, response?: Response): FetchErrorCategory {
  // Check response status if available
  if (response) {
    if (response.status === 404) return FetchErrorCategory.NOT_FOUND;
    if (response.status >= 500) return FetchErrorCategory.SERVER;
  }

  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return FetchErrorCategory.NETWORK;
  }

  return FetchErrorCategory.UNKNOWN;
}

/**
 * Determine if fetch error should be retried
 */
function shouldRetryFetch(
  errorCategory: FetchErrorCategory,
  attemptNumber: number,
  maxAttempts: number
): boolean {
  // NOT_FOUND never retries
  if (errorCategory === FetchErrorCategory.NOT_FOUND) {
    return false;
  }

  // Check if max attempts exceeded
  if (attemptNumber >= maxAttempts) {
    return false;
  }

  // NETWORK, SERVER, UNKNOWN are retryable
  return true;
}

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
   * Get Claude plan config (user-configured)
   */
  async getClaudeConfig(): Promise<{
    plan: { name: string; tier: string; cost: string; nextBillingDate: string };
  }> {
    const response = await fetch(`${this.directBaseUrl}/claude-usage/config`);
    if (!response.ok) {
      throw new Error('Failed to fetch Claude config');
    }
    return response.json();
  }

  /**
   * Get Claude Console usage data from EC2 sync endpoint
   * Returns synced usage limits and percentages with version metadata
   * Includes retry logic and circuit breaker for resilience
   */
  async getConsoleUsage(): Promise<{
    currentSession?: { resetsIn: string; percentageUsed: number };
    weeklyLimits?: {
      allModels: { resetsIn: string; percentageUsed: number };
      sonnetOnly: { resetsIn: string; percentageUsed: number };
    };
    lastUpdated: string;
    isStale: boolean;
    ageMinutes: number;
    source: string;
    error?: string;
    circuitBreakerOpen?: boolean;
    retryAfterSeconds?: number;
  }> {
    console.log('[MCP Client] getConsoleUsage via EC2 sync endpoint');

    // Check circuit breaker
    if (consoleUsageCircuitBreaker.isOpen()) {
      const remainingSeconds = consoleUsageCircuitBreaker.getRemainingCooldown();
      console.warn(`[MCP Client] Circuit breaker OPEN - blocking request`);
      return {
        lastUpdated: new Date().toISOString(),
        isStale: true,
        ageMinutes: 999,
        source: 'circuit-breaker',
        error: 'Service temporarily unavailable',
        circuitBreakerOpen: true,
        retryAfterSeconds: remainingSeconds,
      };
    }

    try {
      const response = await fetchWithRetry(`${this.directBaseUrl}/claude/console-usage`);

      if (!response.ok) {
        // Record failure in circuit breaker
        consoleUsageCircuitBreaker.recordFailure();

        // Parse error message
        const errorBody = await response.json().catch(() => ({ error: response.statusText }));
        const errorMessage = errorBody.error || `Failed to fetch console usage: ${response.statusText}`;

        // For 404, return empty state instead of throwing
        if (response.status === 404) {
          console.warn('[MCP Client] No console usage data available (404)');
          return {
            lastUpdated: new Date().toISOString(),
            isStale: true,
            ageMinutes: 999,
            source: 'ec2-sync',
            error: 'No data available',
          };
        }

        throw new Error(errorMessage);
      }

      // Success! Record in circuit breaker
      consoleUsageCircuitBreaker.recordSuccess();

      const data = await response.json();
      return data;
    } catch (error) {
      // Record failure in circuit breaker
      consoleUsageCircuitBreaker.recordFailure();

      // Re-throw for widget to handle
      throw error;
    }
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
   * Trigger immediate scrape of Console usage data
   * Forces scraper to run immediately instead of waiting for 5-minute interval
   */
  async triggerConsoleRefresh(): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
  }> {
    console.log('[MCP Client] triggerConsoleRefresh - forcing immediate scrape');

    const response = await fetch(`${this.directBaseUrl}/claude/console-usage/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev-localhost-test-key-12345', // TODO: Get from env or config
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Failed to trigger refresh: ${response.statusText}`);
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
      // Handle rate limit errors (429 from Anthropic API proxied through our server as 500)
      if (response.status === 429) {
        throw new Error('Rate limit exceeded - too many API requests');
      }
      const error = await response.json().catch(() => ({ error: response.statusText }));
      // Check if the error message indicates a rate limit
      const errorMsg = error.error || `Failed to fetch API tokens: ${response.statusText}`;
      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate')) {
        throw new Error('Rate limit exceeded - too many API requests');
      }
      throw new Error(errorMsg);
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
