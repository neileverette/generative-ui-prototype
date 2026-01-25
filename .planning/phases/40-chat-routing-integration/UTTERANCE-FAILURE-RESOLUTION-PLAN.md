# Utterance Failure Resolution Plan

**Date:** 2026-01-25
**Test Results:** 15/30 passed (50%) - Timed out before completing all 45 tests
**Current Confidence Threshold:** 40%

---

## Executive Summary

Based on test results and routing configuration analysis, failures fall into three categories:

1. **System Metrics (0/7)** - All failing, likely MCP client timeout or widget rendering issue
2. **Containers (0/5)** - Regression, deduplication or state management issue
3. **Automations (0/4)** - All failing, likely n8n MCP client issue or missing data
4. **Partial Failures** - AWS Costs (3/6), Deployments (2/4), AI Usage (unknown)

---

## System Metrics - Category Failure (0/7 tests passing)

### Route Configuration
- **Route ID:** `systemMetrics`
- **Action:** `fetchSystemMetrics`
- **Keywords:** system, performance, metrics, infrastructure, health, server, cpu, memory, disk, load, network
- **Patterns:** "system metrics", "show all metrics", "system health", "server status", etc.

### Failed Utterances Analysis

#### 1. ❌ "system metrics"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "system metrics" (line 69)
**Confidence Score:** Should be 40 + 15 = 55 (pattern match)
**Why It Fails:** Widget detection timeout or MCP fetch failure

**Resolution Steps:**
1. **Verify Routing** (5 min)
   ```bash
   # Test in browser console
   console.log(routeUtterance('system metrics'))
   # Should return: { routeId: 'systemMetrics', confidence: 55, action: 'fetchSystemMetrics' }
   ```

2. **Check MCP Client** (10 min)
   - Open browser dev tools
   - Type "system metrics" in chat
   - Check Network tab for `/api/mcp/` calls
   - Look for errors in Console
   - Expected: GET request to MCP server for system metrics
   - Timeout: Default 120s may be too long

3. **Verify Widget Rendering** (10 min)
   - After typing "system metrics", inspect DOM
   - Look for elements with class `.bg-white.rounded-lg.border`
   - Check if text "CPU", "Memory", "Disk" appears
   - If widgets render but test fails, update test detection pattern

4. **Fix Options:**
   - **Option A:** MCP timeout → Reduce timeout in `mcpClient.getOverviewFast()` call
   - **Option B:** Widgets not rendering → Check `handleFetchSystemInfrastructure` logs
   - **Option C:** Test detection wrong → Update `checkForWidgets()` to wait longer or check different selectors

**Files to Check:**
- `src/App.tsx:1759-1890` - `handleFetchSystemInfrastructure()`
- `src/services/mcp-client.ts` - MCP client timeout settings
- `tests/utterance-routing.spec.ts:145` - Widget detection logic

---

#### 2. ❌ "show metrics"
**Expected Match:** HIGH (pattern match)
**Configured Pattern:** ✅ "show all metrics" (line 70) - partial match
**Confidence Score:** Should be ~40 (keyword "metrics" + pattern partial)
**Why It Fails:** Same as #1 above

**Resolution Steps:**
Same as "system metrics" above, plus:
1. **Add Missing Pattern** (2 min)
   - Edit `src/config/widget-routing.json`
   - Add "show metrics" to patterns array (line 68-79)
   - This will increase confidence score

**Recommended Config Change:**
```json
"patterns": [
  "system metrics",
  "show metrics",  // ADD THIS
  "show all metrics",
  // ... rest
]
```

---

#### 3. ❌ "performance"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "performance" (line 57)
**Confidence Score:** Should be 30 (single keyword)
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
1. **Lower Threshold** (5 min) - NOT RECOMMENDED
   - Change confidence threshold from 40 to 30 in `utterance-router.ts:57`
   - This may cause false positives on other routes

