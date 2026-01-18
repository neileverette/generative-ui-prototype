# LangFlow Datadog Agent

A LangFlow-based AI agent that queries Datadog infrastructure metrics and integrates with the Generative UI client application via MCP.

## Project Context

This agent is a **sub-component** of the larger [Generative UI Prototype](../README.md) project. The main project uses CopilotKit as the client-side agent to drive a dynamic dashboard UI. This LangFlow agent serves as a **backend agent** that the client orchestrates via MCP.

### Where This Fits

```
generative-ui-prototype/
├── src/                    # React client with CopilotKit (CLIENT AGENT)
├── server/                 # Express server + future MCP integration
├── docs/
│   ├── LANGFLOW_DATADOG_AGENT_README.md   # ← YOU ARE HERE
│   └── LANGFLOW_DATADOG_AGENT_PLAN.md     # Learning modules
└── README.md               # Main project documentation
```

### Architecture Position

```
┌────────────────────────────────────────────────────────────┐
│                   CLIENT APPLICATION                        │
│              (CopilotKit + A2UI + React)                   │
└─────────────────────────┬──────────────────────────────────┘
                          │
                     MCP Protocol
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│              THIS COMPONENT: LANGFLOW DATADOG AGENT         │
│                                                             │
│  • Receives natural language queries about infrastructure  │
│  • LLM reasons about what metrics to fetch                 │
│  • Calls Datadog API                                       │
│  • Returns structured insights                             │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
                    Datadog API
```

---

## Goals

### Primary Goal
Build a LangFlow agent that can:
1. Accept natural language questions about infrastructure health
2. Determine which Datadog metrics are relevant
3. Query the Datadog API
4. Return meaningful insights (not just raw data)

### Secondary Goal
Integrate this agent with the main generative-ui-prototype via MCP so the client agent can orchestrate it.

### Success Criteria
- [ ] Agent responds to "What's my CPU usage?" with actual Datadog data
- [ ] Agent can assess overall system health from multiple metrics
- [ ] Agent is accessible via LangFlow API
- [ ] Agent is callable from generative-ui-prototype server via MCP
- [ ] Client UI renders agent responses as A2UI components

---

## Technical Requirements

### LangFlow Instance
- **URL**: https://langflow.neil-everette.com
- **Version**: 1.6.9
- **API Key**: (stored in environment variables)

### Datadog Configuration
- **Site**: us5.datadoghq.com
- **API Endpoint**: `https://api.us5.datadoghq.com/api/v1/query`
- **Host Filter**: `i-040ac6026761030ac` (EC2 instance being monitored)

### Available Datadog Metrics
| Metric | Description | Warning | Critical |
|--------|-------------|---------|----------|
| `system.cpu.user` | CPU user time % | 70% | 90% |
| `system.cpu.system` | CPU system time % | 70% | 90% |
| `system.mem.usable` | Available memory bytes | - | - |
| `system.mem.total` | Total memory bytes | - | - |
| `system.load.1` | 1-minute load average | 2.0 | 4.0 |
| `system.load.5` | 5-minute load average | 2.0 | 4.0 |
| `system.load.15` | 15-minute load average | 2.0 | 4.0 |
| `system.disk.in_use` | Disk utilization % | 80% | 95% |
| `system.net.bytes_rcvd` | Network bytes received | - | - |
| `system.net.bytes_sent` | Network bytes sent | - | - |

### LLM Configuration
- **Provider**: OpenAI or Anthropic (Claude)
- **Model**: GPT-4 or Claude 3
- **Temperature**: 0.7 (balanced)

---

## Implementation Stages

### Stage 1: Create Base Agent
**Goal**: Get a basic agent working in LangFlow playground

**Components needed**:
- Chat Input
- Agent (with LLM configured)
- Chat Output

**Steps for Claude Code**:
1. User creates flow in LangFlow UI (Simple Agent template)
2. User configures LLM with API key
3. User tests in playground
4. Verify agent responds to basic queries

**Verification**:
```
Input: "Hello, what can you help me with?"
Expected: Agent responds conversationally
```

