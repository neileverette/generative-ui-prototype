# Widget Routing Map
## Complete Utterance-to-Widget Mapping for AI Routing

This document maps user utterances to widget configurations. Use this to determine which widgets to display based on user input.

---

## 📋 TABLE OF CONTENTS

1. [View Definitions](#view-definitions)
2. [Widget Reference](#widget-reference)
3. [Routing Rules](#routing-rules)
4. [Utterance Patterns](#utterance-patterns)

---

## 🎯 VIEW DEFINITIONS

### **OVERVIEW** (Landing Page - Default)
**Trigger**: App start, "home", "overview", "dashboard", "main", "back", "clear", "reset"

**Widgets Displayed**:
- Today's Update (summary banner)
- System Uptime (metric card - hardcoded)
- Memory (metric card - hardcoded)
- Claude Code Usage (usage widget)
- Anthropic API Usage (usage widget)
- Navigation Cards × 6 (shortcuts to other views)

**Actions**: No Copilot actions - static landing page view

---

### **SYSTEM METRICS** (Performance/Infrastructure)
**Trigger**: "system metrics", "performance", "infrastructure", "system health", "show all metrics", "cpu memory disk", "server health"

**Handler**: `handleFetchSystemInfrastructure()` → `fetchSystemMetrics` action

**Widgets Displayed**:
- MetricCard × N (one per system metric)
  - `system-metric-cpu_total`
  - `system-metric-cpu_idle`
  - `system-metric-memory`
  - `system-metric-load_average`
  - `system-metric-disk_usage`
  - `system-metric-io_wait`
  - `system-metric-network_bytes_sent`
  - `system-metric-network_bytes_recv`
  - `system-metric-swap_usage`
  - `system-metric-system_uptime`

**Properties**:
- Each card shows: title, value, unit, status (healthy/warning/critical)
- Cached insights with skeleton loaders
- Shimmer overlay when showing stale cached data
- Priority based on metric status

**Copilot Action**: `fetchSystemMetrics`

---

### **CONTAINERS** (Applications)
**Trigger**: "containers", "applications", "running apps", "docker", "show containers", "list containers", "running containers", "container status"

**Handler**: `handleFetchContainersList()` → `fetchContainersList` action

**Widgets Displayed**:
1. **Running Containers Count** (MetricCard)
   - ID: `running-containers-count`
   - Size: xl (featured)
   - Priority: high
   - Shows: total count of running containers

2. **ECR Summary** (ECRSummaryCard)
   - ID: `ecr-summary`
   - Priority: high
   - Column Span: 2
   - Shows: AWS ECR repositories, images, observations

3. **App Session Uptime** (MetricCard)
   - ID: `app-session-uptime`
   - Priority: low
   - Shows: uptime since app start

4. **App Memory** (MetricCard)
   - ID: `app-memory`
   - Priority: high (if warning) | low
   - Shows: Node.js memory usage

5. **Containers List Table** (DataTable)
   - ID: `containers-list-table`
   - Columns: Container, Memory (MiB), CPU %
   - Shows: All running Docker containers with metrics

**Copilot Actions**: `fetchContainersList`, `fetchRunningContainers`

**Related Actions**:
- `fetchContainerMetrics` (for specific container CPU)
- `fetchContainerMemory` (for specific container memory)

---

### **AUTOMATIONS** (Workflows)
**Trigger**: "automations", "workflows", "n8n", "langflow", "automation status", "workflow health", "show workflows", "automation health"

**Handler**: `handleFetchAutomations()` → `fetchAutomations` action

**Widgets Displayed**:
1. **Gmail Filter Workflow** (CardGroup)
   - ID: `automation-gmail-filter`
   - Title: "Gmail Filter"
   - Metrics:
     - Successful Executions
     - Failed Executions
     - Success Rate (%)
     - Total Times Run
     - Avg Runtime (if available)
     - Last Run (if available)
   - Includes time-saved insight

2. **Image Generator Workflow** (CardGroup)
   - ID: `automation-image-generator`
   - Title: "Image Generator"
   - Same metrics structure as Gmail Filter
   - Includes time-saved insight

**Copilot Actions**: `fetchAutomations`, `fetchGmailFilterMetrics`, `fetchImageGeneratorMetrics`

**Related Actions**:
- `getAutomationCount`
- `getTotalAutomationExecutions`
- `getTimeSavedByAutomations`
- `checkBrokenAutomations`
- `getNextScheduledAutomation`

---

### **COSTS** (AWS Spending)
**Trigger**: "costs", "spending", "aws costs", "cloud costs", "billing", "how much am i spending", "monthly cost", "infrastructure costs"

**Handler**: `handleFetchCosts()` → `fetchCostsOverview` action

**Widgets Displayed**:
1. **Current Month Cost** (MetricCard)
   - ID: `aws-total-cost`
   - Priority: high
   - Column Span: 2
   - Size: xl
   - Shows: "$XXX.XX USD" for current billing period

2. **Forecasted Month End** (MetricCard) - if available
   - ID: `aws-forecast`
   - Priority: medium
   - Column Span: 2
   - Size: xl
   - Shows: Projected end-of-month cost

3. **Cost Breakdown by Service** (DataTable)
   - ID: `aws-cost-breakdown`
   - Priority: medium
   - Column Span: 4 (full width)
   - Columns: Service, Cost (USD), % of Total
   - Shows: All AWS services with costs

**Copilot Action**: `fetchCostsOverview`

---

### **DEPLOYMENTS**
**Trigger**: "deployments", "deployment history", "show deployments", "recent deployments", "deployment status", "releases"

**Handler**: `handleFetchDeployments()` → `showDeployments` action

**Widgets Displayed**:
1. **Deployment Count** (MetricCard)
   - ID: `deployment-count`
   - Priority: high
   - Size: xl
   - Shows: Total count with breakdown (GitHub Actions vs Manual)
   - Description includes deployment method breakdown

2. **Deployments Table** (DataTable)
   - ID: `deployments-table`
   - Columns: Tag, Name, Trigger, Date & Time, Summary, Commits
   - Shows: Full deployment history from deployments.json

**Copilot Action**: `showDeployments`

---

### **AI USAGE** (Claude & Anthropic)
**Trigger**: "ai usage", "claude usage", "api usage", "token usage", "claude credits", "anthropic usage", "api credits", "how much claude have i used"

**Handler**: Direct action call → `showClaudeUsage` action

**Widgets Displayed**:
1. **Claude Usage Widget** (ClaudeUsageCard)
   - ID: `claude-usage-widget`
   - Priority: high
   - Shows:
     - Plan info (name, tier, cost, billing date)
     - Current session usage (5-hour window)
     - Weekly limits (all models, Sonnet-only)
     - Today's usage
     - Month-to-date usage
     - Model breakdown by tokens & percentage
     - API credits (balance, burn rate, runway)

2. **Anthropic Usage Widget** (AnthropicUsageCard)
   - ID: `anthropic-usage-widget`
   - Priority: high
   - Shows:
     - Today's tokens (input/output)
     - Month-to-date tokens
     - Model breakdown (Opus, Sonnet, Haiku)
     - Admin API status

**Copilot Action**: `showClaudeUsage`

---

## 📊 WIDGET REFERENCE

### Dynamic Widget Types

#### **MetricCard** (`metric_card`)
**Properties**:
- `title`: string
- `value`: string | number
- `unit`: string
- `size`: 'compact' | 'default' | 'large' | 'xl'
- `change`: number (percentage)
- `status`: 'healthy' | 'warning' | 'critical' | 'unknown'
- `description`: string
- `interpretation`: string (AI insight)
- `actionableInsights`: string[]
- `metadata`: object

**Example IDs**:
- `system-metric-cpu_total`
- `running-containers-count`
- `aws-total-cost`
- `deployment-count`

---

#### **CardGroup** (`card_group`)
**Properties**:
- `title`: string
- `subtitle`: string
- `metrics`: array of metric objects
- `status`: 'healthy' | 'warning' | 'critical' | 'unknown'
- `insight`: string
- `description`: string

**Example IDs**:
- `automation-gmail-filter`
- `automation-image-generator`

---

#### **DataTable** (`data_table`)
**Properties**:
- `title`: string
- `columns`: array of column definitions
- `rows`: array of row data
- `sortBy`: string (column key)
- `sortDirection`: 'asc' | 'desc'

**Example IDs**:
- `containers-list-table`
- `aws-cost-breakdown`
- `deployments-table`

---

#### **ECRSummaryCard** (`ecr_summary`)
**Properties**:
- `repositoryCount`: number
- `repositories`: array of repo objects
- `observations`: string[]
- `suggestion`: string

**Example IDs**:
- `ecr-summary`

---

#### **ClaudeUsageCard** (`claude_usage`)
**Properties**:
- `claudeCode`: object (usage data)
- `apiCredits`: object (credits data)
- `showApiSection`: boolean

**Example IDs**:
- `claude-usage-widget`
- `landing-claude-usage`

---

#### **AnthropicUsageCard** (`anthropic_usage`)
**Properties**:
- `tokenUsage`: object (token data from Admin API)

**Example IDs**:
- `anthropic-usage-widget`

---

## 🔀 ROUTING RULES

### Priority-Based Display
Widgets are sorted by priority before rendering:
1. **critical** (0) - Must-see alerts, failures
2. **high** (1) - Important metrics, featured widgets
3. **medium** (2) - Standard metrics
4. **low** (3) - Informational, nice-to-have

### Layout Rules
- **Column Span**: Widgets can span 1-4 columns
  - Default: 1 column
  - Featured metrics: 2 columns
  - Full-width tables: 4 columns
- **Responsive Grid**: Adjusts based on screen size
- **Group Sections**: Widgets are grouped by type for better layout

---

## 💬 UTTERANCE PATTERNS

### **OVERVIEW / HOME**
**Exact Matches**:
- "overview"
- "home"
- "dashboard"
- "main"
- "back"
- "clear"
- "reset"
- "start"

**Semantic Matches**:
- "show me the main dashboard"
- "go to home screen"
- "take me back"
- "show overview"
- "return to main page"

**Action**: Navigate to landing page view (no widgets)

---

### **SYSTEM METRICS / PERFORMANCE**
**Direct Triggers**:
- "system metrics"
- "performance"
- "infrastructure"
- "system health"
- "show all metrics"
- "server status"
- "server health"

**Technical Variants**:
- "cpu memory network"
- "show me cpu and memory"
- "disk usage and load"
- "system performance metrics"
- "infrastructure health"

**Question Forms**:
- "how is my system performing?"
- "what are my system metrics?"
- "is my server healthy?"
- "show me infrastructure status"
- "what's the system load?"

**Casual Language**:
- "how's everything running?"
- "is my server okay?"
- "system doing alright?"
- "check system health"

**Action**: Call `fetchSystemMetrics` action

---

### **CONTAINERS / APPLICATIONS**
**Direct Triggers**:
- "containers"
- "applications"
- "apps"
- "docker"
- "running containers"
- "container status"

**Action Variants**:
- "show containers"
- "list containers"
- "show running apps"
- "view containers"
- "container metrics"

**Question Forms**:
- "what containers are running?"
- "which apps are active?"
- "how many containers?"
- "show me all containers"
- "what's running?"

**Technical**:
- "docker ps"
- "container list"
- "show container stats"
- "ecr repositories"
- "docker images"

**Memory/CPU Specific**:
- "container memory usage"
- "container cpu"
- "show n8n cpu" → `fetchContainerMetrics`
- "redis memory" → `fetchContainerMemory`

**Action**: Call `fetchContainersList` action

---

### **AUTOMATIONS / WORKFLOWS**
**Direct Triggers**:
- "automations"
- "workflows"
- "n8n"
- "langflow"
- "automation status"
- "workflow health"

**Action Variants**:
- "show automations"
- "show workflows"
- "list workflows"
- "automation overview"
- "workflow status"

**Question Forms**:
- "are my workflows running?"
- "how are automations doing?"
- "are workflows healthy?"
- "any automation failures?"
- "workflow execution status"

**Specific Workflows**:
- "gmail filter" → `fetchGmailFilterMetrics`
- "image generator" → `fetchImageGeneratorMetrics`

**Status Questions**:
- "how many automations?" → `getAutomationCount`
- "time saved by automation?" → `getTimeSavedByAutomations`
- "broken workflows?" → `checkBrokenAutomations`
- "next scheduled run?" → `getNextScheduledAutomation`

**Action**: Call `fetchAutomations` action

---

### **COSTS / SPENDING**
**Direct Triggers**:
- "costs"
- "spending"
- "aws costs"
- "cloud costs"
- "billing"
- "expenses"

**Question Forms**:
- "how much am I spending?"
- "what's my aws bill?"
- "monthly cost"
- "cloud spending"
- "infrastructure costs"
- "cost breakdown"

**Variants**:
- "show costs"
- "show spending"
- "aws bill"
- "cloud bill"
- "cost by service"
- "what am I paying for?"

**Forecast**:
- "projected costs"
- "month end forecast"
- "estimated bill"

**Action**: Call `fetchCostsOverview` action

---

### **DEPLOYMENTS**
**Direct Triggers**:
- "deployments"
- "deployment history"
- "releases"
- "deployment status"

**Action Variants**:
- "show deployments"
- "list deployments"
- "recent deployments"
- "deployment log"

**Question Forms**:
- "how many deployments?"
- "when was last deployment?"
- "show deployment history"
- "recent releases"

**Variants**:
- "github deployments"
- "manual deployments"
- "deployment breakdown"

**Action**: Call `showDeployments` action

---

### **AI USAGE / CLAUDE**
**Direct Triggers**:
- "claude usage"
- "ai usage"
- "api usage"
- "token usage"
- "claude credits"
- "anthropic usage"

**Question Forms**:
- "how much claude have I used?"
- "what's my token usage?"
- "api credits remaining"
- "claude session usage"

**Variants**:
- "show claude stats"
- "api credits balance"
- "claude code usage"
- "anthropic api usage"
- "token breakdown"
- "model usage"

**Specific**:
- "5-hour window usage"
- "weekly limits"
- "daily usage"
- "monthly usage"
- "burn rate"
- "runway"

**Action**: Call `showClaudeUsage` action

---

### **SPECIFIC METRIC QUERIES**
These trigger individual widget actions:

**System Uptime**:
- "system uptime"
- "how long has system been running?"
- "uptime"
→ Action: `fetchSystemUptime`

**Container Count**:
- "how many containers running?"
- "running container count"
→ Action: `fetchRunningContainers`

**Specific Container Metrics**:
- "n8n cpu", "redis memory", "postgres cpu"
→ Action: `fetchContainerMetrics` or `fetchContainerMemory`

**Quick Status**:
- "quick status"
- "everything okay?"
- "overall status"
→ Action: `getQuickStatusSummary`

**Natural Language (Agent)**:
- Complex queries about metrics
→ Action: `queryDatadogAgent`

---

## 🎯 ROUTING LOGIC FOR LLM

### Decision Tree

```
User Query
│
├─ Contains: "home", "overview", "back", "clear"?
│  → Navigate to LANDING PAGE
│
├─ Contains: "system", "performance", "metrics", "cpu", "memory", "disk"?
│  ├─ Specific metric name (e.g., "cpu")?
│  │  → Call specific metric action
│  └─ General request?
│     → Call fetchSystemMetrics
│
├─ Contains: "container", "docker", "app", "running"?
│  ├─ Specific container + metric (e.g., "n8n cpu")?
│  │  → Call fetchContainerMetrics
│  └─ General containers?
│     → Call fetchContainersList
│
├─ Contains: "automation", "workflow", "n8n"?
│  ├─ Specific workflow name?
│  │  → Call workflow-specific action
│  └─ General automation?
│     → Call fetchAutomations
│
├─ Contains: "cost", "spending", "bill", "aws cost"?
│  → Call fetchCostsOverview
│
├─ Contains: "deployment", "release"?
│  → Call showDeployments
│
├─ Contains: "claude", "ai usage", "token", "api credit"?
│  → Call showClaudeUsage
│
└─ Complex/Natural Language?
   → Call queryDatadogAgent (LangFlow agent)
```

### Keyword Matching Priority

**Tier 1 - Exact Match** (highest priority):
- Navigation: "home", "back", "overview"
- View names: "costs", "deployments", "containers"

**Tier 2 - Strong Indicators**:
- Domain terms: "workflow", "automation", "docker", "aws"
- Metric names: "cpu", "memory", "disk", "uptime"

**Tier 3 - Context Clues**:
- Action words: "show", "list", "view", "check"
- Question patterns: "how much", "how many", "what is"

**Tier 4 - Fallback**:
- Complex queries → route to `queryDatadogAgent`
- Ambiguous → ask for clarification

---

## 📝 EXAMPLE MAPPINGS

| User Says | Detected Intent | Action Called | Widgets Shown |
|-----------|----------------|---------------|---------------|
| "show me system metrics" | System Performance | `fetchSystemMetrics` | MetricCard × 10 |
| "list all containers" | Container Overview | `fetchContainersList` | ECR + Table + Count |
| "automation status" | Workflow Health | `fetchAutomations` | CardGroup × 2 |
| "aws costs" | Cloud Spending | `fetchCostsOverview` | Cost cards + Table |
| "recent deployments" | Deployment History | `showDeployments` | Count + Table |
| "claude usage" | AI Usage Stats | `showClaudeUsage` | Claude + Anthropic cards |
| "how much memory is n8n using?" | Specific Metric | `fetchContainerMemory` | MetricCard (n8n memory) |
| "are workflows failing?" | Status Check | `checkBrokenAutomations` | Text response or metrics |
| "go back" | Navigation | Navigate to landing | Landing page widgets |

---

## 🔧 IMPLEMENTATION NOTES

### For LLM Routing Decision

When processing user input:

1. **Normalize Input**: Convert to lowercase, remove punctuation
2. **Extract Keywords**: Identify domain entities (containers, costs, etc.)
3. **Match Intent**: Use keyword priority tiers to determine view
4. **Select Action**: Map to appropriate Copilot action
5. **Render Widgets**: Call action, which calls `renderDashboard` with components

### Response Pattern

```javascript
// Example LLM routing logic
if (query.includes("container") || query.includes("docker")) {
  action = "fetchContainersList";
} else if (query.includes("cost") || query.includes("spending")) {
  action = "fetchCostsOverview";
}
// ... etc
```

### Widget Construction

All actions follow this pattern:
1. Fetch data from MCP client or API
2. Create A2UIComponent objects with:
   - `id`: unique identifier
   - `component`: widget type
   - `source`: data source identifier
   - `priority`: display priority
   - `timestamp`: ISO timestamp
   - `props`: widget-specific properties
3. Call `renderDashboard` action with component array
4. App switches to 'home' view and displays widgets

---

## 📚 ADDITIONAL RESOURCES

- **Component Registry**: `src/components/DashboardCanvas.tsx:65-75`
- **Type Definitions**: `src/types/a2ui.ts`
- **Copilot Actions**: `src/App.tsx` (search for `useCopilotAction`)
- **MCP Client**: `src/services/mcp-client.ts`
- **Landing Page**: `src/components/LandingPage.tsx`

---

**Last Updated**: 2026-01-24
**Version**: 1.0
