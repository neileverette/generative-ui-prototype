# Quick Routing Reference Table

## Utterance → Action → Widgets (Quick Lookup)

| Category | User Utterance Examples | Copilot Action | Widget IDs | Count |
|----------|------------------------|----------------|------------|-------|
| **Overview** | "home", "overview", "dashboard", "back", "clear" | Navigate to landing | Landing page (static) | 11 static |
| **System Metrics** | "system metrics", "performance", "cpu memory disk", "infrastructure health" | `fetchSystemMetrics` | `system-metric-*` | 10 metrics |
| **Containers** | "containers", "docker", "running apps", "list containers" | `fetchContainersList` | `running-containers-count`, `ecr-summary`, `containers-list-table`, `app-session-uptime`, `app-memory` | 5 widgets |
| **Automations** | "automations", "workflows", "n8n", "workflow health" | `fetchAutomations` | `automation-gmail-filter`, `automation-image-generator` | 2 card groups |
| **Costs** | "costs", "spending", "aws costs", "billing", "how much am i spending" | `fetchCostsOverview` | `aws-total-cost`, `aws-forecast`, `aws-cost-breakdown` | 3 widgets |
| **Deployments** | "deployments", "releases", "deployment history", "recent deployments" | `showDeployments` | `deployment-count`, `deployments-table` | 2 widgets |
| **AI Usage** | "claude usage", "ai usage", "token usage", "api credits" | `showClaudeUsage` | `claude-usage-widget`, `anthropic-usage-widget` | 2 widgets |

---

## Keyword Priority Matrix

| Keyword | View | Priority | Action |
|---------|------|----------|--------|
| home, back, overview | Landing | HIGHEST | Navigate to landing |
| system, performance, metrics | System Metrics | HIGH | fetchSystemMetrics |
| container, docker, app | Containers | HIGH | fetchContainersList |
| automation, workflow, n8n | Automations | HIGH | fetchAutomations |
| cost, spending, bill | Costs | HIGH | fetchCostsOverview |
| deployment, release | Deployments | HIGH | showDeployments |
| claude, token, api credit | AI Usage | HIGH | showClaudeUsage |
| cpu, memory, disk | System Metrics | MEDIUM | fetchSystemMetrics |
| running, list, show | Context-dependent | MEDIUM | Depends on noun |

---

## Single-Metric Actions (Specific Queries)

| User Query Pattern | Action | Widget ID Pattern |
|-------------------|--------|-------------------|
| "system uptime" | `fetchSystemUptime` | `system-uptime` |
| "how many containers" | `fetchRunningContainers` | `running-containers` |
| "[container] cpu" | `fetchContainerMetrics` | `container-{name}-cpu` |
| "[container] memory" | `fetchContainerMemory` | `container-{name}-memory` |
| "gmail filter metrics" | `fetchGmailFilterMetrics` | `gmail-filter-*` |
| "image generator metrics" | `fetchImageGeneratorMetrics` | `image-gen-*` |
| "quick status" | `getQuickStatusSummary` | Text response |

---

## Widget Type Distribution by View

| View | MetricCard | CardGroup | DataTable | ECRSummary | UsageWidget | Navigation |
|------|-----------|-----------|-----------|------------|-------------|-----------|
| Landing | 2 | 0 | 0 | 0 | 2 | 6 |
| System Metrics | 10 | 0 | 0 | 0 | 0 | 0 |
| Containers | 3 | 0 | 1 | 1 | 0 | 0 |
| Automations | 0 | 2 | 0 | 0 | 0 | 0 |
| Costs | 2 | 0 | 1 | 0 | 0 | 0 |
| Deployments | 1 | 0 | 1 | 0 | 0 | 0 |
| AI Usage | 0 | 0 | 0 | 0 | 2 | 0 |

---

## Common Utterance Patterns

### Question Forms
- "How much [X]?" → Costs or Usage
- "How many [X]?" → Count queries
- "What is [X]?" → Status/Metric queries
- "Are [X] [healthy/running/failing]?" → Health checks
- "Show me [X]" → Display requests