---

### Stage 2: Add Datadog Tool
**Goal**: Agent can fetch real metrics from Datadog

**Components needed**:
- API Request (configured for Datadog)
- Tool wrapper (to make API Request callable by agent)

**Datadog API Request Configuration**:
```
URL: https://api.us5.datadoghq.com/api/v1/query
Method: GET
Headers:
  DD-API-KEY: ${DATADOG_API_KEY}
  DD-APPLICATION-KEY: ${DATADOG_APP_KEY}
  Content-Type: application/json
Query Parameters:
  query: <metric query string>
  from: <unix timestamp>
  to: <unix timestamp>
```

**Example Metric Query**:
```
avg:system.cpu.user{host:i-040ac6026761030ac}
```

**System Prompt for Agent**:
```
You are a Datadog infrastructure monitoring assistant. You help users understand their system metrics and identify issues.

When users ask about infrastructure health, CPU, memory, disk, load, or network, use the datadog_query tool to fetch real metrics.

Available metrics:
- CPU: system.cpu.user, system.cpu.system (percentage, warning >70%, critical >90%)
- Memory: system.mem.usable, system.mem.total (bytes)
- Load: system.load.1, system.load.5, system.load.15 (warning >2.0, critical >4.0)
- Disk: system.disk.in_use (percentage, warning >80%, critical >95%)
- Network: system.net.bytes_rcvd, system.net.bytes_sent

Host filter: host:i-040ac6026761030ac

When responding:
1. State the current value
2. Explain what it means
3. Indicate if it's normal, concerning, or critical
4. Suggest actions if needed
```

**Verification**:
```
Input: "What's my CPU usage?"
Expected: Agent calls Datadog tool, returns actual percentage with assessment
```

---

### Stage 3: Test & Refine
**Goal**: Agent handles various queries reliably

**Test Matrix**:
| Query | Expected Behavior |
|-------|-------------------|
| "What's my CPU usage?" | Fetches CPU, returns % |
| "Is my server healthy?" | Fetches multiple metrics, assesses overall health |
| "Show me memory stats" | Fetches memory metrics |
| "Hello" | Responds without calling tool |
| "What's the weather?" | Explains it only handles infrastructure queries |

**Prompt Engineering Checklist**:
- [ ] Agent calls tool only when relevant
- [ ] Agent doesn't hallucinate metrics
- [ ] Agent provides actionable insights
- [ ] Agent handles errors gracefully

---

### Stage 4: Expose via API
**Goal**: Agent callable from external applications

**LangFlow API Endpoint**:
```
POST https://langflow.neil-everette.com/api/v1/run/{flow-id}
```

**Request Format**:
```json
{
  "input_value": "What's my CPU usage?",
  "output_type": "chat",
  "input_type": "chat"
}
```

**Response Format**:
```json
{
  "outputs": [{
    "outputs": [{
      "results": {
        "message": {
          "text": "Your current CPU usage is 23.5%..."
        }
      }
    }]
  }]
}
```

**Steps for Claude Code**:
1. Help user get flow ID from LangFlow URL
2. Generate API key in LangFlow settings
3. Test with curl command
4. Add endpoint to generative-ui-prototype server

**Server Integration Code** (`server/index.ts`):
```typescript
// Environment variables needed
const LANGFLOW_URL = process.env.LANGFLOW_URL || 'https://langflow.neil-everette.com';
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;

// Endpoint to call Datadog agent
app.post('/api/datadog-agent', async (req, res) => {
  const { query } = req.body;

  try {
    const response = await fetch(
      `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LANGFLOW_API_KEY!,
        },
        body: JSON.stringify({
          input_value: query,
          output_type: 'chat',
          input_type: 'chat',
        }),
      }
    );

    const data = await response.json();
    const message = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text;

    res.json({ message, raw: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to call Datadog agent' });
  }
});
```

---

### Stage 5: MCP Integration
**Goal**: Client agent calls Datadog agent via MCP

**MCP Server** (`server/mcp-datadog.ts`):
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'datadog-agent', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool definition
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'query_infrastructure',
    description: 'Query infrastructure metrics from Datadog. Ask about CPU, memory, disk, load, or system health.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language question about infrastructure'
        }
      },
      required: ['query']
    }
  }]
}));

// Tool handler
server.setRequestHandler('tools/call', async (request) => {
  const { query } = request.params.arguments;

  // Call LangFlow agent
  const response = await callLangFlowAgent(query);

  return {
    content: [{ type: 'text', text: response }]
  };
});
```

