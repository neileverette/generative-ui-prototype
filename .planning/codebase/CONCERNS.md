# Technical Concerns & Debt

## Critical Issues

### 1. No Automated Testing
**Risk Level:** HIGH

**Description:**
The codebase has zero automated tests. All testing is manual, making regression detection difficult.

**Impact:**
- Risk of breaking changes going undetected
- No confidence in refactoring
- CI/CD lacks quality gates

**Recommendation:**
Add Vitest for unit/integration tests. Priority areas:
- Type utility functions (`sortByPriority`, `getStatusFromThresholds`)
- API response parsing
- MCP tool execution

### 2. No Error Boundary Recovery
**Risk Level:** HIGH

**Description:**
While `ErrorBoundary.tsx` exists, component-level errors crash the entire dashboard.

**Impact:**
- Single component error takes down UI
- Poor user experience during partial failures
- No graceful degradation

**Recommendation:**
Wrap individual A2UI components in error boundaries:
```typescript
<ErrorBoundary fallback={<ComponentErrorCard />}>
  <MetricCard {...props} />
</ErrorBoundary>
```

## High Priority Issues

### 3. Single-File Server Module
**Risk Level:** MEDIUM-HIGH

**Description:**
`server/index.ts` contains all API routes (~900+ lines). This monolithic structure makes maintenance difficult.

**Impact:**
- Hard to navigate and modify
- Merge conflicts likely
- Testing individual routes is difficult

**Recommendation:**
Split into route modules:
```
server/
├── routes/
│   ├── copilot.ts
│   ├── mcp.ts
│   ├── metrics.ts
│   ├── costs.ts
│   └── ecr.ts
├── services/
│   ├── datadog.ts
│   └── langflow.ts
└── index.ts (composition)
```

### 4. Hardcoded AWS Account ID
**Risk Level:** MEDIUM-HIGH

**Description:**
ECR registry URL and AWS account ID hardcoded in `deploy.yml`:
```yaml
docker pull 070322435379.dkr.ecr.us-east-1.amazonaws.com/generative-ui:latest
```

**Impact:**
- Prevents reuse in other AWS accounts
- Exposes account ID in repository

**Recommendation:**
Use GitHub secrets for ECR registry:
```yaml
docker pull ${{ secrets.ECR_REGISTRY }}/generative-ui:latest
```

### 5. Missing Environment Validation
**Risk Level:** MEDIUM

**Description:**
Server starts without validating required environment variables.

**Impact:**
- Runtime errors when API keys missing
- Cryptic error messages
- Delayed failure detection

**Recommendation:**
Add startup validation:
```typescript
const required = ['OPENAI_API_KEY', 'DATADOG_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
```

## Medium Priority Issues

### 6. No Authentication/Authorization
**Risk Level:** MEDIUM

**Description:**
API endpoints have no authentication. Assumes single-user deployment.

**Impact:**
- Anyone with URL can access data
- No audit trail
- Not suitable for multi-tenant use

**Recommendation:**
Add at minimum:
- API key authentication for endpoints
- Rate limiting
- Request logging

### 7. Compiled JavaScript in Repo
**Risk Level:** LOW-MEDIUM

**Description:**
Compiled `.js` files committed alongside `.ts` sources in `server/`:
- `mcp-registry.js`
- `mcp-server.js`
- `metrics-config.js`

**Impact:**
- Merge conflicts between .ts and .js
- Confusion about source of truth
- Potential for .js/.ts drift

**Recommendation:**
Add to `.gitignore`:
```
server/*.js
server/*.d.ts
```
Build during deployment instead.

### 8. Large App.tsx File
**Risk Level:** MEDIUM

**Description:**
`src/App.tsx` is ~3000+ lines containing all CopilotKit actions.

**Impact:**
- Hard to navigate
- Slow IDE performance
- Difficult to test individual actions

**Recommendation:**
Extract actions into separate files:
```
src/actions/
├── systemMetrics.ts
├── containerMetrics.ts
├── deployments.ts
└── costs.ts
```

### 9. No TypeScript Strict Mode
**Risk Level:** LOW-MEDIUM

**Description:**
`tsconfig.json` uses `"strict": true` but some patterns bypass type safety:
```typescript
client: null as any,
transport: null as any,
```

**Impact:**
- Potential runtime type errors
- Reduced IDE assistance

**Recommendation:**
Properly type nullable connections:
```typescript
client: Client | null;
transport: StdioClientTransport | null;
```

## Low Priority Issues

### 10. CSS Override Brittleness
**Risk Level:** LOW

**Description:**
`index.css` uses aggressive CSS selectors to override CopilotKit styles:
```css
[class*="copilotKitChat"] > div,
[class*="CopilotKit"] > div { ... }
```

**Impact:**
- May break on CopilotKit updates
- Hard to debug style issues

**Recommendation:**
Use CopilotKit's official theming API if available, or document override rationale.

### 11. No Rate Limiting
**Risk Level:** LOW

**Description:**
No rate limiting on API endpoints or external service calls.

**Impact:**
- DoS vulnerability
- Could hit Datadog/AWS rate limits

**Recommendation:**
Add express-rate-limit for public endpoints.

### 12. Console Logging in Production
**Risk Level:** LOW

**Description:**
Extensive `console.log` statements in production code:
```typescript
console.log('[MCP Client] getSystemMetrics via MCP');
```

**Impact:**
- Verbose production logs
- Potential info disclosure

**Recommendation:**
Use a proper logger with log levels:
```typescript
import { logger } from './utils/logger';
logger.debug('MCP Client: getSystemMetrics');
```

## Technical Debt Summary

| Category | Count | Risk Level |
|----------|-------|------------|
| Testing | 1 | Critical |
| Error Handling | 1 | High |
| Code Organization | 2 | Medium-High |
| Security | 2 | Medium |
| Configuration | 2 | Medium |
| TypeScript | 1 | Low-Medium |
| Styling | 1 | Low |
| Logging | 1 | Low |

## Recommended Priority Order

1. Add basic test infrastructure (Vitest)
2. Add environment validation
3. Move hardcoded AWS values to secrets
4. Split server into route modules
5. Add component-level error boundaries
6. Remove compiled JS from git
7. Extract CopilotKit actions from App.tsx
8. Add structured logging