2. **Add Pattern** (2 min) - RECOMMENDED
   - Edit `src/config/widget-routing.json`
   - Add "performance" as a standalone pattern
   ```json
   "patterns": [
     "system metrics",
     "performance",  // ADD THIS
     "show all metrics",
     // ... rest
   ]
   ```
   - New confidence: 40 + 15 = 55 ✅

**Recommended Fix:** Add "performance" to patterns array

---

#### 4. ❌ "cpu"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "cpu" (line 62)
**Confidence Score:** Should be 30 (single keyword)
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
1. **Add Pattern** (2 min) - RECOMMENDED
   ```json
   "patterns": [
     "system metrics",
     "cpu",  // ADD THIS
     "performance",
     // ... rest
   ]
   ```
   - New confidence: 40 + 15 = 55 ✅

2. **Create Specific CPU Route** (15 min) - ALTERNATIVE
   - Add to `specificActions` in config
   - Show only CPU metric card instead of all system metrics
   - Better UX for targeted queries

**Recommended Fix:** Add "cpu" to patterns array

---

#### 5. ❌ "memory"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "memory" (line 63)
**Confidence Score:** Should be 30 (single keyword)
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
Same as "cpu" above - add "memory" to patterns array

**Recommended Fix:**
```json
"patterns": [
  "system metrics",
  "cpu",
  "memory",  // ADD THIS
  "performance",
  // ... rest
]
```

---

#### 6. ❌ "system health"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "system health" (line 71)
**Confidence Score:** Should be 40 + 15 = 55
**Why It Fails:** Same root cause as #1 - MCP timeout or widget rendering

**Resolution Steps:**
Same as "system metrics" #1 above

---

#### 7. ❌ "system status"
**Expected Match:** MEDIUM (partial pattern match)
**Configured Patterns:** "system health", "server status" (lines 71, 72)
**Confidence Score:** ~30-40 (partial matches)
**Why It Fails:** May be below threshold OR same root cause as #1

**Resolution Steps:**
1. **Add Exact Pattern** (2 min)
   ```json
   "patterns": [
     "system metrics",
     "system health",
     "system status",  // ADD THIS
     "server status",
     // ... rest
   ]
   ```

