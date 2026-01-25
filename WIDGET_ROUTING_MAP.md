# Widget Routing Map

## Navigation Card → Utterance → Route Mapping

Each navigation card now sends an utterance that directly matches patterns in `widget-routing.json`.

| Navigation Card | Utterance Sent | Route Matched | Confidence |
|----------------|----------------|---------------|------------|
| **Costs** | `"show costs"` | `costs` | ~90% (pattern match) |
| **System Metrics** | `"system metrics"` | `systemMetrics` | ~90% (pattern match) |
| **Automations** | `"show automations"` | `automations` | ~90% (pattern match) |
| **Applications** | `"show containers"` | `containers` | ~90% (pattern match) |
| **Deployments** | `"show deployments"` | `deployments` | ~90% (pattern match) |
| **AI Usage** | `"claude usage"` | `aiUsage` | ~90% (pattern match) |
| **Back Button** | `"home"` | `overview` | ~85% (keyword match) |

## Route Table Reference

From `/src/config/widget-routing.json`:

### costs
- **Pattern**: "show costs"
- **Widgets**: aws-total-cost, aws-forecast, aws-cost-breakdown

### systemMetrics
- **Pattern**: "system metrics"
- **Widgets**: 10 system metric cards (CPU, memory, disk, etc.)

### automations
- **Pattern**: "show automations"
- **Widgets**: automation-gmail-filter, automation-image-generator

### containers
- **Pattern**: "show containers"
- **Widgets**: running-containers-count, ecr-summary, containers-list-table

### deployments
- **Pattern**: "show deployments"
- **Widgets**: deployment-count, deployments-table

### aiUsage
- **Pattern**: "claude usage"
- **Widgets**: claude-usage-widget, anthropic-usage-widget

## Testing

When you click a navigation card, check the console for:

```
[handleNavigate] Processing utterance: show costs
[WidgetLoader] Processing utterance: show costs
[WidgetLoader] Route matched: {
  routeId: 'costs',
  confidence: 90,
  matchType: 'pattern',
  widgets: ['aws-total-cost', 'aws-forecast', 'aws-cost-breakdown']
}
```

## Implementation

- **LandingPage.tsx**: Navigation cards send exact utterances from route patterns
- **App.tsx handleNavigate**: Passes utterance directly to `processUtterance()`
- **utterance-router.ts**: Matches utterance against route patterns and keywords
- **useWidgetLoader.ts**: Manages routing lifecycle and callbacks
