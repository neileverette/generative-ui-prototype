# Widget Routing System - Quick Reference

## Overview

The Console app now uses an **utterance-based routing system** where chat input drives the display, order, and composition of widgets shown on the page.

## How It Works

1. **Initial Load**: When the app loads, it automatically invokes the invisible utterance `"overview"` which displays the landing page with all overview widgets.

2. **User Interaction**: When users interact via:
   - Chat messages
   - Navigation card clicks
   - Voice commands
   - Quick action buttons

   The system routes the utterance to the appropriate widget configuration.

3. **Dynamic Loading**: Only the widgets mapped to the matched route are loaded and displayed.

## Key Files

### `/src/config/widget-routing.json`
The central routing configuration that maps utterances to widgets. Contains:
- **Routes**: Named configurations (overview, systemMetrics, containers, etc.)
- **Keywords**: Words that trigger the route
- **Patterns**: Phrases that match the route
- **Widgets**: List of widget IDs to display
- **StaticWidgets**: Landing page widgets (for overview route only)

### `/src/services/utterance-router.ts`
The routing engine that:
- Takes an utterance (user input)
- Matches it against route configurations
- Returns a `RouteMatch` with widgets to display
- Uses confidence scoring (0-100) for best match

### `/src/hooks/useWidgetLoader.ts`
React hook that manages widget loading lifecycle:
- Auto-loads "overview" on mount (configurable)
- Processes utterances through the router
- Triggers callbacks for route matches and failures
- Manages loading states

## Usage Example

### When user clicks "System Metrics" card:

```
handleNavigate('system-metrics')
  ↓
processUtterance('system metrics')
  ↓
routeUtterance('system metrics') // Finds systemMetrics route
  ↓
onRouteMatch({
  routeId: 'systemMetrics',
  widgets: ['system-metric-cpu_total', 'system-metric-memory', ...],
  confidence: 85,
  matchType: 'keyword'
})
  ↓
Widgets load dynamically
```

## Current Implementation Status

### ✅ Phase 1: Loading State (COMPLETE)
- Utterance router service created
- Widget loader hook implemented
- Integration with App.tsx
- Auto-load "overview" on initial page load
- Navigation cards route through utterance system
- Console logs for debugging

### ✅ Phase 2: Widget Loading (COMPLETE)
- Widgets now actually load based on route matches
- Previous widgets cleared before loading new ones
- Existing handler functions called automatically
- Loading state displayed during data fetch
- Each route (systemMetrics, containers, automations, costs, deployments, aiUsage) working

### 🚧 Next Steps
1. Handle widget lifecycle and state preservation
2. Add smooth transitions between widget sets
3. Implement shortcut group UI
4. Connect chat input directly to routing system (currently chat goes to CopilotKit)

## Testing the Current Implementation

1. Open the app - should see landing page automatically (invisible "overview" utterance)
2. Click on a navigation card (e.g., "System Metrics")
3. Check browser console for routing logs

## Debug Mode

Check browser console for detailed routing logs:
- `[WidgetLoader]` - Loading lifecycle events
- `[handleNavigate]` - Navigation events
- Route match details with confidence scores
