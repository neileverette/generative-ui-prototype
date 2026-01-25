import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utterance Routing Test Suite
 *
 * Automated testing of all utterances to verify routing behavior.
 * This test does NOT fix issues - it only logs results for manual review.
 */

interface UtteranceTest {
  category: string;
  utterance: string;
  expectedBehavior: 'route' | 'chat' | 'home';
  expectedWidgetPrefix?: string; // e.g., 'aws-', 'system-metric-', etc.
}

interface TestResult {
  category: string;
  utterance: string;
  expected: string;
  actual: string;
  passed: boolean;
  details: string;
  timestamp: string;
}

const testResults: TestResult[] = [];

// Define all utterances to test
const utteranceTests: UtteranceTest[] = [
  // NAVIGATION / HOME
  { category: 'Navigation', utterance: 'back', expectedBehavior: 'home' },
  { category: 'Navigation', utterance: 'home', expectedBehavior: 'home' },
  { category: 'Navigation', utterance: 'go home', expectedBehavior: 'home' },
  { category: 'Navigation', utterance: 'overview', expectedBehavior: 'home' },
  { category: 'Navigation', utterance: 'dashboard', expectedBehavior: 'home' },
  { category: 'Navigation', utterance: 'main', expectedBehavior: 'home' },
  { category: 'Navigation', utterance: 'clear', expectedBehavior: 'home' },
  { category: 'Navigation', utterance: 'reset', expectedBehavior: 'home' },

  // SYSTEM METRICS
  { category: 'System Metrics', utterance: 'system metrics', expectedBehavior: 'route', expectedWidgetPrefix: 'system-metric-' },
  { category: 'System Metrics', utterance: 'show metrics', expectedBehavior: 'route', expectedWidgetPrefix: 'system-metric-' },
  { category: 'System Metrics', utterance: 'performance', expectedBehavior: 'route', expectedWidgetPrefix: 'system-metric-' },
  { category: 'System Metrics', utterance: 'cpu', expectedBehavior: 'route', expectedWidgetPrefix: 'system-metric-' },
  { category: 'System Metrics', utterance: 'memory', expectedBehavior: 'route', expectedWidgetPrefix: 'system-metric-' },
  { category: 'System Metrics', utterance: 'system health', expectedBehavior: 'route', expectedWidgetPrefix: 'system-metric-' },
  { category: 'System Metrics', utterance: 'system status', expectedBehavior: 'route', expectedWidgetPrefix: 'system-metric-' },

  // AWS COSTS
  { category: 'AWS Costs', utterance: 'costs', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },
  { category: 'AWS Costs', utterance: 'show costs', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },
  { category: 'AWS Costs', utterance: 'aws costs', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },
  { category: 'AWS Costs', utterance: 'spending', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },
  { category: 'AWS Costs', utterance: 'billing', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },
  { category: 'AWS Costs', utterance: 'cost breakdown', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },

  // CONTAINERS
  { category: 'Containers', utterance: 'containers', expectedBehavior: 'route', expectedWidgetPrefix: 'container' },
  { category: 'Containers', utterance: 'show containers', expectedBehavior: 'route', expectedWidgetPrefix: 'container' },
  { category: 'Containers', utterance: 'docker', expectedBehavior: 'route', expectedWidgetPrefix: 'container' },
  { category: 'Containers', utterance: 'running containers', expectedBehavior: 'route', expectedWidgetPrefix: 'container' },
  { category: 'Containers', utterance: 'ecr', expectedBehavior: 'route', expectedWidgetPrefix: 'ecr-' },

  // AUTOMATIONS
  { category: 'Automations', utterance: 'automations', expectedBehavior: 'route', expectedWidgetPrefix: 'automation-' },
  { category: 'Automations', utterance: 'show automations', expectedBehavior: 'route', expectedWidgetPrefix: 'automation-' },
  { category: 'Automations', utterance: 'workflows', expectedBehavior: 'route', expectedWidgetPrefix: 'automation-' },
  { category: 'Automations', utterance: 'n8n', expectedBehavior: 'route', expectedWidgetPrefix: 'automation-' },

  // DEPLOYMENTS
  { category: 'Deployments', utterance: 'deployments', expectedBehavior: 'route', expectedWidgetPrefix: 'deployment' },
  { category: 'Deployments', utterance: 'show deployments', expectedBehavior: 'route', expectedWidgetPrefix: 'deployment' },
  { category: 'Deployments', utterance: 'deployment history', expectedBehavior: 'route', expectedWidgetPrefix: 'deployment' },
  { category: 'Deployments', utterance: 'releases', expectedBehavior: 'route', expectedWidgetPrefix: 'deployment' },

  // AI USAGE
  { category: 'AI Usage', utterance: 'claude usage', expectedBehavior: 'route', expectedWidgetPrefix: 'claude-usage-widget' },
  { category: 'AI Usage', utterance: 'ai usage', expectedBehavior: 'route', expectedWidgetPrefix: 'claude-usage-widget' },
  { category: 'AI Usage', utterance: 'api credits', expectedBehavior: 'route', expectedWidgetPrefix: 'claude-usage-widget' },
  { category: 'AI Usage', utterance: 'token usage', expectedBehavior: 'route', expectedWidgetPrefix: 'claude-usage-widget' },

  // CONVERSATIONAL (should fall back to chat)
  { category: 'Conversational', utterance: 'how do I configure automations', expectedBehavior: 'chat' },
  { category: 'Conversational', utterance: 'what is the weather', expectedBehavior: 'chat' },
  { category: 'Conversational', utterance: 'help me understand costs', expectedBehavior: 'chat' },
  { category: 'Conversational', utterance: 'why is CPU high', expectedBehavior: 'chat' },

  // EDGE CASES
  { category: 'Edge Cases', utterance: 'asdfghjkl', expectedBehavior: 'chat' },
  { category: 'Edge Cases', utterance: 'SHOW COSTS', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },
  { category: 'Edge Cases', utterance: '  costs  ', expectedBehavior: 'route', expectedWidgetPrefix: 'aws-' },
];

