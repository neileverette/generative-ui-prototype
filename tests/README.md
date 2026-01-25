# Utterance Routing Automated Tests

Automated Playwright tests to verify all utterances route correctly.

## Prerequisites

1. **Dev server must be running** on http://localhost:3000
   ```bash
   npm run dev
   ```

2. **Playwright installed** (already in package.json)
   ```bash
   npx playwright install chromium
   ```

## Running the Tests

### Run all utterance tests:
```bash
npx playwright test utterance-routing
```

### Run with UI (watch mode):
```bash
npx playwright test utterance-routing --ui
```

### Run with headed browser (see what's happening):
```bash
npx playwright test utterance-routing --headed
```

### Run with debug mode:
```bash
npx playwright test utterance-routing --debug
```

## What the Test Does

1. **Navigates to app** at http://localhost:3000
2. **Tests each utterance** from the predefined list
3. **Verifies behavior:**
   - Routes to widgets → checks for widget elements with expected ID prefixes
   - Falls back to chat → checks for assistant message in chat
   - Returns to landing → checks for landing page elements
4. **Logs results** to `.planning/phases/40-chat-routing-integration/test-results-{timestamp}.md`

## Test Categories

- **Navigation/Home** (8 tests) - back, home, overview, etc.
- **System Metrics** (7 tests) - cpu, memory, performance, etc.
- **AWS Costs** (6 tests) - costs, billing, spending, etc.
- **Containers** (5 tests) - docker, ecr, containers, etc.
- **Automations** (4 tests) - workflows, n8n, automations, etc.
- **Deployments** (4 tests) - releases, deployment history, etc.
- **AI Usage** (4 tests) - claude, tokens, api credits, etc.
- **Conversational** (4 tests) - should fall back to chat
- **Edge Cases** (3 tests) - gibberish, uppercase, extra spaces

**Total: ~45 tests**

## Reading Results

After the test completes, check the generated report:

```
.planning/phases/40-chat-routing-integration/test-results-{timestamp}.md
```

The report includes:
- ✅ **Pass/Fail summary** by category
- 📊 **Pass rate percentage**
- 🔴 **Failed tests summary** (what needs fixing)
- 📝 **Detailed results** for each utterance

## Example Output

```
Navigation (8/8)
✅ "back" - Returned to landing page
✅ "home" - Returned to landing page

System Metrics (6/7)
✅ "system metrics" - Widgets loaded (system-metric-)
❌ "cpu" - No widgets loaded
✅ "memory" - Widgets loaded (system-metric-)

AWS Costs (6/6)
✅ "costs" - Widgets loaded (aws-)
✅ "show costs" - Widgets loaded (aws-)
```

## Troubleshooting

### Test fails immediately
- Make sure dev server is running on http://localhost:3000
- Check that backend is running on http://localhost:4000

### Widgets not detected
- Tests wait 2 seconds for widgets to load
- If your widgets take longer, increase timeout in test file

### Chat responses not detected
- Tests look for `[data-role="assistant"]` elements
- Make sure CopilotKit chat is rendering correctly

### Browser doesn't close
- Use Ctrl+C to stop
- Or run: `npx playwright test --headed` to see browser

## Modifying Tests

Edit `tests/utterance-routing.spec.ts`:
- Add more utterances to `utteranceTests` array
- Adjust timeouts if needed
- Change widget ID prefixes if your IDs differ
- Modify detection logic for better accuracy
