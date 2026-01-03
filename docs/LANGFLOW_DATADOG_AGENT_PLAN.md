# Building the LangFlow Datadog Agent

A step-by-step guide to building a LangFlow-based Datadog agent and integrating it with the Generative UI client application via MCP.

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

### Prerequisites

- LangFlow instance running (https://langflow.neil-everette.com)
- Datadog account with API credentials
- OpenAI or Anthropic API key (for the LLM in LangFlow)
- The generative-ui-prototype codebase

---

## Stage 1: LangFlow Fundamentals & Creating the Base Agent

### Goal
Create a basic agent in LangFlow using the "Simple Agent" template and understand how LangFlow flows work.

### What You'll Learn
- LangFlow UI navigation
- Components and how they connect
- The flow of data through an agent
- Testing in the LangFlow playground

### Steps

#### 1.1 Create a New Flow
1. Open LangFlow: https://langflow.neil-everette.com
2. Navigate to your project folder (e.g., "Generative UI Prototype")
3. Click **"+ New Flow"**
4. Select **"Simple Agent"** template
5. Name it **"Datadog Agent"**

#### 1.2 Understand the Simple Agent Template
The template includes these components:

| Component | Purpose |
|-----------|---------|
| **Chat Input** | Receives user messages |
| **Agent** | The LLM that processes requests and can use tools |
| **Chat Output** | Returns the agent's response |

#### 1.3 Configure the LLM
1. Click on the **Agent** component
2. In the settings panel, configure:
   - **Model**: Select OpenAI GPT-4 or Claude
   - **API Key**: Add your OpenAI/Anthropic key (or use Global Variables)
   - **Temperature**: 0.7 (balanced between creative and deterministic)

#### 1.4 Test in Playground
1. Click the **"Playground"** button (bottom right)
2. Type: "Hello, what can you help me with?"
3. Verify the agent responds

#### 1.5 Success Criteria
- [ ] Flow created and named "Datadog Agent"
- [ ] LLM configured and responding
- [ ] Playground test successful

### Google NotebookLM Section

**Prompt for NotebookLM:**
```
I'm learning LangFlow to build AI agents. Please explain:
1. What is LangFlow and how does it relate to LangChain?
2. What are the core components in a LangFlow agent (Chat Input, Agent, Chat Output)?
3. How do "tools" work in LangFlow agents?
4. What is the difference between a simple prompt flow and an agent flow?

Focus on practical understanding for someone building their first agent.
```

**Links to Import:**
- https://docs.langflow.org/
- https://docs.langflow.org/components-agents
- https://docs.langflow.org/starter-projects-simple-agent

---

## Stage 2: Adding the Datadog Tool

### Goal
Add a custom tool that allows the agent to query the Datadog API for infrastructure metrics.

### What You'll Learn
- Adding tools to a LangFlow agent
- Configuring API Request components
- Connecting tools to the agent
- Handling API authentication

### Steps

#### 2.1 Add an API Request Component
1. In the component sidebar, search for **"API Request"**
2. Drag it onto the canvas
3. Position it below the Agent component

#### 2.2 Configure the Datadog API Request
Configure the API Request component:

| Setting | Value |
|---------|-------|
| **URL** | `https://api.us5.datadoghq.com/api/v1/query` |
| **Method** | GET |
| **Headers** | See below |
| **Query Parameters** | See below |

**Headers (as JSON):**
```json
{
  "DD-API-KEY": "your-datadog-api-key",
  "DD-APPLICATION-KEY": "your-datadog-app-key",
  "Content-Type": "application/json"
}
```

**Query Parameters:**
```
query: {query_string}
from: {from_timestamp}
to: {to_timestamp}
```

#### 2.3 Create a Tool Component
1. Search for **"Tool"** in the sidebar
2. Drag a **"Custom Component"** or use **"Python Function"** to create a tool
3. Configure it to:
   - Accept a metric query string
   - Calculate time range (e.g., last hour)
   - Call the API Request component
   - Return formatted results

#### 2.4 Connect Tool to Agent
1. Connect the Tool's output to the Agent's **tools** input
2. The agent will now have access to call this tool

#### 2.5 Update the Agent's System Prompt
Click on the Agent and add a system message:

```
You are a Datadog infrastructure monitoring assistant. You help users query and understand their system metrics.

Available metrics you can query:
- CPU: system.cpu.user, system.cpu.system
- Memory: system.mem.usable, system.mem.total
- Load: system.load.1, system.load.5, system.load.15
- Disk: system.disk.in_use
- Network: system.net.bytes_rcvd, system.net.bytes_sent

When users ask about infrastructure health, use the datadog_query tool to fetch real metrics.
Always explain what the metrics mean and highlight any concerning values.
```

#### 2.6 Test Datadog Integration
1. Open Playground
2. Test queries:
   - "What's my current CPU usage?"
   - "Show me memory utilization"
   - "Are there any performance issues?"
3. Verify the agent calls the Datadog tool and returns real data

#### 2.7 Success Criteria
- [ ] API Request component configured with Datadog credentials
- [ ] Tool created and connected to agent
- [ ] Agent can fetch real Datadog metrics
- [ ] Playground tests return actual infrastructure data

### Google NotebookLM Section

**Prompt for NotebookLM:**
```
I'm adding a Datadog API integration to my LangFlow agent. Please explain:
1. How do tools work in LangFlow/LangChain agents?
2. What is function calling and how do LLMs decide when to use tools?
3. How should I structure API responses so the LLM can interpret them?
4. Best practices for error handling in agent tools
5. How does the Datadog Query API work (endpoint, authentication, query syntax)?

I want to understand both the LangFlow mechanics and the Datadog API.
```

**Links to Import:**
- https://docs.langflow.org/components-tools
- https://docs.langflow.org/components-api-request
- https://docs.datadoghq.com/api/latest/metrics/#query-timeseries-data
- https://docs.datadoghq.com/api/latest/authentication/

---

## Stage 3: Testing & Refining the Agent

### Goal
Thoroughly test the agent, handle edge cases, and refine the prompts for reliable operation.

### What You'll Learn
- Debugging LangFlow agents
- Prompt engineering for tool-using agents
- Handling errors gracefully
- Optimizing agent responses

### Steps

#### 3.1 Test Various Query Types
Test the agent with different user intents:

| Test Case | Expected Behavior |
|-----------|-------------------|
| "Show me CPU metrics" | Queries CPU, returns current value |
| "Is my server healthy?" | Queries multiple metrics, provides assessment |
| "What's the memory trend?" | Queries memory over time, describes trend |
| "Compare CPU and memory" | Queries both, provides comparison |
| "Hello" | Responds conversationally, doesn't call tool |

#### 3.2 Review Agent Logs
1. In Playground, click on the agent's execution
2. Review the chain of thought
3. Check if tool calls are appropriate
4. Identify any issues

#### 3.3 Refine System Prompt
Based on testing, adjust the system prompt to:
- Clarify when to use tools
- Improve response formatting
- Add metric thresholds (e.g., "CPU above 80% is concerning")

#### 3.4 Add Error Handling
Configure the flow to handle:
- API failures (Datadog down, auth errors)
- Invalid queries
- Rate limiting

#### 3.5 Success Criteria
- [ ] Agent handles various query types correctly
- [ ] Errors are handled gracefully
- [ ] Responses are clear and actionable
- [ ] Tool calls are appropriate (not over/under used)

### Google NotebookLM Section

**Prompt for NotebookLM:**
```
I'm testing and debugging my LangFlow agent. Please explain:
1. How to debug tool-calling agents - what to look for
2. Common issues with LLM tool usage (over-calling, under-calling, wrong parameters)
3. Prompt engineering techniques for reliable tool-using agents
4. How to structure system prompts for infrastructure monitoring assistants
5. Best practices for error handling in AI agents

I want to make my agent reliable and predictable.
```

**Links to Import:**
- https://docs.langflow.org/workspace-playground
- https://www.anthropic.com/research/building-effective-agents
- https://platform.openai.com/docs/guides/function-calling

---

## Stage 4: Exposing the Agent via API

### Goal
Make the LangFlow agent accessible via HTTP API so external applications can call it.

### What You'll Learn
- LangFlow API endpoints
- Authentication for API access
- Testing API calls externally
- Response formats

### Steps

#### 4.1 Get the Flow ID
1. In LangFlow, open your "Datadog Agent" flow
2. Look at the URL - it contains the flow ID:
   `https://langflow.neil-everette.com/flow/{flow-id}`
3. Copy the flow ID (UUID format)

#### 4.2 Generate an API Key
1. Go to **Settings** → **Langflow API Keys**
2. Click **"+ Create new secret key"**
3. Copy and save the API key securely

#### 4.3 Test the API Endpoint
Use curl to test:

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

#### 4.4 Understand the Response Format
The API returns:

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

#### 4.5 Test from the Generative UI Server
Add a test endpoint in `server/index.ts`:

```typescript
app.post('/api/test-langflow', async (req, res) => {
  const { query } = req.body;

  const response = await fetch(
    `https://langflow.neil-everette.com/api/v1/run/${LANGFLOW_FLOW_ID}`,
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
  res.json(data);
});
```

#### 4.6 Success Criteria
- [ ] Flow ID identified
- [ ] API key generated
- [ ] curl test successful
- [ ] Can call LangFlow from generative-ui-prototype server

### Google NotebookLM Section

**Prompt for NotebookLM:**
```
I'm exposing my LangFlow agent via API. Please explain:
1. How LangFlow's API endpoints work (/api/v1/run, etc.)
2. Authentication methods for LangFlow API
3. The structure of API requests and responses
4. How to handle streaming vs non-streaming responses
5. Best practices for integrating LangFlow APIs into applications