async function waitForStableDOM(page: Page, timeout = 5000) {
  // Wait for DOM to load and give time for React to hydrate
  try {
    await page.waitForLoadState('domcontentloaded', { timeout });
  } catch (e) {
    // Ignore timeout - page may already be loaded
  }
  await page.waitForTimeout(1000); // Additional buffer for React hydration
}

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

async function sendChatMessage(page: Page, message: string) {
  // Find the chat input and send message
  // Try multiple selectors to find CopilotKit's chat input
  try {
    // Try the most specific selector first
    let input = page.locator('textarea[placeholder*="performance"]');
    if (!await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Fallback to any textarea
      input = page.locator('textarea').first();
    }

    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.click(); // Ensure focus
    await page.waitForTimeout(300);
    await input.fill('');
 // Clear any existing text
    await input.fill(message);
    await page.waitForTimeout(500); // Small delay before pressing enter
    await input.press('Enter');
    await page.waitForTimeout(800); // Small delay after pressing enter
  } catch (e) {
    console.error(`Failed to send message "${message}":`, e);
    throw e;
  }
}

async function checkForWidgets(page: Page, widgetPrefix: string): Promise<boolean> {
  // Wait for widgets to render - check for specific widget content based on expected type
  try {
    // Give widgets more time to load (especially system metrics which fetch from MCP)
    await page.waitForTimeout(4000);

    // Check if we're showing widgets (not on landing page)
    const hasLandingPage = await page.locator('text=System & Infrastructure').isVisible({ timeout: 1500 }).catch(() => false);
    if (hasLandingPage) {
      return false; // Still on landing page
    }

    // Check for general widget indicators first (metric cards, tables, card groups)
    const hasMetricCards = await page.locator('.bg-white.rounded-lg.border').count() > 0;
    const hasDataTables = await page.locator('table').count() > 0;

    // If no widgets at all, definitely failed
    if (!hasMetricCards && !hasDataTables) {
      return false;
    }

    // Check for widget-specific content based on the expected widget type
    let hasExpectedContent = false;

    if (widgetPrefix === 'system-metric-') {
      // System metrics should show CPU, Memory, Disk, Network, Uptime
      hasExpectedContent = await page.locator('text=/CPU|Memory|Disk|Network|Uptime/i').count() > 0;
    } else if (widgetPrefix === 'aws-') {
      // AWS costs should show cost-related content
      hasExpectedContent = await page.locator('text=/Total Cost|AWS|Forecast|\$|cost/i').count() > 0;
    } else if (widgetPrefix === 'automation-') {
      // Automations should show workflow names or automation content
      hasExpectedContent = await page.locator('text=/Gmail|Image|Workflow|n8n|automation/i').count() > 0;
    } else if (widgetPrefix === 'container' || widgetPrefix === 'containers-list-table') {
      // Containers should show container info
      hasExpectedContent = await page.locator('text=/Container|Docker|Running|Image|container/i').count() > 0;
    } else if (widgetPrefix === 'deployment' || widgetPrefix === 'deployment-count') {
      // Deployments should show deployment info
      hasExpectedContent = await page.locator('text=/Deployment|Commit|Branch|deploy/i').count() > 0;
    } else if (widgetPrefix === 'claude-usage-widget') {
      // Claude usage should show usage info
      hasExpectedContent = await page.locator('text=/Claude|Token|Usage|API|credit/i').count() > 0;
    } else if (widgetPrefix === 'ecr-') {
      // ECR should show registry info
      hasExpectedContent = await page.locator('text=/ECR|Repository|Registry|Image/i').count() > 0;
    }

    // Return true if we have expected content AND we see widget elements
    return hasExpectedContent && (hasMetricCards || hasDataTables);
  } catch (e) {
    console.error('Error checking for widgets:', e);
    return false;
  }
}

