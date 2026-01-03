# Building the LangFlow Datadog Agent

A learning guide to building a LangFlow-based Datadog agent and integrating it with the Generative UI client application via MCP.

---

## Overview

### What We're Building

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CLIENT APPLICATION                              │
│                      (CopilotKit + A2UI)                             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                         MCP Protocol
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LANGFLOW DATADOG AGENT                            │
│                                                                      │
│  ┌──────────┐   ┌────────────┐   ┌─────────┐   ┌──────────────┐    │
│  │  Chat    │──▶│   Prompt   │──▶│   LLM   │──▶│    Chat      │    │
│  │  Input   │   │  Template  │   │         │   │   Output     │    │
│  └──────────┘   └────────────┘   └────┬────┘   └──────────────┘    │
│                                       │                             │
│                                  Tool Call                          │
│                                       │                             │
│                                       ▼                             │
│                              ┌─────────────────┐                    │
│                              │  Datadog Tool   │                    │
│                              │  (API Request)  │                    │
│                              └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Learning Path

| Module | Topic | Outcome |
|--------|-------|---------|
| 1 | LangFlow Fundamentals | Understand how LangFlow works |
| 2 | Building Your First Agent | Create a working agent in LangFlow |
| 3 | Tool Integration | Add Datadog API as a tool |
| 4 | Testing & Refinement | Make the agent reliable |
| 5 | API Exposure | Call the agent from external apps |
| 6 | MCP Integration | Connect to client via MCP |

---

## Module 1: LangFlow Fundamentals

### Understanding visual AI agent development

Before building agents, you need to understand what LangFlow is and how it relates to the broader AI development ecosystem. LangFlow is a visual development environment that makes it easier to build AI applications without writing extensive code.

**Core concepts:**
- What is LangFlow and how it relates to LangChain
- Visual flow-based programming for AI applications
- Components: the building blocks of LangFlow (inputs, outputs, LLMs, tools)
- Flows: how components connect to create AI pipelines
- The difference between prompting flows and agent flows
- LangFlow's role in the AI development stack

**Why this matters for your project:**
Understanding LangFlow's architecture helps you design agents that are modular and maintainable. You'll be creating a Datadog agent that needs to be reliable, testable, and eventually connected to your client application. Knowing how LangFlow works under the hood helps you debug issues and extend functionality.

### Module 1 Prompt

> Create a lesson on LangFlow fundamentals for someone building their first AI agent. Cover: What is LangFlow and how does it relate to LangChain? What problem does it solve compared to writing code directly? Explain the concept of "flows" and "components" - use a plumbing or electrical circuit analogy. What are the core component types (inputs, outputs, LLMs, tools, memory)? What's the difference between a simple prompt flow and an agent flow? How does data move through a flow? What happens when you click "run"? Use practical examples and avoid jargon where possible.

### Links to Import

- https://docs.langflow.org/
- https://docs.langflow.org/get-started-introduction
- https://docs.langflow.org/concepts-overview
- https://python.langchain.com/docs/concepts/

---

## Module 2: Building Your First Agent

### Creating a working agent from template

Now that you understand the concepts, it's time to build. This module walks through creating your first agent using LangFlow's Simple Agent template. You'll learn the practical skills of navigating the UI, configuring components, and testing in the playground.

**Core concepts:**
- Navigating the LangFlow interface (sidebar, canvas, settings)
- Creating a new flow from templates
- The Simple Agent template structure
- Configuring the LLM component (model selection, API keys, parameters)
- Understanding the Agent component and its settings
- Chat Input and Chat Output components
- The Playground: testing your agent interactively
- Reading agent execution logs

**Why this matters for your project:**
This is where theory becomes practice. The agent you create here will become your Datadog agent. Getting comfortable with the LangFlow UI now means you'll be faster when adding complexity later. The Simple Agent template gives you a working foundation that you'll extend with Datadog capabilities.

### Hands-On Steps

1. **Open LangFlow** at https://langflow.neil-everette.com
2. **Create new flow**: Click "+ New Flow" → Select "Simple Agent"
3. **Name your flow**: "Datadog Agent"
4. **Explore the canvas**: Identify Chat Input → Agent → Chat Output
5. **Configure the Agent**:
   - Click the Agent component
   - Select your LLM (OpenAI GPT-4 or Claude)
   - Add your API key (or use Global Variables)
   - Set temperature to 0.7
6. **Test in Playground**:
   - Click "Playground" button
   - Send: "Hello, what can you help me with?"
   - Verify you get a response

### Success Checklist