2. **Verify Routing + Widget Rendering** (same as #1)

---

### System Metrics Category - Root Cause Fix

**Most Likely Issue:** MCP client timeout or slow response

**Comprehensive Fix (30 min):**

1. **Add Console Logging** to `handleFetchSystemInfrastructure`:
   ```typescript
   const handleFetchSystemInfrastructure = useCallback(async () => {
     console.log('[TEST] Starting system metrics fetch...');
     const startTime = Date.now();
     try {
       const metricsData = await mcpClient.getOverviewFast(timeWindow);
       console.log('[TEST] MCP fetch took:', Date.now() - startTime, 'ms');
       console.log('[TEST] Metrics data:', metricsData);
       // ... rest of function
     }
   });
   ```

2. **Check MCP Server Health:**
   - Verify `server/datadog-agent/server.ts` is running
   - Test MCP endpoint directly: `curl http://localhost:3001/mcp/overview-fast`
   - Check for 120s timeout in MCP client

3. **Add Fallback/Error Handling:**
   ```typescript
   if (metricsData.error) {
     console.error('[TEST] MCP error:', metricsData.error);
     setDashboardState({
       components: [{
         id: 'system-metric-error',
         component: 'metric_card',
         props: {
           title: 'System Metrics Error',
           value: 'Failed to load',
           status: 'critical'
         }
       }],
       agentMessage: 'Failed to load system metrics: ' + metricsData.error
     });
     setCurrentView('home');
     return;
   }
   ```

4. **Test Widget Detection:**
   - Run test with `--headed` flag
   - Watch for "CPU", "Memory" text appearing
   - Verify test waits long enough (currently 4s)
   - May need to increase to 6s if MCP is slow

**Files to Modify:**
- `src/config/widget-routing.json` - Add missing patterns
- `src/App.tsx` - Add logging and error handling
- `tests/utterance-routing.spec.ts` - Potentially increase wait time

---

## AWS Costs - Partial Failure (3/6 tests passing)

### Passing Tests
✅ "costs" - keyword match (30)
✅ "aws costs" - pattern match (40 + 15 = 55)
✅ "billing" - keyword match (30)

### Failed Utterances

#### 8. ❌ "show costs"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "show costs" (line 256)
**Confidence Score:** Should be 40 + 15 = 55
**Why It Fails:** Widget detection or deduplication issue

**Hypothesis:** Test #7 ("costs") loaded AWS widgets, test #8 ("show costs") triggers deduplication logic and returns early without updating DOM, test fails because no NEW widgets appear.

**Resolution Steps:**
1. **Check Deduplication Logic** (5 min)
   ```typescript
   // In App.tsx:~450-455
   if (currentView === 'home' && isWidgetTypeLoaded('aws-')) {
     console.log('[fetchCostsOverview] AWS costs already loaded, skipping duplicate load');
     return 'AWS costs are already displayed on the dashboard.';
   }
   ```

2. **Verify Dashboard Clearing** (5 min)
   - In test, check if `clearDashboard()` actually removes AWS widgets
   - May need to call `page.reload()` between tests instead of clicking back button

3. **Fix Test Strategy** (10 min)
   ```typescript
   // In tests/utterance-routing.spec.ts
   async function clearDashboard(page: Page) {
     // Force page reload every time instead of back button
     await page.reload();
     await waitForStableDOM(page);
   }
   ```

**Recommended Fix:** Reload page between tests to clear all widget state

---

#### 9. ❌ "spending"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "spending" (line 247)
**Confidence Score:** Should be 30
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
Add to patterns array:
```json
"patterns": [
  "show costs",
  "spending",  // ADD THIS
  "aws costs",
  // ... rest
]
```

**Recommended Fix:** Add "spending" to patterns (2 min)

---

#### 10. ❌ "cost breakdown"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "cost breakdown" (line 259)
**Confidence Score:** Should be 40 + 15 = 55
**Why It Fails:** Deduplication issue (same as #8)

**Resolution Steps:**
Same as "show costs" #8 above

---

## Containers - Category Regression (0/5 tests passing)

**Critical Issue:** These tests PASSED in earlier run (2/5), now 0/5 fail

### Failed Utterances

#### 11. ❌ "containers"
**Expected Match:** HIGH (keyword match)
**Configured Keyword:** ✅ "containers" (line 112)
**Confidence Score:** Should be 30
**Why It Fails:** Below threshold OR widget detection timeout

**Resolution Steps:**
1. **Add to Patterns** (2 min)
   ```json
   "patterns": [
     "containers",  // ADD THIS
     "show containers",
     // ... rest
   ]
   ```

2. **Check Container Fetch** (10 min)
   - Open browser, type "containers"
   - Check Network tab for container API calls
   - Verify widgets render with "Container", "Docker", "Running" text
   - Check console for errors

3. **Test Detection Update** (5 min)
   - Widget detection may be too strict
   - Container widgets use `containers-list-table` ID
   - Test looks for text containing "container" (case-insensitive)
   - May need to check for "containers" with 's'

**Recommended Fix:**
- Add "containers" to patterns
- Verify container data actually loads (check MCP/Datadog API)

---

#### 12. ❌ "show containers"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "show containers" (line 121)
**Confidence Score:** Should be 40 + 15 = 55
**Why It Fails:** Widget detection or data fetch issue

**Resolution Steps:**
Same as #11, this should work if routing works

---

#### 13. ❌ "docker"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "docker" (line 113)
**Confidence Score:** Should be 30
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
```json
"patterns": [
  "show containers",
  "docker",  // ADD THIS
  "list containers",
  // ... rest
]
```

**Recommended Fix:** Add "docker" to patterns (2 min)

---

#### 14. ❌ "running containers"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "running containers" (line 123)
**Confidence Score:** Should be 40 + 15 = 55
**Why It Fails:** Widget detection or data fetch issue

**Resolution Steps:**
Same as #11, this should work if routing works

---

#### 15. ❌ "ecr"
**Expected Match:** NONE - Not configured!
**Configured Keywords:** None
**Why It Fails:** No route matches "ecr"

**Root Cause:** ECR is mentioned in test expectations but NOT in routing config

**Resolution Steps:**
1. **Option A: Add ECR Keywords to Containers Route** (5 min)
   ```json
   "keywords": [
     "container",
     "containers",
     "docker",
     "ecr",  // ADD THIS
     "app",
     // ... rest
   ],
   "patterns": [
     "show containers",
     "ecr",  // ADD THIS
     "ecr repositories",  // ADD THIS
     // ... rest
   ]
   ```

2. **Option B: Create Separate ECR Route** (20 min)
   - Add new route in `widget-routing.json`
   - Create `fetchECRRepositories` action
   - Show ECR summary widget only

**Recommended Fix:** Option A - Add ECR to containers route (simpler)

---

## Automations - Category Failure (0/4 tests passing)

### Failed Utterances

#### 16. ❌ "automations"
**Expected Match:** HIGH (keyword match)
**Configured Keyword:** ✅ "automations" (line 177)
**Confidence Score:** Should be 30
**Why It Fails:** Below threshold OR n8n MCP client failure

**Resolution Steps:**
1. **Add to Patterns** (2 min)
   ```json
   "patterns": [
     "automations",  // ADD THIS
     "show automations",
     // ... rest
   ]
   ```

2. **Check n8n MCP Client** (15 min)
   - Verify n8n MCP server is running
   - Test endpoint: `curl http://localhost:3002/mcp/workflows` (or appropriate endpoint)
   - Check `src/services/mcp-client.ts` for n8n calls
   - Look for timeout or connection errors

3. **Verify Widget Rendering** (10 min)
   - Type "automations" in browser
   - Check if widgets render with "Gmail", "Image", "Workflow" text
   - Inspect DOM for card groups
   - Check console for errors

**Recommended Fix:** Add "automations" to patterns + verify n8n MCP works

---

#### 17. ❌ "show automations"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "show automations" (line 184)
**Confidence Score:** Should be 40 + 15 = 55
**Why It Fails:** n8n MCP client failure or widget detection

**Resolution Steps:**
Same as #16 above

---

#### 18. ❌ "workflows"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "workflows" (line 179)
**Confidence Score:** Should be 30
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
```json
"patterns": [
  "show automations",
  "workflows",  // ADD THIS
  "automation status",
  // ... rest
]
```

**Recommended Fix:** Add "workflows" to patterns (2 min)

---

#### 19. ❌ "n8n"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "n8n" (line 180)
**Confidence Score:** Should be 30
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
```json
"patterns": [
  "show automations",
  "n8n",  // ADD THIS
  "automation status",
  // ... rest
]
```

**Recommended Fix:** Add "n8n" to patterns (2 min)

---

## Deployments - Partial Failure (2/4 tests passing)

### Passing Tests
✅ "deployments" - keyword match (30)
✅ "deployment history" - pattern match (40 + 15 = 55)

### Failed Utterances

#### 20. ❌ "show deployments"
**Expected Match:** HIGH (exact pattern match)
**Configured Pattern:** ✅ "show deployments" (line 297)
**Confidence Score:** Should be 40 + 15 = 55
**Why It Fails:** Deduplication issue (same as AWS costs)

**Resolution Steps:**
Same as "show costs" #8 - reload page between tests

---

#### 21. ❌ "releases"
**Expected Match:** MEDIUM (keyword only)
**Configured Keyword:** ✅ "releases" (line 293)
**Confidence Score:** Should be 30
**Why It Fails:** Below 40% threshold!

**Resolution Steps:**
```json
"patterns": [
  "show deployments",
  "releases",  // ADD THIS
  "deployment history",
  // ... rest
]
```

**Recommended Fix:** Add "releases" to patterns (2 min)

---

## AI Usage - Status Unknown

Test timed out before reaching these, but we can prepare fixes:

#### 22-23. "claude usage", "ai usage"
**Expected Match:** HIGH (pattern matches)
**Configured Patterns:** ✅ Both in patterns array
**Likely Status:** Should PASS if reached

**Preventive Fix:** None needed if routing works

---

## Summary of Required Changes

### Configuration Changes (`src/config/widget-routing.json`)

```json
{
  "routes": {
    "systemMetrics": {
      "patterns": [
        "system metrics",
        "show metrics",      // ADD
        "performance",       // ADD
        "cpu",               // ADD
        "memory",            // ADD
        "system status",     // ADD
        "show all metrics",
        "system health",
        // ... existing patterns
      ]
    },
    "containers": {
      "keywords": [
        "container",
        "containers",
        "docker",
        "ecr",              // ADD
        "app",
        // ... existing keywords
      ],
      "patterns": [
        "containers",        // ADD
        "show containers",
        "docker",            // ADD
        "ecr",               // ADD
        "ecr repositories",  // ADD
        "list containers",
        // ... existing patterns
      ]
    },
    "automations": {
      "patterns": [
        "automations",       // ADD
        "show automations",
        "workflows",         // ADD
        "n8n",               // ADD
        "automation status",
        // ... existing patterns
      ]
    },
    "costs": {
      "patterns": [
        "show costs",
        "spending",          // ADD
        "aws costs",
        // ... existing patterns
      ]
    },
    "deployments": {
      "patterns": [
        "show deployments",
        "releases",          // ADD
        "deployment history",
        // ... existing patterns
      ]
    }
  }
}
```

### Test Changes (`tests/utterance-routing.spec.ts`)

1. **Reload page between tests** (not just back button):
   ```typescript
   async function clearDashboard(page: Page) {
     await page.reload();
     await waitForStableDOM(page);
   }
   ```

2. **Increase widget detection wait for system metrics** (MCP slow):
   ```typescript
   if (widgetPrefix === 'system-metric-') {
     await page.waitForTimeout(6000); // Increase from 4000
   }
   ```

### Code Changes (`src/App.tsx`)

1. **Add debug logging to system metrics handler:**
   ```typescript
   const handleFetchSystemInfrastructure = useCallback(async () => {
     console.log('[DEBUG] Fetching system metrics, timeWindow:', timeWindow);
     const start = Date.now();
     const metricsData = await mcpClient.getOverviewFast(timeWindow);
     console.log('[DEBUG] MCP fetch took:', Date.now() - start, 'ms');
     console.log('[DEBUG] Metrics data:', metricsData);
     // ... existing code
   }, [timeWindow]);
   ```

---

## Implementation Priority

### Phase 1: Quick Wins (30 minutes)
1. ✅ Update `widget-routing.json` with all pattern additions above
2. ✅ Change test to reload page instead of back button
3. ✅ Run tests again to verify improvements

**Expected Result:** 35-40/45 tests passing (78-89%)

### Phase 2: Debug Root Causes (1 hour)
1. ✅ Add logging to system metrics handler
2. ✅ Test "system metrics" manually in browser
3. ✅ Check MCP client health and response times
4. ✅ Verify container and automation data loads
5. ✅ Fix any MCP timeout or data fetch issues

**Expected Result:** 42-45/45 tests passing (93-100%)

### Phase 3: Test Optimization (30 minutes)
1. ✅ Reduce test timeout by optimizing wait times
2. ✅ Split test into categories (navigation, widgets, chat) for parallel execution
3. ✅ Add better error messages for debugging

**Expected Result:** Tests complete in <3 minutes, all passing

---

## Confidence Score Reference

```
Keywords only:     30 (below threshold)
Pattern match:     40 + 15 = 55 ✅
Multiple patterns: 40 + 30 = 70 ✅
Question pattern:  50 + 20 = 70 ✅
Multiple matches:  100 (capped)

Threshold: 40
```

---

## Next Steps

1. **Implement Phase 1 changes** (config + test reload)
2. **Run tests** to verify improvement
3. **If still failing**: Implement Phase 2 debug logging
4. **Document final results** in test report

**Estimated Time to 100% Pass Rate:** 2-3 hours