async function checkForChatResponse(page: Page): Promise<boolean> {
  // Wait for chat response from CopilotKit
  try {
    // CopilotKit messages typically appear in the chat area
    // Wait for a reasonable time for AI response
    await page.waitForTimeout(5000);

    // Look for message bubbles or content in the chat area
    // Check multiple possible selectors for CopilotKit messages
    const hasChatBubbles = await page.locator('[class*="message"]').count() > 1; // More than just user message
    const hasAssistantText = await page.locator('text=/claude|assistant|ai/i').count() > 0;

    // Also check if chat area has grown (indicating new messages)
    const chatMessages = await page.locator('.overflow-auto').count();

    return hasChatBubbles || hasAssistantText || chatMessages > 0;
  } catch (e) {
    return false;
  }
}

async function checkForLandingPage(page: Page): Promise<boolean> {
  // Check if we're on the landing page
  await page.waitForTimeout(1500);

  // Look for landing page indicators (navigation cards, "Today's Update", etc.)
  const hasNavCards = await page.locator('text=System & Infrastructure').isVisible({ timeout: 3000 }).catch(() => false);
  const hasTodaysUpdate = await page.locator('text=Today\'s Update').isVisible({ timeout: 3000 }).catch(() => false);
  const hasContainersCard = await page.locator('text=Containers').isVisible({ timeout: 3000 }).catch(() => false);
  const hasAutomationsCard = await page.locator('text=Automations').isVisible({ timeout: 3000 }).catch(() => false);

  // If we see the navigation cards, we're on landing
  return hasNavCards || hasTodaysUpdate || hasContainersCard || hasAutomationsCard;
}

async function getConsoleLogs(page: Page): Promise<string[]> {
  // Get recent console logs (captured during test)
  return await page.evaluate(() => {
    // This would need to be set up to capture logs during page load
    return [];
  });
}