**CopilotKit Action** (`src/App.tsx`):
```typescript
useCopilotAction({
  name: 'queryInfrastructure',
  description: 'Ask the Datadog agent about infrastructure health',
  parameters: [{
    name: 'query',
    type: 'string',
    description: 'Question about infrastructure',
    required: true,
  }],
  handler: async ({ query }) => {
    const response = await fetch('/api/mcp/query_infrastructure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    // Convert to A2UI components and render
    // ...

    return data.message;
  },
});
```

---

## Environment Variables

Add to `.env.local` in generative-ui-prototype:

```env
# LangFlow Configuration
LANGFLOW_URL=https://langflow.neil-everette.com
LANGFLOW_API_KEY=<your-langflow-api-key>
LANGFLOW_FLOW_ID=<your-flow-id-after-creating>

# Datadog (for LangFlow agent - configure in LangFlow Global Variables)
DATADOG_API_KEY=<your-datadog-api-key>
DATADOG_APP_KEY=<your-datadog-app-key>
DATADOG_SITE=us5.datadoghq.com
DATADOG_HOST=i-040ac6026761030ac
```

---

## Troubleshooting

### LangFlow API Returns HTML
**Cause**: Authentication issue or nginx misconfiguration
**Solution**:
- Verify API key is correct
- Check nginx config proxies /api routes properly
- Test with curl to isolate issue

### Agent Doesn't Call Datadog Tool
**Cause**: System prompt doesn't clearly instruct tool usage
**Solution**:
- Make system prompt more explicit about when to use tool
- Add examples in system prompt
- Check tool is properly connected to agent

### Datadog Returns No Data
**Cause**: Wrong host filter or time range
**Solution**:
- Verify host filter matches your EC2 instance
- Check time range is recent (last hour)
- Test query directly in Datadog UI

### MCP Connection Fails
**Cause**: Transport or configuration mismatch
**Solution**:
- Verify MCP server is running
- Check transport configuration matches
- Review MCP SDK documentation

---

## Google NotebookLM Prompts

Use these prompts to create learning notebooks for each stage.

### Stage 1: LangFlow Fundamentals

**Prompt**:
> Create a lesson on LangFlow fundamentals for someone building their first AI agent. Cover: What is LangFlow and how does it relate to LangChain? What problem does it solve compared to writing code directly? Explain the concept of "flows" and "components" - use a plumbing or electrical circuit analogy. What are the core component types (inputs, outputs, LLMs, tools, memory)? What's the difference between a simple prompt flow and an agent flow? How does data move through a flow? What happens when you click "run"? Use practical examples and avoid jargon where possible.

**Links to Import**:
- https://docs.langflow.org/
- https://docs.langflow.org/get-started-introduction
- https://docs.langflow.org/concepts-overview
- https://python.langchain.com/docs/concepts/

---

### Stage 2: Building Agents with Tools

**Prompt**:
> Create a comprehensive lesson on adding tools to LangFlow agents, specifically for API integration. Cover: What are "tools" in AI agents and why do they matter? How does an LLM decide when to call a tool vs respond directly (explain function calling)? Walk through the LangFlow components needed: API Request, Tool wrapper, connecting to Agent. How do you configure HTTP requests in LangFlow (URL, method, headers, params)? Explain the Datadog Query API as an example: authentication, query syntax, response format. How should you write system prompts that help agents use tools correctly? What are common pitfalls (tool not being called, wrong parameters, auth errors)? Include examples of good vs bad tool configurations.

