# System Architecture

## High-Level Overview

```
+------------------+     +------------------+     +-------------------+
|   React Frontend |---->|  Express Backend |---->|  External Services|
|   (CopilotKit)   |     |  (API + MCP)     |     |  Datadog/AWS/LLM  |
+------------------+     +------------------+     +-------------------+
        |                        |
        v                        v
+------------------+     +------------------+
|  A2UI Components |     |  MCP Registry    |
|  (Dashboard)     |     |  (Orchestration) |
+------------------+     +------------------+
```

## Core Architectural Patterns

### 1. A2UI (Agent-to-UI) Pattern
The application implements a declarative UI specification where AI agents emit structured component definitions rather than rendering HTML directly.

**Flow:**
1. User sends chat message via CopilotKit
2. AI processes request via useCopilotAction hooks
3. Agent emits A2UI component definitions (JSON)
4. Frontend renders appropriate React components
5. Dashboard state updates with new components

**Key Types:**
```typescript
type ComponentType =
  | 'metric_card'
  | 'card_group'
  | 'data_table'
  | 'alert_list'
  | 'status_indicator'
  | 'progress_bar'
  | 'ecr_summary';
```

### 2. MCP Orchestration Layer
The backend implements the Model Context Protocol for standardized tool access.

**Architecture:**
```
MCPRegistry (Singleton)
    |
    +-- MCPServerConfig[] (from mcp-servers.config.json)
    |
    +-- ConnectedServer[] (runtime connections)
    |       +-- Client (MCP SDK)
    |       +-- Transport (stdio/sse)
    |
    +-- NamespacedTool[] (cached tool list)
```

**Tool Namespacing:**
- Tools are namespaced by server ID: `datadog:get_system_metrics`
- Allows multiple MCP servers without name collisions
- Registry provides unified tool discovery and execution

### 3. Hybrid Data Fetching
The frontend uses a progressive migration pattern:
- **MCP-powered endpoints** - Route through MCP Registry for standardized access
- **Direct API fallback** - Legacy endpoints for features not yet MCP-enabled
- **LangFlow integration** - AI-powered metric interpretations

## Component Architecture

### Frontend Component Hierarchy
```
App.tsx
├── CopilotKit (Provider)
│   ├── CopilotChat (Chat UI)
│   └── useCopilotAction hooks (AI Actions)
├── BlurBackground (Visual)
├── DashboardCanvas
│   ├── VoiceOverlay
│   ├── VoiceButton
│   └── A2UI Components
│       ├── MetricCard
│       ├── CardGroup
│       ├── DataTable
│       ├── AlertList
│       ├── StatusIndicator
│       ├── ProgressBar
│       └── ECRSummaryCard
```

### Component Registry Pattern
```typescript
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  metric_card: MetricCard,
  card_group: CardGroup,
  data_table: DataTable,
  // ...
};

function renderComponent(component: A2UIComponent) {
  const Component = COMPONENT_REGISTRY[component.component];
  return <Component component={component} />;
}
```

## Data Flow

### 1. Chat Interaction Flow
```
User Input -> CopilotKit -> OpenAI -> useCopilotAction
                                           |
                                           v
                                    Update DashboardState
                                           |
                                           v
                                    Re-render Components
```

### 2. Metrics Data Flow
```
Dashboard Mount -> mcpClient.getOverviewFast()
                       |
                       v
               Express /api/mcp/call
                       |
                       v
               MCPRegistry.callTool()
                       |
                       v
               MCP Datadog Server
                       |
                       v
               Datadog API Query
```

### 3. AI Interpretation Flow
```
Metrics Loaded -> getInterpretations()
                       |
                       v
               /api/metrics/interpretations
                       |
                       v
               LangFlow Agent API
                       |
                       v
               Datadog Query + LLM Analysis
                       |
                       v
               Structured Interpretation Response
```

## API Architecture

### Endpoint Categories

| Category | Prefix | Purpose |
|----------|--------|---------|
| CopilotKit | `/api/copilotkit` | AI chat runtime |
| MCP | `/api/mcp/*` | MCP orchestration |
| Metrics | `/api/metrics/*` | Direct Datadog queries |
| Costs | `/api/costs/*` | AWS Cost Explorer |
| ECR | `/api/ecr/*` | Container registry |
| LangFlow | `/api/langflow/*` | AI agent queries |

### MCP Endpoints
- `GET /api/mcp/servers` - List connected MCP servers
- `GET /api/mcp/tools` - List all available tools
- `POST /api/mcp/call` - Execute tool on specific server
- `GET /api/mcp/call/:namespacedTool` - Execute by namespaced name

## State Management

### Dashboard State
```typescript
interface DashboardState {
  components: A2UIComponent[];
  lastUpdated: string;
  agentMessage?: string;
}
```

### State Flow
1. `useState` in App.tsx holds DashboardState
2. `useCopilotReadable` exposes state to AI
3. `useCopilotAction` handlers modify state
4. State changes trigger re-renders of DashboardCanvas

## Security Considerations

### API Keys & Secrets
- All secrets stored in `.env.local` (not committed)
- Server-side only - never exposed to frontend
- Environment validation on server startup

### Authentication
- Currently no user authentication
- Assumes single-user deployment
- API keys for external services stored server-side

## Scalability Patterns

### MCP Server Extensibility
```json
// mcp-servers.config.json
{
  "servers": [
    { "id": "datadog", "command": "npx", "args": ["ts-node", "./mcp-server.ts"] }
  ]
}
```
New MCP servers can be added via configuration without code changes.

### Component Extensibility
New A2UI component types can be added by:
1. Defining TypeScript interface in `types/a2ui.ts`
2. Creating React component in `components/a2ui/`
3. Registering in COMPONENT_REGISTRY