I want to call my LangFlow agent from a Node.js/Express backend.
```

**Links to Import:**
- https://docs.langflow.org/configuration-api-keys
- https://docs.langflow.org/workspace-api

---

## Stage 5: Setting Up MCP Integration

### Goal
Connect the LangFlow Datadog agent to the client application using MCP (Model Context Protocol).

### What You'll Learn
- What MCP is and why it's useful
- LangFlow's MCP Server feature
- Creating an MCP client in Node.js
- Bidirectional agent communication

### Steps

#### 5.1 Understand MCP
MCP (Model Context Protocol) is a standardized way for AI applications to connect to data sources and tools. It provides:
- Tool discovery
- Standardized request/response format
- Secure communication between agents

#### 5.2 Option A: LangFlow Native MCP Server
If LangFlow supports MCP Server natively:

1. Go to **Settings** → **MCP Servers**
2. Click **"+ Add MCP Server"**
3. Configure to expose your Datadog Agent flow
4. Note the MCP endpoint URL

#### 5.3 Option B: Create MCP Wrapper
If native MCP isn't available, create a wrapper:

Create `server/mcp-langflow-bridge.ts`:

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

// Register the Datadog query tool
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'query_datadog',
    description: 'Query Datadog infrastructure metrics using natural language',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query about infrastructure metrics'
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

    return {
      content: [{ type: 'text', text: message || 'No response from agent' }]
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 5.4 Connect CopilotKit to MCP
Update `server/index.ts` to use MCP:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Create MCP client
const mcpClient = new Client(
  { name: 'copilotkit-client', version: '1.0.0' },
  { capabilities: {} }
);

// Connect to the Datadog agent MCP server
await mcpClient.connect(/* transport config */);

// List available tools
const tools = await mcpClient.request({ method: 'tools/list' });
console.log('Available MCP tools:', tools);
```

