# Testing Strategy

## Current State

### Test Coverage
**No automated tests exist in the codebase.**

The project currently has no test files outside of `node_modules/`. Testing is done manually through:
- Local development server
- Production deployment verification
- Visual inspection of UI components
- API endpoint testing via browser/curl

### Existing Test Infrastructure
- No test runner configured (jest, vitest, etc.)
- No testing dependencies in package.json
- No test scripts defined

## Recommended Testing Approach

### 1. Unit Testing (Priority: High)

**Recommended Tool:** Vitest (integrates well with Vite)

**Key Areas to Test:**
```typescript
// Type utilities
src/types/a2ui.ts
- sortByPriority()
- getStatusFromThresholds()

// Configuration builders
src/config/metrics.config.ts
- buildMetricQuery()
- buildCombinedQuery()

// Data parsing
server/index.ts
- parseTimeWindow()
- parseAgentResponse()
- getBillingMonthRange()
```

**Example Test Structure:**
```typescript
// src/types/__tests__/a2ui.test.ts
import { describe, it, expect } from 'vitest';
import { sortByPriority, getStatusFromThresholds } from '../a2ui';

describe('sortByPriority', () => {
  it('sorts critical before high', () => {
    const components = [
      { priority: 'high', timestamp: '2024-01-01' },
      { priority: 'critical', timestamp: '2024-01-01' },
    ];
    const sorted = sortByPriority(components);
    expect(sorted[0].priority).toBe('critical');
  });
});
```

### 2. Component Testing (Priority: Medium)

**Recommended Tool:** Vitest + React Testing Library

**Key Components to Test:**
```
src/components/a2ui/MetricCard.tsx   - Status display, value formatting
src/components/a2ui/DataTable.tsx    - Column rendering, sorting
src/components/a2ui/CardGroup.tsx    - Metric grouping
src/components/DashboardCanvas.tsx   - Component registry, layout
```

**Example Test:**
```typescript
// src/components/a2ui/__tests__/MetricCard.test.tsx
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../MetricCard';

describe('MetricCard', () => {
  it('displays value with unit', () => {
    const component = {
      component: 'metric_card',
      props: { title: 'CPU', value: 45.5, unit: '%', status: 'healthy' }
    };
    render(<MetricCard component={component} />);
    expect(screen.getByText('45.5')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });
});
```

### 3. API Testing (Priority: High)

**Recommended Tool:** Supertest + Vitest

**Key Endpoints to Test:**
```
GET  /api/health               - Health check
GET  /api/mcp/servers          - MCP server status
GET  /api/metrics/overview/fast - Metrics response format
GET  /api/costs/aws            - AWS cost data structure
POST /api/mcp/call             - Tool execution
```

**Example Test:**
```typescript
// server/__tests__/api.test.ts
import request from 'supertest';
import { app } from '../index';

describe('Health Check', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

### 4. Integration Testing (Priority: Low)

**Mock External Services:**
- Datadog API responses
- AWS Cost Explorer responses
- LangFlow agent responses
- MCP server connections

### 5. E2E Testing (Priority: Low)

**Recommended Tool:** Playwright

**Key Flows:**
1. Initial page load and dashboard render
2. Chat interaction and component generation
3. Voice input activation and transcription

## Test Configuration Setup

### package.json additions
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "supertest": "^6.3.0"
  }
}
```

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

## Manual Testing Checklist

### Before Deployment
- [ ] Dashboard loads without errors
- [ ] Chat responds to queries
- [ ] Metric cards display correct values
- [ ] Container list populates
- [ ] Voice input activates (Chrome/Edge)
- [ ] All API endpoints return valid JSON

### After Deployment
- [ ] Production URL accessible
- [ ] No console errors
- [ ] Metrics update correctly
- [ ] LangFlow interpretations load

## Current Testing Gaps

| Area | Risk Level | Impact |
|------|------------|--------|
| Type utility functions | High | Logic errors in sorting/status |
| API response handling | High | UI crashes on malformed data |
| MCP tool execution | Medium | Feature degradation |
| Component rendering | Medium | Visual regressions |
| Voice recognition | Low | Feature-specific |