### Action Verbs
- "show", "list", "view", "display" → Fetch and display
- "check", "verify", "monitor" → Status queries
- "go to", "back to", "return" → Navigation

### Technical Terms
- "docker", "container" → Container view
- "workflow", "n8n", "automation" → Automation view
- "aws", "cloud", "infrastructure" → System/Costs view
- "deployment", "release", "github" → Deployment view
- "claude", "anthropic", "api", "token" → AI usage view

---

## Ambiguity Resolution

| Ambiguous Query | Clarification Needed | Suggested Response |
|-----------------|---------------------|-------------------|
| "show metrics" | Which metrics? | "Which metrics would you like to see? System metrics, container metrics, or automation metrics?" |
| "usage" | AI or system? | "Would you like to see AI usage (Claude/Anthropic) or system resource usage (CPU/memory)?" |
| "status" | Which system? | "Which status would you like to check? System health, containers, or workflows?" |
| "performance" | Specific or all? | "Would you like overall system performance or specific container performance?" |

---

## Navigation Flow

```
Landing Page
├─ Costs → fetchCostsOverview → Cost widgets
├─ System Metrics → fetchSystemMetrics → Metric cards
├─ Automations → fetchAutomations → Workflow cards
├─ Applications → fetchContainersList → Container widgets
├─ Deployments → showDeployments → Deployment widgets
└─ AI Usage → showClaudeUsage → Usage widgets
```

---

## Example Routing Decisions

```javascript
// Pseudo-code for LLM routing
function routeQuery(userQuery) {
  const q = userQuery.toLowerCase();

  // Navigation
  if (q.match(/\b(home|back|overview|dashboard)\b/)) {
    return { view: 'landing', action: null };
  }

  // System metrics
  if (q.match(/\b(system|performance|metrics|cpu|memory|disk|infrastructure)\b/)) {
    return { view: 'home', action: 'fetchSystemMetrics' };
  }

  // Containers
  if (q.match(/\b(container|docker|app|running)\b/)) {
    // Check for specific container
    if (q.match(/\b(n8n|redis|postgres|langflow)\b/)) {
      const container = extractContainerName(q);
      if (q.includes('cpu')) return { action: 'fetchContainerMetrics', params: { container } };
      if (q.includes('memory')) return { action: 'fetchContainerMemory', params: { container } };
    }
    return { view: 'home', action: 'fetchContainersList' };
  }

  // Automations
  if (q.match(/\b(automation|workflow|n8n)\b/)) {
    return { view: 'home', action: 'fetchAutomations' };
  }

  // Costs
  if (q.match(/\b(cost|spending|bill|aws cost)\b/)) {
    return { view: 'home', action: 'fetchCostsOverview' };
  }

  // Deployments
  if (q.match(/\b(deployment|release)\b/)) {
    return { view: 'home', action: 'showDeployments' };
  }

  // AI Usage
  if (q.match(/\b(claude|ai usage|token|api credit|anthropic)\b/)) {
    return { view: 'home', action: 'showClaudeUsage' };
  }

  // Fallback to agent
  return { action: 'queryDatadogAgent', params: { query: userQuery } };
}
```

---

## Widget Construction Template

```javascript
// Template for creating A2UIComponent
{
  id: 'unique-widget-id',
  component: 'metric_card' | 'card_group' | 'data_table' | 'ecr_summary' | 'claude_usage' | 'anthropic_usage',
  source: 'data-source-name',
  priority: 'critical' | 'high' | 'medium' | 'low',
  timestamp: new Date().toISOString(),
  columnSpan: 1 | 2 | 3 | 4, // optional
  props: {
    // widget-specific properties
  }
}
```

---

**Quick Reference Version**: 1.0
**Last Updated**: 2026-01-24
**For Full Details**: See `WIDGET_ROUTING_MAP.md`