- [ ] Flow created and named "Datadog Agent"
- [ ] Can identify all three main components
- [ ] LLM configured with API key
- [ ] Playground test returns a response
- [ ] Can view execution logs

### Module 2 Prompt

> Create a hands-on tutorial for building a first agent in LangFlow. Cover: How to navigate the LangFlow interface (where are templates, components, settings)? Walk through creating a Simple Agent step by step. What does each component in the Simple Agent template do? How do you configure an LLM component (what are the key settings like temperature, model selection)? What is the Playground and how do you use it for testing? How do you read the execution logs to understand what the agent did? What are common mistakes beginners make? Include troubleshooting tips for when things don't work.

### Links to Import

- https://docs.langflow.org/starter-projects-simple-agent
- https://docs.langflow.org/components-agents
- https://docs.langflow.org/workspace-playground
- https://docs.langflow.org/configuration-global-variables

---

## Module 3: Tool Integration (Datadog API)

### Giving your agent the ability to fetch real data

An agent without tools is just a chatbot. Tools give agents the ability to take actions and retrieve information from external systems. This module covers how to add the Datadog API as a tool that your agent can call when users ask about infrastructure metrics.

**Core concepts:**
- What are tools in the context of AI agents?
- How LLMs decide when to use tools (function calling)
- The Tool component in LangFlow
- API Request component configuration
- HTTP methods, headers, and authentication
- Datadog Query API: endpoint, parameters, response format
- Connecting tools to the Agent component
- System prompts that guide tool usage
- Parsing and formatting API responses

**Why this matters for your project:**
This is the core of what makes your Datadog agent useful. Without the tool integration, your agent can only talk about Datadog—it can't actually fetch real metrics. Understanding how tools work also helps you add more data sources later (PagerDuty, AWS, etc.).

### Datadog API Reference

**Endpoint:** `https://api.us5.datadoghq.com/api/v1/query`

**Authentication Headers:**
```
DD-API-KEY: your-api-key
DD-APPLICATION-KEY: your-app-key
```

**Query Parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `query` | Datadog metric query | `avg:system.cpu.user{*}` |
| `from` | Start timestamp (Unix) | `1704067200` |
| `to` | End timestamp (Unix) | `1704070800` |

**Available Metrics:**
- `system.cpu.user` - CPU user time
- `system.cpu.system` - CPU system time
- `system.mem.usable` - Available memory
- `system.mem.total` - Total memory
- `system.load.1` - 1-minute load average
- `system.disk.in_use` - Disk utilization

### Hands-On Steps

1. **Add API Request component**:
   - Search sidebar for "API Request"
   - Drag onto canvas below Agent

2. **Configure Datadog API**:
   - URL: `https://api.us5.datadoghq.com/api/v1/query`
   - Method: GET
   - Headers: Add DD-API-KEY and DD-APPLICATION-KEY

3. **Create a Tool wrapper**:
   - Add a Tool component or Python Function
   - Configure to accept query parameters
   - Connect to API Request

4. **Connect Tool to Agent**:
   - Link Tool output to Agent's "tools" input
   - Agent can now call this tool

5. **Update System Prompt**:
   ```
   You are a Datadog infrastructure monitoring assistant.

   When users ask about system health, use the datadog_query tool.

   Available metrics:
   - CPU: system.cpu.user, system.cpu.system
   - Memory: system.mem.usable, system.mem.total
   - Load: system.load.1, system.load.5, system.load.15
   - Disk: system.disk.in_use

   Always explain what metrics mean and highlight concerning values.
   ```

6. **Test Datadog queries**:
   - "What's my current CPU usage?"
   - "Show me memory utilization"
   - "Is my server healthy?"

### Success Checklist

- [ ] API Request component configured with Datadog credentials
- [ ] Tool component created and connected to Agent
- [ ] System prompt updated with available metrics
- [ ] Agent successfully fetches real Datadog data
- [ ] Responses include actual metric values

### Module 3 Prompt

> Create a comprehensive lesson on adding tools to LangFlow agents, specifically for Datadog API integration. Cover: What are "tools" in AI agents and why do they matter? How does an LLM decide when to call a tool vs respond directly (explain function calling)? Walk through the LangFlow components needed: API Request, Tool wrapper, connecting to Agent. How do you configure HTTP requests in LangFlow (URL, method, headers, params)? Explain the Datadog Query API: authentication, query syntax, response format. How should you write system prompts that help agents use tools correctly? What are common pitfalls (tool not being called, wrong parameters, auth errors)? Include examples of good vs bad tool configurations.

### Links to Import

