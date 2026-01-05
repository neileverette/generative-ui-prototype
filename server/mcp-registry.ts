/**
 * MCP Server Registry
 *
 * Orchestration layer that manages connections to multiple MCP servers.
 * External teams can plug in their MCP servers via configuration.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration types
export interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;      // for stdio transport
  args?: string[];       // for stdio transport
  url?: string;          // for sse transport (future)
  env?: Record<string, string>;  // additional environment variables
}

export interface MCPRegistryConfig {
  servers: MCPServerConfig[];
}

// Runtime types
export interface ConnectedServer {
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  process?: ChildProcess;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface NamespacedTool {
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface ServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
  toolCount: number;
}

/**
 * MCP Server Registry - manages multiple MCP server connections
 */
export class MCPServerRegistry {
  private servers: Map<string, ConnectedServer> = new Map();
  private toolCache: Map<string, NamespacedTool[]> = new Map();
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(__dirname, 'mcp-servers.config.json');
  }

  /**
   * Load server configuration from JSON file
   */
  loadConfig(): MCPRegistryConfig {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configContent) as MCPRegistryConfig;

      // Validate config
      if (!config.servers || !Array.isArray(config.servers)) {
        throw new Error('Invalid config: "servers" must be an array');
      }

      for (const server of config.servers) {
        if (!server.id || !server.name || !server.transport) {
          throw new Error(`Invalid server config: missing required fields (id, name, transport)`);
        }
        if (server.transport === 'stdio' && (!server.command || !server.args)) {
          throw new Error(`Invalid server config for ${server.id}: stdio transport requires command and args`);
        }
      }

      console.log(`[MCP Registry] Loaded config with ${config.servers.length} server(s)`);
      return config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`[MCP Registry] Config file not found at ${this.configPath}, using empty config`);
        return { servers: [] };
      }
      throw error;
    }
  }

  /**
   * Connect to all configured servers
   */
  async connectAll(): Promise<void> {
    const config = this.loadConfig();

    const connectionPromises = config.servers.map(async (serverConfig) => {
      try {
        await this.connectServer(serverConfig);
      } catch (error) {
        console.error(`[MCP Registry] Failed to connect to ${serverConfig.id}:`, error);
        // Store error state but continue with other servers
        this.servers.set(serverConfig.id, {
          config: serverConfig,
          client: null as any,
          transport: null as any,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(connectionPromises);

    const connected = Array.from(this.servers.values()).filter(s => s.status === 'connected').length;
    console.log(`[MCP Registry] Connected to ${connected}/${config.servers.length} server(s)`);
  }

  /**
   * Connect to a single MCP server
   */
  async connectServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id) && this.servers.get(config.id)?.status === 'connected') {
      console.log(`[MCP Registry] Server ${config.id} already connected`);
      return;
    }

    console.log(`[MCP Registry] Connecting to ${config.id} (${config.name})...`);

    if (config.transport === 'stdio') {
      await this.connectStdioServer(config);
    } else if (config.transport === 'sse') {
      throw new Error(`SSE transport not yet implemented for ${config.id}`);
    } else {
      throw new Error(`Unknown transport type: ${config.transport}`);
    }
  }

  /**
   * Connect to a stdio-based MCP server
   */
  private async connectStdioServer(config: MCPServerConfig): Promise<void> {
    // Resolve relative paths from config directory
    const args = config.args?.map(arg => {
      if (arg.endsWith('.ts') || arg.endsWith('.js')) {
        return path.resolve(__dirname, arg);
      }
      return arg;
    }) || [];

    // Create transport - filter out undefined env values
    const envVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        envVars[key] = value;
      }
    }
    if (config.env) {
      Object.assign(envVars, config.env);
    }

    const transport = new StdioClientTransport({
      command: config.command!,
      args,
      env: envVars,
    });

    // Create client
    const client = new Client(
      {
        name: `mcp-registry-client-${config.id}`,
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect
    await client.connect(transport);

    // Store connected server
    this.servers.set(config.id, {
      config,
      client,
      transport,
      status: 'connected',
    });

    // Clear tool cache for this server
    this.toolCache.delete(config.id);

    console.log(`[MCP Registry] Connected to ${config.id}`);
  }

  /**
   * Disconnect from a server
   */
  async disconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }

    try {
      if (server.client) {
        await server.client.close();
      }
      if (server.process) {
        server.process.kill();
      }
    } catch (error) {
      console.error(`[MCP Registry] Error disconnecting from ${serverId}:`, error);
    }

    this.servers.delete(serverId);
    this.toolCache.delete(serverId);
    console.log(`[MCP Registry] Disconnected from ${serverId}`);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.servers.keys()).map(id =>
      this.disconnectServer(id)
    );
    await Promise.all(disconnectPromises);
    console.log('[MCP Registry] Disconnected from all servers');
  }

  /**
   * Get a specific server's client
   */
  getServer(serverId: string): ConnectedServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get status of all servers
   */
  getServerStatuses(): ServerStatus[] {
    return Array.from(this.servers.values()).map(server => ({
      id: server.config.id,
      name: server.config.name,
      status: server.status,
      error: server.error,
      toolCount: this.toolCache.get(server.config.id)?.length || 0,
    }));
  }

  /**
   * List tools from a specific server
   */
  async getServerTools(serverId: string): Promise<NamespacedTool[]> {
    // Check cache first
    if (this.toolCache.has(serverId)) {
      return this.toolCache.get(serverId)!;
    }

    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await server.client.listTools();
    const tools: NamespacedTool[] = (result.tools || []).map((tool: any) => ({
      serverId,
      serverName: server.config.name,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    // Cache the result
    this.toolCache.set(serverId, tools);

    return tools;
  }

  /**
   * Get all tools from all connected servers (namespaced)
   */
  async getAllTools(): Promise<NamespacedTool[]> {
    const allTools: NamespacedTool[] = [];

    const toolPromises = Array.from(this.servers.entries())
      .filter(([_, server]) => server.status === 'connected')
      .map(async ([serverId]) => {
        try {
          const tools = await this.getServerTools(serverId);
          return tools;
        } catch (error) {
          console.error(`[MCP Registry] Failed to get tools from ${serverId}:`, error);
          return [];
        }
      });

    const results = await Promise.all(toolPromises);
    results.forEach(tools => allTools.push(...tools));

    return allTools;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverId: string, toolName: string, args?: Record<string, any>): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    if (server.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected (status: ${server.status})`);
    }

    const result = await server.client.callTool({
      name: toolName,
      arguments: args || {},
    });

    // Extract the text content from the result
    if (result.content && Array.isArray(result.content) && result.content.length > 0) {
      const firstContent = result.content[0] as any;
      if (firstContent.type === 'text' && 'text' in firstContent) {
        try {
          return JSON.parse(firstContent.text);
        } catch {
          return firstContent.text;
        }
      }
    }

    return result;
  }

  /**
   * Find and call a tool by namespaced name (e.g., "datadog:get_system_metrics")
   */
  async callNamespacedTool(namespacedToolName: string, args?: Record<string, any>): Promise<any> {
    const [serverId, toolName] = namespacedToolName.split(':');
    if (!serverId || !toolName) {
      throw new Error(`Invalid namespaced tool name: ${namespacedToolName}. Expected format: "serverId:toolName"`);
    }
    return this.callTool(serverId, toolName, args);
  }
}

// Singleton instance
let registryInstance: MCPServerRegistry | null = null;

/**
 * Get or create the MCP registry singleton
 */
export async function getMCPRegistry(): Promise<MCPServerRegistry> {
  if (!registryInstance) {
    registryInstance = new MCPServerRegistry();
    await registryInstance.connectAll();

    // Cleanup on process exit
    process.on('exit', () => {
      if (registryInstance) {
        registryInstance.disconnectAll();
      }
    });

    process.on('SIGINT', async () => {
      if (registryInstance) {
        await registryInstance.disconnectAll();
      }
      process.exit(0);
    });
  }

  return registryInstance;
}

/**
 * Reset the registry (useful for testing)
 */
export async function resetMCPRegistry(): Promise<void> {
  if (registryInstance) {
    await registryInstance.disconnectAll();
    registryInstance = null;
  }
}