#### 5.5 Add CopilotKit Action for MCP
Update `src/App.tsx` to use the MCP-connected agent:

```typescript
useCopilotAction({
  name: 'queryDatadogAgent',
  description: 'Query the Datadog agent for infrastructure metrics and insights',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'What to ask about infrastructure health',
      required: true,
    },
  ],
  handler: async ({ query }) => {
    const response = await fetch('/api/mcp/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    return data.message;
  },
});
```

#### 5.6 Success Criteria
- [ ] MCP server configured (native or wrapper)
- [ ] MCP client can connect and list tools
- [ ] CopilotKit can call Datadog agent via MCP
- [ ] End-to-end query works: UI → CopilotKit → MCP → LangFlow → Datadog

### Google NotebookLM Section

**Prompt for NotebookLM:**
```
I'm connecting my LangFlow agent to a client application using MCP (Model Context Protocol). Please explain:
1. What is MCP and why was it created?
2. The architecture of MCP (servers, clients, transports)
3. How to create an MCP server that wraps an existing API
4. How to create an MCP client in Node.js
5. How MCP compares to direct API calls - what are the benefits?
6. Real-world examples of MCP usage

I want to understand MCP well enough to implement it correctly.
```

**Links to Import:**
- https://modelcontextprotocol.io/introduction
- https://modelcontextprotocol.io/quickstart/server
- https://modelcontextprotocol.io/quickstart/client
- https://github.com/modelcontextprotocol/servers