- https://docs.langflow.org/components-tools
- https://docs.langflow.org/components-api-request
- https://docs.datadoghq.com/api/latest/metrics/#query-timeseries-data
- https://docs.datadoghq.com/api/latest/authentication/
- https://platform.openai.com/docs/guides/function-calling

---

## Module 4: Testing & Refinement

### Making your agent reliable and production-ready

Building something that works once is easy. Building something that works reliably is hard. This module covers testing strategies, prompt engineering, error handling, and the iterative refinement process that turns a prototype into a production-ready agent.

**Core concepts:**
- Testing strategies for AI agents
- Understanding agent "chain of thought"
- Common failure modes: over-calling tools, under-calling tools, wrong parameters
- Prompt engineering for tool-using agents
- Handling API errors gracefully
- Edge cases: invalid queries, missing data, rate limits
- Iterative refinement: test → observe → adjust → repeat
- Logging and debugging in LangFlow

**Why this matters for your project:**
An unreliable agent erodes user trust. If users ask about CPU and sometimes get answers and sometimes get errors, they'll stop using the feature. This module teaches you to identify failure modes and fix them before they reach users.

### Testing Matrix

| Test Case | User Input | Expected Agent Behavior |
|-----------|------------|------------------------|
| Direct metric query | "What's my CPU usage?" | Calls tool, returns current % |
| General health check | "Is my server healthy?" | Calls multiple metrics, provides assessment |
| Conversational | "Hello" | Responds without calling tool |
| Ambiguous | "How's it going?" | Asks clarifying question or checks health |
| Invalid metric | "Show me banana metrics" | Explains metric isn't available |
| Historical | "What was CPU yesterday?" | Adjusts time range, fetches data |

### Prompt Engineering Tips

**Be specific about when to use tools:**
```
❌ "Use the datadog tool to get metrics"
✅ "When users ask about CPU, memory, disk, load, or system health,
    use the datadog_query tool. For general conversation, respond directly."
```

**Define thresholds:**
```
✅ "CPU above 80% is concerning. Above 95% is critical.
    Memory above 90% is concerning. Load above 4.0 is high for most systems."
```

**Specify response format:**
```
✅ "Always include: the current value, what it means,
    and whether it's normal/concerning/critical."
```

### Hands-On Steps

1. **Run through test matrix**: Test each case in Playground
2. **Review execution logs**: For each test, examine chain of thought
3. **Identify failures**: Note where agent behavior was unexpected
4. **Adjust prompts**: Refine system prompt based on failures
5. **Add error handling**: Configure fallback responses for API errors
6. **Re-test**: Verify fixes work without breaking other cases

### Success Checklist

- [ ] All test matrix cases pass
- [ ] Agent doesn't call tools unnecessarily
- [ ] Agent handles errors gracefully
- [ ] Responses are consistent and useful
- [ ] Edge cases are handled appropriately

### Module 4 Prompt

> Create a lesson on testing and refining AI agents for production reliability. Cover: What does it mean to "test" an AI agent vs testing traditional software? How do you create a test matrix for agent behavior? What are common failure modes for tool-using agents (over-calling, under-calling, hallucinating parameters)? How do you read and interpret agent execution logs/chain of thought? What are prompt engineering techniques specifically for tool-using agents? How do you handle errors from external APIs gracefully? What's the iterative refinement process: test → observe → adjust? How do you know when an agent is "production ready"? Include examples of prompts that worked vs prompts that failed.

### Links to Import

- https://www.anthropic.com/research/building-effective-agents
- https://docs.langflow.org/workspace-playground
- https://platform.openai.com/docs/guides/prompt-engineering
- https://docs.langchain.com/docs/use-cases/agents

---

## Module 5: API Exposure

### Making your agent callable from external applications

Your agent works in the Playground, but that's just for testing. To integrate with your generative UI application, you need to expose the agent as an API endpoint that your server can call. This module covers LangFlow's API capabilities.

**Core concepts:**
- LangFlow's API architecture
- Flow IDs and how to find them
- API authentication (API keys)
- The `/api/v1/run/{flow-id}` endpoint
- Request and response formats
- Streaming vs non-streaming responses
- Testing APIs with curl
- Integrating LangFlow API into Node.js/Express

**Why this matters for your project:**
This is the bridge between LangFlow and your generative UI application. Without API access, your agent is isolated in LangFlow. With API access, your CopilotKit client can call the agent and receive responses to render in the UI.

### API Reference

**Endpoint:**
```
POST https://langflow.neil-everette.com/api/v1/run/{flow-id}
```