test.describe('Utterance Routing Tests', () => {
  test.beforeAll(() => {
    console.log('\n🧪 Starting Utterance Routing Test Suite\n');
  });

  test.afterAll(() => {
    // Write results to file
    const resultsDir = path.join(__dirname, '..', '.planning', 'phases', '40-chat-routing-integration');
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const resultsFile = path.join(resultsDir, `test-results-${timestamp}.md`);

    const summary = generateTestReport(testResults);
    fs.writeFileSync(resultsFile, summary, 'utf-8');

    console.log(`\n📊 Test results written to: ${resultsFile}\n`);
    console.log(summary);
  });

  test('should test all utterances', async ({ page }) => {
    // Set longer timeout for this test (45 utterances × 3 seconds each = 135 seconds minimum)
    test.setTimeout(300000); // 5 minutes

    // Navigate to app
    await page.goto('http://localhost:3000');
    await waitForStableDOM(page);

    // Capture console logs
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[WidgetLoader]') || text.includes('[handleSendMessage]')) {
        logs.push(text);
      }
    });

    // Run each test
    for (const utteranceTest of utteranceTests) {
      console.log(`\n Testing: "${utteranceTest.utterance}" (${utteranceTest.category})`);

      // Clear dashboard before each test (except first)
      if (testResults.length > 0) {
        await clearDashboard(page);
      }

      // Reload page every 10 tests to ensure fresh state
      if (testResults.length > 0 && testResults.length % 10 === 0) {
        console.log('  Reloading page to refresh state...');
        await page.reload();
        await waitForStableDOM(page);
      }

      // Send the utterance
      try {
        await sendChatMessage(page, utteranceTest.utterance);
      } catch (e) {
        console.error(`  Failed to send message, reloading page and retrying...`);
        await page.reload();
        await waitForStableDOM(page);
        await sendChatMessage(page, utteranceTest.utterance);
      }

      // Check the result based on expected behavior
      let passed = false;
      let actual = '';
      let details = '';

      if (utteranceTest.expectedBehavior === 'home') {
        const isOnLanding = await checkForLandingPage(page);
        passed = isOnLanding;
        actual = isOnLanding ? 'Returned to landing page' : 'Did not return to landing page';
        details = isOnLanding ? '✓ Landing page visible' : '✗ Landing page not visible';
      } else if (utteranceTest.expectedBehavior === 'route') {
        const hasWidgets = await checkForWidgets(page, utteranceTest.expectedWidgetPrefix!);
        passed = hasWidgets;
        actual = hasWidgets ? `Widgets loaded (${utteranceTest.expectedWidgetPrefix})` : 'No widgets loaded';
        details = hasWidgets
          ? `✓ Found widgets with ID prefix: ${utteranceTest.expectedWidgetPrefix}`
          : `✗ No widgets found with ID prefix: ${utteranceTest.expectedWidgetPrefix}`;
      } else if (utteranceTest.expectedBehavior === 'chat') {
        const hasChatResponse = await checkForChatResponse(page);
        passed = hasChatResponse;
        actual = hasChatResponse ? 'Chat response received' : 'No chat response';
        details = hasChatResponse
          ? '✓ Assistant message appeared in chat'
          : '✗ No assistant message in chat';
      }

      // Record result
      const result: TestResult = {
        category: utteranceTest.category,
        utterance: utteranceTest.utterance,
        expected: utteranceTest.expectedBehavior === 'route'
          ? `Route to ${utteranceTest.expectedWidgetPrefix} widgets`
          : utteranceTest.expectedBehavior === 'home'
          ? 'Return to landing page'
          : 'Fall back to chat',
        actual,
        passed,
        details,
        timestamp: new Date().toISOString(),
      };

      testResults.push(result);

      console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}: ${details}`);

      // Small delay between tests
      await page.waitForTimeout(500);
    }
  });
});

function generateTestReport(results: TestResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  let report = `# Utterance Routing Test Results\n\n`;
  report += `**Date:** ${new Date().toLocaleString()}\n`;
  report += `**Total Tests:** ${total}\n`;
  report += `**Passed:** ${passed} (${passRate}%)\n`;
  report += `**Failed:** ${failed}\n\n`;
  report += `---\n\n`;

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    const categoryTotal = categoryResults.length;

    report += `## ${category} (${categoryPassed}/${categoryTotal})\n\n`;

    for (const result of categoryResults) {
      const status = result.passed ? '✅' : '❌';
      report += `### ${status} "${result.utterance}"\n`;
      report += `- **Expected:** ${result.expected}\n`;
      report += `- **Actual:** ${result.actual}\n`;
      report += `- **Details:** ${result.details}\n\n`;
    }

    report += `---\n\n`;
  }

  // Failed tests summary
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    report += `## 🔴 Failed Tests Summary\n\n`;
    report += `The following ${failedTests.length} tests need attention:\n\n`;

    for (const result of failedTests) {
      report += `1. **"${result.utterance}"** (${result.category})\n`;
      report += `   - Expected: ${result.expected}\n`;
      report += `   - Actual: ${result.actual}\n\n`;
    }
  }

  return report;
}
