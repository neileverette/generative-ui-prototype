/**
 * MCP Client Wrapper
 *
 * This client connects to the MCP Datadog server and provides
 * a simple interface for the Express server to call MCP tools.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCPDatadogClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverProcess: ChildProcess | null = null;
  private isConnected = false;

  /**
   * Connect to the MCP Datadog server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Spawn the MCP server process
      const serverPath = path.join(__dirname, 'mcp-server.ts');

      this.serverProcess = spawn('npx', ['tsx', serverPath], {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Log server errors
      this.serverProcess.stderr?.on('data', (data) => {
        console.error('[MCP Server]', data.toString());
      });

      // Create transport and client
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['tsx', serverPath],
      });

      this.client = new Client(
        {
          name: 'express-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect
      await this.client.connect(this.transport);
      this.isConnected = true;

      console.log('[MCP Client] Connected to Datadog MCP server');
    } catch (error) {
      console.error('[MCP Client] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }

    this.isConnected = false;
    console.log('[MCP Client] Disconnected from MCP server');
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    return await this.client.listTools();
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args?: Record<string, any>): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name,
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
   * Get system metrics via MCP
   */
  async getSystemMetrics(timeWindow: string = '1h'): Promise<any> {
    return await this.callTool('get_system_metrics', { timeWindow });
  }

  /**
   * Get container metrics via MCP
   */
  async getContainerMetrics(timeWindow: string = '1h'): Promise<any> {
    return await this.callTool('get_container_metrics', { timeWindow });
  }

  /**
   * Get workflow metrics via MCP
   */
  async getWorkflowMetrics(workflow: string, timeWindow: string = '1d'): Promise<any> {
    return await this.callTool('get_workflow_metrics', { workflow, timeWindow });
  }
}

// Singleton instance
let mcpClient: MCPDatadogClient | null = null;

/**
 * Get or create the MCP client singleton
 */
export async function getMCPClient(): Promise<MCPDatadogClient> {
  if (!mcpClient) {
    mcpClient = new MCPDatadogClient();
    await mcpClient.connect();

    // Cleanup on process exit
    process.on('exit', () => {
      if (mcpClient) {
        mcpClient.disconnect();
      }
    });

    process.on('SIGINT', () => {
      if (mcpClient) {
        mcpClient.disconnect();
      }
      process.exit(0);
    });
  }

  return mcpClient;
}
