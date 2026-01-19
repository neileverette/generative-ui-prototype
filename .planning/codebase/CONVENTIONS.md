# Code Conventions

## File Naming

### Components
- **PascalCase** for React components: `MetricCard.tsx`, `DashboardCanvas.tsx`
- **Suffix with `.tsx`** for JSX components
- Component file name matches exported component name

### Services/Utilities
- **kebab-case** for service files: `mcp-client.ts`, `mcp-registry.ts`
- **Suffix with `.ts`** for pure TypeScript

### Types
- **kebab-case** for type files: `a2ui.ts`, `costs.ts`
- Single file per domain/feature

### Configuration
- **kebab-case with suffix**: `metrics.config.ts`, `mcp-servers.config.json`

## TypeScript Conventions

### Type Definitions
```typescript
// Interfaces for object shapes with methods
export interface A2UIComponentBase {
  id: string;
  component: ComponentType;
  source: string;
  priority: Priority;
  timestamp: string;
}

// Type aliases for unions
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type MetricStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
```

### Explicit Return Types
Functions have explicit return types for API contracts:
```typescript
async function fetchAWSCosts(): Promise<{
  totalCost: number;
  currency: string;
  breakdown: Array<{ name: string; cost: number }>;
}> { ... }
```

### Const Assertions
Configuration objects use `as const`:
```typescript
export const METRIC_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
} as const;
```

### Type Guards
Not heavily used - primarily relies on TypeScript inference.

## React Conventions

### Component Structure
```typescript
// 1. Imports
import { useState } from 'react';
import { SomeType } from '../types';

// 2. Types/Interfaces
interface ComponentProps {
  component: SomeType;
  className?: string;
}

// 3. Helper functions/constants
const STATUS_CONFIG = { ... };

// 4. Component function
export function ComponentName({ component, className }: ComponentProps) {
  // Hooks first
  const [state, setState] = useState();

  // Derived values
  const derivedValue = compute(state);

  // Return JSX
  return ( ... );
}
```

### Props Pattern
- Props interface defined above component
- Destructuring in function signature
- Optional props with `?` suffix

### Hooks Usage
```typescript
// State hooks
const [state, setState] = useState<Type>(initial);

// Refs for mutable values
const ref = useRef<Type>(null);

// Callbacks for stable function references
const handler = useCallback(() => { ... }, [deps]);

// Effects for side effects
useEffect(() => { ... }, [deps]);
```

### CopilotKit Patterns
```typescript
// Expose state to AI
useCopilotReadable({
  description: "Current dashboard state",
  value: state,
});

// Define AI actions
useCopilotAction({
  name: "actionName",
  description: "Action description",
  parameters: [...],
  handler: async (params) => { ... },
});
```

## CSS/Styling Conventions

### Tailwind Classes
```jsx
// Grouped by category: layout, spacing, colors, effects
<div className="flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm transition-all duration-300">
```

### Custom CSS Classes
```css
/* BEM-inspired for complex components */
.blur-background-container { ... }
.blur-circle { ... }
.blur-circle-ibm-blue { ... }

/* Utility classes for common patterns */
.card-hover { ... }
.gradient-text { ... }
.glass { ... }
```

### Color System
```javascript
// tailwind.config.js
colors: {
  surface: { 0: '#ffffff', 1: '#f8fafc', ... },
  accent: { primary: '#6366f1', success: '#6366f1', ... },
  text: { primary: '#0f172a', secondary: '#475569', ... },
}
```

## API/Backend Conventions

### Express Route Organization
```typescript
// Group by feature with section comments
// =============================================================================
// AWS COST EXPLORER INTEGRATION
// =============================================================================

app.get('/api/costs/aws', async (req, res) => { ... });
app.get('/api/costs/aws/forecast', async (req, res) => { ... });
```

### Response Format
```typescript
// Success response
res.json({
  data: result,
  queriedAt: new Date().toISOString(),
  source: 'datadog-agent-fast',
});

// Error response
res.status(500).json({
  error: error instanceof Error ? error.message : 'Unknown error',
  source: 'mcp-registry',
});
```

### Async/Await Pattern
```typescript
// Try-catch wrapper for async handlers
app.get('/api/endpoint', async (req, res) => {
  try {
    const result = await someAsyncOperation();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

## Documentation Conventions

### JSDoc Comments
```typescript
/**
 * MCP Server Registry - manages multiple MCP server connections
 */
export class MCPServerRegistry { ... }

/**
 * Parse structured data from LangFlow agent response
 * Extracts interpretation and actionable insights sections
 */
function parseAgentResponse(message: string) { ... }
```

### Section Headers
```typescript
// =============================================================================
// SECTION NAME
// =============================================================================
```

### TODO Comments
```typescript
// TODO: Add get_interpretations tool to MCP server (requires LangFlow)
```

## Import Ordering

1. External packages (react, libraries)
2. Internal services/utilities
3. Types
4. Components
5. Assets/styles

```typescript
import { useState, useCallback } from 'react';
import { CopilotKit } from '@copilotkit/react-core';

import { mcpClient } from './services/mcp-client';
import { A2UIComponent, DashboardState } from './types/a2ui';
import { DashboardCanvas } from './components/DashboardCanvas';
import deploymentsData from './data/deployments.json';
```
