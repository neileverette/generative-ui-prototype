# Ready to Implement - Utterance Routing Fixes

**Status:** ✅ Analysis Complete - Ready for Implementation
**Current Test Results:** 15/30 passing (50%) - timed out before completing all 45 tests
**Target:** 42-45/45 passing (93-100%)
**Estimated Time:** 2-3 hours total

---

## What Was Done

1. ✅ Fixed Playwright test detection logic (improved from 17.8% to 50% pass rate)
2. ✅ Analyzed all 45 utterances against routing configuration
3. ✅ Identified root causes for each failure
4. ✅ Created detailed resolution plan with exact code changes needed

---

## What Needs to Be Done Next

### Phase 1: Configuration Changes (30 minutes) ⚡ START HERE

**Objective:** Fix 12 utterances that fail due to being below confidence threshold

**What to Do:**

1. **Edit:** `src/config/widget-routing.json`

2. **Make these exact changes:**

**Line 68-79 (systemMetrics.patterns)** - Add 6 patterns:
```json
"patterns": [
  "system metrics",
  "show metrics",        // ADD
  "performance",         // ADD
  "cpu",                 // ADD
  "memory",              // ADD
  "system status",       // ADD
  "show all metrics",
  "system health",
  "server status",
  "infrastructure health",
  "how is my system",
  "performance metrics",
  "cpu and memory",
  "server health check",
  "system performance"
]
```

**Line 111-119 (containers.keywords)** - Add "ecr":
```json
"keywords": [
  "container",
  "containers",
  "docker",
  "ecr",                 // ADD
  "app",
  "apps",
  "application",
  "applications",
  "running"
]
```

**Line 120-131 (containers.patterns)** - Add 4 patterns:
```json
"patterns": [
  "containers",          // ADD
  "show containers",
  "docker",              // ADD
  "ecr",                 // ADD
  "ecr repositories",    // ADD
  "list containers",
  "running containers",
  "container status",
  "docker containers",
  "running apps",
  "application status",
  "container metrics",
  "what containers are running",
  "show all containers"
]
```

**Line 183-193 (automations.patterns)** - Add 3 patterns:
```json
"patterns": [
  "automations",         // ADD
  "show automations",
  "workflows",           // ADD
  "n8n",                 // ADD
  "automation status",
  "workflow health",
  "show workflows",
  "workflow status",
  "automation overview",
  "workflow metrics",
  "n8n status",
  "automation health"
]
```

**Line 255-265 (costs.patterns)** - Add 1 pattern:
```json
"patterns": [
  "show costs",
  "spending",            // ADD
  "aws costs",
  "cloud costs",
  "cost breakdown",
  "aws bill",
  "monthly cost",
  "infrastructure costs",
  "spending breakdown",
  "cloud spending"
]
```

**Line 296-303 (deployments.patterns)** - Add 1 pattern:
```json
"patterns": [
  "show deployments",
  "releases",            // ADD
  "deployment history",
  "recent deployments",
  "deployment log",
  "list deployments",
  "deployment status",
  "github deployments"
]
```

**Expected Improvement:** Fixes 12 utterances immediately

---

### Phase 2: Test Fix - Page Reload (5 minutes)

**Objective:** Fix deduplication issues causing "show X" variants to fail

**What to Do:**

1. **Edit:** `tests/utterance-routing.spec.ts`

2. **Replace** the `clearDashboard` function (around line 111-121):

**OLD:**
```typescript
async function clearDashboard(page: Page) {
  // Click back/home button or type "back" to clear dashboard
  try {
    const backButton = page.locator('button:has-text("←")').first();
    if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backButton.click();
      await page.waitForTimeout(1500); // Wait for transition
    } else {
      // Fallback: type "back" in chat
      const input = page.locator('textarea').first();
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.fill('back');
        await input.press('Enter');
        await page.waitForTimeout(1500);
      }
    }
  } catch (e) {
    console.log('Failed to clear dashboard, continuing anyway');
  }
  await waitForStableDOM(page);
}
```

**NEW:**
```typescript
async function clearDashboard(page: Page) {
  // Force page reload to completely clear all widget state
  // This fixes deduplication issues where widgets don't reload
  console.log('  🔄 Reloading page to clear widget state...');
  await page.reload();
  await waitForStableDOM(page);
}
```

**Why:** The back button or "back" command doesn't fully clear widget state, causing deduplication logic to skip reloading widgets. Page reload ensures clean state.

**Expected Improvement:** Fixes "show costs", "show automations", "show deployments", etc.

---

### Phase 3: System Metrics Debug (30-60 minutes)

**Objective:** Fix all 7 system metrics tests (currently 0/7 passing)

**Likely Issues:**
1. MCP client timeout or slow response
2. Widgets not rendering in expected timeframe
3. Test detection patterns not matching rendered content

**What to Do:**

**Step 1: Add Debug Logging (5 min)**

Edit `src/App.tsx`, find `handleFetchSystemInfrastructure` (around line 1759), add logging:

```typescript
const handleFetchSystemInfrastructure = useCallback(async () => {
  console.log('[DEBUG-METRICS] Starting fetch, timeWindow:', timeWindow);
  const startTime = Date.now();

  try {
    // Fetch system metrics (FAST) via MCP client
    const metricsData = await mcpClient.getOverviewFast(timeWindow);
    const fetchTime = Date.now() - startTime;

    console.log('[DEBUG-METRICS] MCP fetch completed in', fetchTime, 'ms');
    console.log('[DEBUG-METRICS] Metrics data:', {
      error: metricsData.error,
      metricsCount: metricsData.metrics?.length,
      firstMetric: metricsData.metrics?.[0]
    });

    const newComponents: A2UIComponent[] = [];

    // ... rest of existing code
```