**Links to Import**:
- https://docs.langflow.org/components-tools
- https://docs.langflow.org/components-api-request
- https://docs.datadoghq.com/api/latest/metrics/#query-timeseries-data
- https://docs.datadoghq.com/api/latest/authentication/
- https://platform.openai.com/docs/guides/function-calling

---

### Stage 3: Testing & Prompt Engineering

**Prompt**:
> Create a lesson on testing and refining AI agents for production reliability. Cover: What does it mean to "test" an AI agent vs testing traditional software? How do you create a test matrix for agent behavior? What are common failure modes for tool-using agents (over-calling, under-calling, hallucinating parameters)? How do you read and interpret agent execution logs/chain of thought? What are prompt engineering techniques specifically for tool-using agents? How do you handle errors from external APIs gracefully? What's the iterative refinement process: test → observe → adjust? How do you know when an agent is "production ready"? Include examples of prompts that worked vs prompts that failed.

**Links to Import**:
- https://www.anthropic.com/research/building-effective-agents
- https://docs.langflow.org/workspace-playground
- https://platform.openai.com/docs/guides/prompt-engineering

---

### Stage 4: API Integration

**Prompt**:
> Create a lesson on exposing LangFlow agents via API for integration with external applications. Cover: How does LangFlow's API work architecturally? What are flow IDs and how do you find them? How does API authentication work in LangFlow (API keys vs JWT)? Walk through the /api/v1/run endpoint: request format, headers, body structure. What does the response look like and how do you parse it? What's the difference between streaming and non-streaming responses? How do you test APIs with curl before integrating? Show how to integrate LangFlow API calls into a Node.js/Express application. What are common issues (CORS, auth failures, timeout) and how to debug them?

**Links to Import**:
- https://docs.langflow.org/configuration-api-keys
- https://docs.langflow.org/workspace-api
- https://docs.langflow.org/deployment-api

---

### Stage 5: MCP Protocol

**Prompt**:
> Create a comprehensive lesson on MCP (Model Context Protocol) for connecting AI agents. Cover: What is MCP and what problem does it solve? Who created it and why? Explain the architecture: servers, clients, transports - use a restaurant analogy (menu = tools, waiter = transport, kitchen = server). How do tools work in MCP: registration, discovery, calling? Walk through implementing an MCP server in Node.js that wraps an existing API. How do you implement an MCP client? What are the transport options (stdio, HTTP, WebSocket) and when to use each? What are the benefits of MCP over direct API integration? How does MCP enable multi-agent systems? Include code examples and common pitfalls.

**Links to Import**:
- https://modelcontextprotocol.io/introduction
- https://modelcontextprotocol.io/quickstart/server
- https://modelcontextprotocol.io/quickstart/client
- https://github.com/modelcontextprotocol/servers
- https://github.com/modelcontextprotocol/typescript-sdk

---

## Claude Code Instructions

When helping with this component, Claude Code should:

1. **Reference this document** for technical specifications and context
2. **Follow the stages in order** - each builds on the previous
3. **Use the verification steps** to confirm each stage works
4. **Update environment variables** in `.env.local` as needed
5. **Test integrations** with curl before writing application code
6. **Keep the main README.md updated** with progress

### Commands Claude Code might need:

```bash
# Test LangFlow API
curl -X POST "https://langflow.neil-everette.com/api/v1/run/{flow-id}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LANGFLOW_API_KEY" \
  -d '{"input_value": "What is my CPU usage?", "output_type": "chat", "input_type": "chat"}'

# Test local Datadog agent endpoint
curl -X POST "http://localhost:4000/api/datadog-agent" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is my CPU usage?"}'

# Install MCP SDK
npm install @modelcontextprotocol/sdk
```

---

## Progress Tracking

| Stage | Status | Notes |
|-------|--------|-------|
| 1. Base Agent | ⬜ Not Started | Create in LangFlow UI |
| 2. Datadog Tool | ⬜ Not Started | Add API integration |
| 3. Test & Refine | ⬜ Not Started | Make reliable |
| 4. API Exposure | ⬜ Not Started | External access |
| 5. MCP Integration | ⬜ Not Started | Connect to client |
