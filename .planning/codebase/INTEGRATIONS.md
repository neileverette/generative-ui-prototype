# External Integrations

## Overview
The application integrates with multiple external services for monitoring, AI, and cloud infrastructure.

```
+------------------+
|   Application    |
+------------------+
         |
    +----+----+----+----+
    |    |    |    |    |
    v    v    v    v    v
Datadog AWS  LangFlow OpenAI MCP
```

## Datadog Integration

### Purpose
Primary source for infrastructure metrics and container monitoring.

### API Details
- **Base URL:** `https://api.{DATADOG_SITE}/api/v1/query`
- **Authentication:** API Key + App Key (header-based)
- **Rate Limits:** Varies by plan

### Environment Variables
```bash
DATADOG_API_KEY=<api-key>
DATADOG_APP_KEY=<app-key>
DATADOG_SITE=us5.datadoghq.com
```

### Queried Metrics
| Category | Metrics |
|----------|---------|
| System | CPU (user, system, idle, iowait), Memory, Load, Disk, Uptime |
| Docker | Container count, CPU/Memory per container, Restarts |
| Network | Bytes sent/received, Packet errors |
| Custom | n8n workflow executions (gmail_filter, image_generator) |

### Data Flow
```
MCP Datadog Server
    |
    +-- parseTimeWindow() --> from/to timestamps
    |
    +-- queryDatadog(query, from, to)
    |       |
    |       +-- fetch(Datadog API)
    |       |
    |       +-- Extract series/pointlist
    |
    +-- Format response as JSON
```

### MCP Tools Exposed
- `get_system_metrics` - CPU, Memory, Load, Disk
- `get_container_metrics` - Docker CPU/Memory by container
- `get_workflow_metrics` - n8n execution stats
- `get_uptime` - System uptime (human-readable)
- `get_running_containers` - Container count
- `get_containers_list` - Container list with metrics
- `get_container_cpu` / `get_container_memory` - Per-container metrics
- `get_overview_metrics` - Comprehensive system overview

## AWS Integration

### AWS Cost Explorer

**Purpose:** Billing data and cost forecasting.

**SDK:** `@aws-sdk/client-cost-explorer`

**Operations:**
- `GetCostAndUsage` - Current month costs by service
- `GetCostForecast` - End-of-month projections

**Environment:**
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
```

**Endpoints:**
- `GET /api/costs/aws` - Current costs with breakdown
- `GET /api/costs/aws/forecast` - Projected costs
- `GET /api/costs/overview` - Combined view

### AWS ECR

**Purpose:** Container registry information.

**SDK:** `@aws-sdk/client-ecr`

**Operations:**
- `DescribeRepositories` - List ECR repos
- `DescribeImages` - Image metadata

**Endpoints:**
- `GET /api/ecr/summary` - Repository overview

### AWS Deployment (EC2)

**Purpose:** Application hosting via Docker.

**CI/CD Flow:**
```
GitHub Push -> GitHub Actions -> ECR Build -> SSH Deploy -> Docker Run
```

**Deploy Process:**
1. Build Docker image
2. Push to ECR (tag + latest)
3. SSH to EC2
4. Pull latest image
5. Stop/remove old container
6. Run new container with env file

## LangFlow Integration

### Purpose
AI-powered metric interpretation and actionable insights.

### Configuration
```bash
LANGFLOW_API_URL=<langflow-url>
LANGFLOW_FLOW_ID=<flow-id>
```

### Endpoints
- `POST /api/langflow/agent` - Direct agent query
- `GET /api/metrics/interpretations` - System metric analysis
- `GET /api/metrics/container-interpretations` - Container analysis

### Response Format
```json
{
  "text_message": "Analysis text...",
  "structured": {
    "interpretation": "...",
    "actionable_insights": ["..."]
  }
}
```

### Parsing Logic
The server parses LangFlow responses to extract:
1. **Interpretation** - Text between `Interpretation:` and `Actionable`
2. **Actionable Insights** - Numbered list after `Actionable Insights:`

## OpenAI Integration

### Purpose
LLM backend for CopilotKit chat interactions.

### Configuration
```bash
OPENAI_API_KEY=<api-key>
```

### Usage
- CopilotKit runtime uses `OpenAIAdapter`
- Powers chat-based UI generation
- Executes `useCopilotAction` handlers

### Endpoint
- `POST /api/copilotkit` - CopilotKit runtime endpoint

## MCP (Model Context Protocol)

### Purpose
Standardized tool interface for AI agents to access backend services.

### Architecture
```
MCPServerRegistry (Singleton)
    |
    +-- Config: mcp-servers.config.json
    |
    +-- Servers Map
    |       +-- "datadog" -> MCPDatadogServer
    |
    +-- Tools Cache
```

### Configuration
```json
{
  "servers": [
    {
      "id": "datadog",
      "name": "Datadog Metrics Server",
      "transport": "stdio",
      "command": "npx",
      "args": ["ts-node", "./mcp-server.ts"]
    }
  ]
}
```

### Endpoints
- `GET /api/mcp/servers` - List servers with status
- `GET /api/mcp/tools` - List all tools by server
- `POST /api/mcp/call` - Execute tool
- `GET /api/mcp/call/:namespacedTool` - Execute by namespace

## Web Speech API (Browser)

### Purpose
Voice input for hands-free chat interaction.

### Browser Support
- Chrome, Edge (full support)
- Firefox (limited)
- Safari (partial)

### Implementation
```typescript
// useVoiceDictation.ts
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US';
```

## Integration Health Monitoring

### Health Check Endpoint
`GET /api/health`
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "mcp": "connected",
    "datadog": "configured"
  }
}
```

### Error Handling Pattern
```typescript
try {
  const result = await externalService.call();
  res.json({ data: result, source: 'service-name' });
} catch (error) {
  console.error('[Service] Error:', error);
  res.status(500).json({
    error: error.message,
    source: 'service-name'
  });
}
```

## Required Secrets Summary

| Secret | Service | Required |
|--------|---------|----------|
| `OPENAI_API_KEY` | OpenAI | Yes |
| `DATADOG_API_KEY` | Datadog | Yes |
| `DATADOG_APP_KEY` | Datadog | Yes |
| `DATADOG_SITE` | Datadog | No (default: us5) |
| `LANGFLOW_API_URL` | LangFlow | Optional |
| `LANGFLOW_FLOW_ID` | LangFlow | Optional |
| `AWS_REGION` | AWS | Yes (for costs) |
| `AWS_ACCESS_KEY_ID` | AWS | Yes (for costs) |
| `AWS_SECRET_ACCESS_KEY` | AWS | Yes (for costs) |