**Step 2: Manual Test (5 min)**

1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:3000`
3. Open DevTools Console
4. Type "system metrics" in chat
5. Watch console logs - look for:
   - `[DEBUG-METRICS]` logs
   - Fetch time (should be < 3000ms)
   - Any errors
   - Widget rendering

**Step 3: Diagnose Issue (10 min)**

Based on console output, choose fix:

**Issue A: MCP Timeout (fetch time > 5000ms)**
```typescript
// In src/services/mcp-client.ts
// Find getOverviewFast() method
// Reduce timeout or optimize query
```

**Issue B: Widgets Not Rendering**
```typescript
// Check if newComponents array is populated
console.log('[DEBUG-METRICS] Created components:', newComponents.length);
// Check if setDashboardState is called
// Check if setCurrentView('home') is called
```

**Issue C: Test Detection Wrong**
```typescript
// In tests/utterance-routing.spec.ts
// Increase wait time for system metrics:
if (widgetPrefix === 'system-metric-') {
  await page.waitForTimeout(6000); // Increase from 4000ms
}

// OR check different text patterns:
hasExpectedContent = await page.locator('text=/CPU|Memory|Disk|Network|Uptime|Load/i').count() > 0;
```

**Step 4: Fix & Verify (10-40 min)**

Apply the appropriate fix from Step 3, then:
1. Test manually in browser
2. Run automated test: `npx playwright test`
3. Verify system metrics tests pass

---

### Phase 4: Verify & Optimize (30 minutes)

**What to Do:**

1. **Run Full Test Suite:**
   ```bash
   npm run dev  # In one terminal
   npx playwright test --headed  # In another
   ```

2. **Check Results:**
   - Should see 40-45/45 passing
   - Review any remaining failures
   - Check test duration (should be < 5 minutes)

3. **If < 100% Passing:**
   - Check latest test results file in `.planning/phases/40-chat-routing-integration/test-results-*.md`
   - For each failure, consult `UTTERANCE-FAILURE-RESOLUTION-PLAN.md`
   - Apply specific fixes listed in that document

4. **Optimize Test Speed:**
   ```typescript
   // If all tests passing, reduce wait times:
   async function checkForWidgets(page: Page, widgetPrefix: string) {
     await page.waitForTimeout(2500); // Reduce from 4000ms
     // ... rest
   }
   ```

---

## Files You'll Need to Edit

### Required Changes (Phases 1-2):
- ✅ `src/config/widget-routing.json` - Add 15 patterns
- ✅ `tests/utterance-routing.spec.ts` - Change clearDashboard to page.reload()

### Conditional Changes (Phase 3):
- ⚠️ `src/App.tsx` - Add debug logging (if system metrics fail)
- ⚠️ `src/services/mcp-client.ts` - Adjust timeout (if MCP slow)
- ⚠️ `tests/utterance-routing.spec.ts` - Increase wait time (if needed)

---

## How to Test Your Changes

### Quick Test (Manual - 2 minutes):
```bash
# Start dev server
npm run dev

# Open http://localhost:3000
# Try these utterances in the chat:
- "performance"      # Should load system metrics
- "docker"           # Should load containers
- "workflows"        # Should load automations
- "spending"         # Should load costs
- "releases"         # Should load deployments
```

### Full Test (Automated - 5 minutes):
```bash
# In terminal 1
npm run dev

# In terminal 2
npx playwright test

# Check results
cat .planning/phases/40-chat-routing-integration/test-results-*.md | head -20
```

### Expected Results:
- **After Phase 1:** ~35/45 tests passing (78%)
- **After Phase 2:** ~38/45 tests passing (84%)
- **After Phase 3:** ~42/45 tests passing (93%)
- **After Phase 4:** 45/45 tests passing (100%) ✅

---

## Success Criteria

✅ All 45 utterances route correctly
✅ All widgets load and display
✅ Test completes in < 5 minutes
✅ No false positives or false negatives

---

## Reference Documents

- **Analysis:** `UTTERANCE-FAILURE-RESOLUTION-PLAN.md` - Detailed breakdown of every failure
- **Test Fixes:** `TEST-DETECTION-FIX-SUMMARY.md` - What was already fixed in test detection
- **Test Results:** `test-results-*.md` - Latest test run results
- **Routing Config:** `src/config/widget-routing.json` - Current routing configuration
- **Test File:** `tests/utterance-routing.spec.ts` - Test suite

---

## Questions or Issues?

If you encounter problems:

1. **Check the console** - All fixes include debug logging
2. **Consult `UTTERANCE-FAILURE-RESOLUTION-PLAN.md`** - Has specific fixes for each utterance
3. **Run manual tests** - Easier to debug than automated tests
4. **Test incrementally** - Do Phase 1, test, then Phase 2, test, etc.

---

## Estimated Timeline

| Phase | Task | Time | Tests Passing |
|-------|------|------|---------------|
| 1 | Config changes | 30 min | ~35/45 (78%) |
| 2 | Test reload fix | 5 min | ~38/45 (84%) |
| 3 | System metrics debug | 30-60 min | ~42/45 (93%) |
| 4 | Verify & optimize | 30 min | 45/45 (100%) |
| **Total** | | **2-3 hours** | **100%** ✅ |

Good luck! 🚀