**Headers:**
```
Content-Type: application/json
x-api-key: your-langflow-api-key
```

**Request Body:**
```json
{
  "input_value": "What is my current CPU usage?",
  "output_type": "chat",
  "input_type": "chat"
}
```

**Response Format:**
```json
{
  "outputs": [
    {
      "outputs": [
        {
          "results": {
            "message": {
              "text": "Your current CPU usage is 23.5%..."
            }
          }
        }
      ]
    }
  ]
}
```

### Hands-On Steps

1. **Get your Flow ID**:
   - Open your Datadog Agent flow
   - Look at URL: `https://langflow.neil-everette.com/flow/{flow-id}`
   - Copy the UUID

2. **Generate API Key**:
   - Go to Settings → Langflow API Keys
   - Click "+ Create new secret key"
   - Copy and save securely

3. **Test with curl**:
   ```bash
   curl -X POST "https://langflow.neil-everette.com/api/v1/run/{flow-id}" \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{
       "input_value": "What is my current CPU usage?",
       "output_type": "chat",
       "input_type": "chat"
     }'
   ```

4. **Add to Express server** (`server/index.ts`):
   ```typescript
   const LANGFLOW_URL = 'https://langflow.neil-everette.com';
   const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
   const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;

   app.post('/api/datadog-agent', async (req, res) => {
     const { query } = req.body;

     const response = await fetch(
       `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
       {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-api-key': LANGFLOW_API_KEY,
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
     res.json({ message });
   });
   ```

5. **Test from your app**:
   ```bash
   curl -X POST "http://localhost:4000/api/datadog-agent" \
     -H "Content-Type: application/json" \
     -d '{"query": "What is my CPU usage?"}'
   ```

### Success Checklist

- [ ] Flow ID identified and saved
- [ ] API key generated and stored in environment variables
- [ ] curl test returns expected response
- [ ] Express endpoint created and working
- [ ] Can call LangFlow agent from generative-ui-prototype server

### Module 5 Prompt

> Create a lesson on exposing LangFlow agents via API for integration with external applications. Cover: How does LangFlow's API work architecturally? What are flow IDs and how do you find them? How does API authentication work in LangFlow (API keys vs JWT)? Walk through the /api/v1/run endpoint: request format, headers, body structure. What does the response look like and how do you parse it? What's the difference between streaming and non-streaming responses? How do you test APIs with curl before integrating? Show how to integrate LangFlow API calls into a Node.js/Express application. What are common issues (CORS, auth failures, timeout) and how to debug them?

### Links to Import

- https://docs.langflow.org/configuration-api-keys
- https://docs.langflow.org/workspace-api
- https://docs.langflow.org/deployment-api

---

## Module 6: MCP Integration

### Connecting agents using the Model Context Protocol

MCP (Model Context Protocol) is a standardized way for AI applications to communicate with tools and data sources. Instead of custom API integrations, MCP provides a common protocol that makes agents interoperable. This module covers implementing MCP to connect your LangFlow agent to the CopilotKit client.

**Core concepts:**
- What is MCP and why was it created?
- MCP architecture: servers, clients, transports
- Tools in MCP: how agents discover and call capabilities
- MCP server implementation (wrapping LangFlow)
- MCP client implementation (in CopilotKit)
- Transport options: stdio, HTTP, WebSocket
- The benefits of MCP over direct API calls
- Future-proofing: adding more agents via MCP

**Why this matters for your project:**
MCP is the glue that connects your client agent to backend agents. Using MCP instead of direct API calls means you can easily add more agents later (PagerDuty, AWS, etc.) without rewriting integration code. It's an investment in extensibility.

### Architecture with MCP

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CLIENT APPLICATION                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  CopilotKit Agent                                            │    │
│  │         │                                                    │    │
│  │         ▼                                                    │    │
│  │  ┌─────────────┐                                            │    │
│  │  │ MCP Client  │  ◄── Discovers tools, calls them           │    │
│  │  └──────┬──────┘                                            │    │
│  │         │                                                    │    │
│  └─────────┼────────────────────────────────────────────────────┘    │
└────────────┼────────────────────────────────────────────────────────┘
             │
        MCP Protocol (HTTP/WebSocket)
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MCP SERVER                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Tools Registry                                              │    │
│  │  • query_datadog - "Query infrastructure metrics"           │    │
│  │  • (future) query_pagerduty - "Check incidents"             │    │
│  │  • (future) query_aws - "Get AWS resource status"           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│                  ┌─────────────┐                                    │
│                  │  LangFlow   │                                    │
│                  │  API Call   │                                    │
│                  └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### MCP Server Implementation

Create `server/mcp-server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const LANGFLOW_URL = process.env.LANGFLOW_URL;
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;