---

## Stage 6: End-to-End Integration & Testing

### Goal
Complete the integration, test the full data flow, and ensure the UI renders agent responses correctly.

### What You'll Learn
- Full system integration testing
- Converting agent responses to A2UI components
- Error handling across the stack
- Performance optimization

### Steps

#### 6.1 Test Full Data Flow
Verify the complete path:

```
User types "Show me CPU metrics"
    │
    ▼
CopilotKit interprets intent
    │
    ▼
Calls queryDatadogAgent action
    │
    ▼
Server calls MCP Datadog tool
    │
    ▼
MCP server calls LangFlow agent
    │
    ▼
LangFlow agent queries Datadog API
    │
    ▼
Response flows back through MCP
    │
    ▼
CopilotKit receives response
    │
    ▼
A2UI renders metric cards
```

#### 6.2 Convert Agent Response to A2UI Components
Update the action handler to parse agent responses and create A2UI components:

```typescript
handler: async ({ query }) => {
  const response = await fetch('/api/mcp/datadog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();

  // Parse the agent's response and create A2UI components
  const components = parseAgentResponseToA2UI(data.message);

  setDashboardState({
    components,
    lastUpdated: new Date().toISOString(),
    agentMessage: data.message,
  });

  return `Displayed ${components.length} metrics from Datadog agent`;
},
```

#### 6.3 Test Error Scenarios
Test handling of:
- LangFlow agent unavailable
- Datadog API errors
- Invalid user queries
- Network timeouts

#### 6.4 Performance Optimization
- Add caching for repeated queries
- Implement request timeouts
- Consider streaming responses

#### 6.5 Success Criteria
- [ ] Full data flow works end-to-end
- [ ] Agent responses render as A2UI components
- [ ] Errors are handled gracefully at every layer
- [ ] Performance is acceptable (<5s for typical queries)

### Google NotebookLM Section

**Prompt for NotebookLM:**
```
I'm completing the integration of my multi-agent system. Please explain:
1. Best practices for testing multi-agent systems end-to-end
2. How to handle errors that can occur at different layers of the stack
3. Strategies for parsing LLM responses into structured data
4. Performance optimization for agent chains
5. Monitoring and observability for multi-agent systems

I want my system to be reliable, performant, and debuggable.
```

**Links to Import:**
- https://docs.langflow.org/configuration-environment-variables
- https://docs.copilotkit.ai/

---

## Quick Reference

### Environment Variables Needed

```env
# LangFlow
LANGFLOW_URL=https://langflow.neil-everette.com
LANGFLOW_API_KEY=sk-...
LANGFLOW_FLOW_ID=your-flow-uuid

# Datadog (used by LangFlow agent)
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
DATADOG_SITE=us5.datadoghq.com

# OpenAI (used by LangFlow agent LLM)
OPENAI_API_KEY=sk-...
```

### Key URLs

| Service | URL |
|---------|-----|
| LangFlow UI | https://langflow.neil-everette.com |
| LangFlow API | https://langflow.neil-everette.com/api/v1 |
| Datadog API | https://api.us5.datadoghq.com/api/v1 |
| MCP Documentation | https://modelcontextprotocol.io |

### Troubleshooting

| Issue | Solution |
|-------|----------|
| LangFlow API returns HTML | Check API key, check nginx proxy config |
| Agent doesn't call tools | Adjust system prompt, check tool connection |
| Datadog returns no data | Verify host filter, check time range |
| MCP connection fails | Check transport config, verify server running |

---

## Changelog

| Date | Stage | Notes |
|------|-------|-------|
| | Stage 1 | |
| | Stage 2 | |
| | Stage 3 | |
| | Stage 4 | |
| | Stage 5 | |
| | Stage 6 | |