const server = new Server(
  { name: 'datadog-agent', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register available tools
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'query_datadog',
    description: 'Query Datadog infrastructure metrics. Ask about CPU, memory, disk, load, or general system health.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query about infrastructure'
        }
      },
      required: ['query']
    }
  }]
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'query_datadog') {
    const { query } = request.params.arguments;

    // Call LangFlow agent
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
    const message = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text
      || 'No response from Datadog agent';

    return {
      content: [{ type: 'text', text: message }]
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.log('MCP server running');
```

### Connecting CopilotKit to MCP

Update the CopilotKit action to use MCP:

```typescript
// In src/App.tsx
useCopilotAction({
  name: 'queryInfrastructure',
  description: 'Query infrastructure metrics via the Datadog agent',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'What to ask about infrastructure',
      required: true,
    },
  ],
  handler: async ({ query }) => {
    // Call MCP endpoint
    const response = await fetch('/api/mcp/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'query_datadog',
        arguments: { query }
      }),
    });

    const data = await response.json();

    // Parse response and create A2UI components
    // ... (render logic)

    return data.content[0].text;
  },
});
```

### Hands-On Steps

1. **Install MCP SDK**:
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

2. **Create MCP server** (`server/mcp-server.ts`)

3. **Add MCP endpoint** to Express server

4. **Update CopilotKit** action to call MCP

5. **Test end-to-end**:
   - User asks "What's my CPU usage?" in chat
   - CopilotKit calls MCP tool
   - MCP server calls LangFlow
   - LangFlow queries Datadog
   - Response flows back and renders

### Success Checklist

- [ ] MCP SDK installed
- [ ] MCP server created with query_datadog tool
- [ ] MCP endpoint added to Express
- [ ] CopilotKit action updated to use MCP
- [ ] End-to-end test successful
- [ ] UI renders Datadog data from agent

### Module 6 Prompt

> Create a comprehensive lesson on MCP (Model Context Protocol) for connecting AI agents. Cover: What is MCP and what problem does it solve? Who created it and why? Explain the architecture: servers, clients, transports - use a restaurant analogy (menu = tools, waiter = transport, kitchen = server). How do tools work in MCP: registration, discovery, calling? Walk through implementing an MCP server in Node.js that wraps an existing API. How do you implement an MCP client? What are the transport options (stdio, HTTP, WebSocket) and when to use each? What are the benefits of MCP over direct API integration? How does MCP enable multi-agent systems? Include code examples and common pitfalls.

### Links to Import

- https://modelcontextprotocol.io/introduction
- https://modelcontextprotocol.io/quickstart/server
- https://modelcontextprotocol.io/quickstart/client
- https://github.com/modelcontextprotocol/servers
- https://github.com/modelcontextprotocol/typescript-sdk

---

## Quick Reference

### Environment Variables

```env
# LangFlow
LANGFLOW_URL=https://langflow.neil-everette.com
LANGFLOW_API_KEY=sk-...
LANGFLOW_FLOW_ID=your-flow-uuid

# Datadog (used in LangFlow)
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
DATADOG_SITE=us5.datadoghq.com

# OpenAI (used by LangFlow LLM)
OPENAI_API_KEY=sk-...
```

### Key URLs

| Service | URL |
|---------|-----|
| LangFlow UI | https://langflow.neil-everette.com |
| LangFlow API | https://langflow.neil-everette.com/api/v1 |
| Datadog API | https://api.us5.datadoghq.com/api/v1 |
| MCP Docs | https://modelcontextprotocol.io |

### Troubleshooting

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| LangFlow API returns HTML | Auth not working | Check API key, check nginx config |
| Agent doesn't call tools | Poor system prompt | Be more explicit about when to use tools |
| Datadog returns no data | Wrong host filter | Check query syntax, verify time range |
| MCP connection fails | Transport mismatch | Verify server/client use same transport |
| Slow responses | LLM latency | Consider streaming, add loading states |

---

## Progress Tracker

| Module | Status | Date Completed | Notes |
|--------|--------|----------------|-------|
| 1. LangFlow Fundamentals | ⬜ Not Started | | |
| 2. Building Your First Agent | ⬜ Not Started | | |
| 3. Tool Integration | ⬜ Not Started | | |
| 4. Testing & Refinement | ⬜ Not Started | | |
| 5. API Exposure | ⬜ Not Started | | |
| 6. MCP Integration | ⬜ Not Started | | |
