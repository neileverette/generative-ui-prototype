/**
 * Headless Claude Console Scraper (CDP-based)
 * Connects to an existing Chrome instance via DevTools Protocol
 * No visible windows or tabs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, 'usage-data.json');

export interface ConsoleUsageData {
  currentSession: {
    resetsIn: string;
    percentageUsed: number;
  };
  weeklyLimits: {
    allModels: {
      resetsIn: string;
      percentageUsed: number;
    };
    sonnetOnly: {
      resetsIn: string;
      percentageUsed: number;
    };
  };
  lastUpdated: string;
  error?: string;
}

async function scrapeHeadless(): Promise<ConsoleUsageData> {
  console.log('[Headless Scraper] Launching headless browser...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    console.log('[Headless Scraper] Navigating to claude.ai/settings/usage...');

    // You'll need to set cookies or session data here
    // For now, this will fail with login. Let's use a different approach.

    await page.goto('https://claude.ai/settings/usage', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for content
    await page.waitForSelector('text=Current session', { timeout: 15000 });

    console.log('[Headless Scraper] Extracting usage data...');

    const data = await page.evaluate(() => {
      const sections = document.querySelectorAll('div');
      let currentSession = { resetsIn: '', percentageUsed: 0 };
      let allModels = { resetsIn: '', percentageUsed: 0 };
      let sonnetOnly = { resetsIn: '', percentageUsed: 0 };

      sections.forEach((section) => {
        const text = section.textContent || '';

        if (text.includes('Current session') && text.includes('Resets in')) {
          const resetsMatch = text.match(/Resets in ([^%]+?)(?=\d+%)/);
          const percentMatch = text.match(/(\d+)%\s*used/);
          if (resetsMatch) currentSession.resetsIn = resetsMatch[1].trim();
          if (percentMatch) currentSession.percentageUsed = parseInt(percentMatch[1], 10);
        }

        if (text.includes('All models') && text.includes('Resets')) {
          const resetsMatch = text.match(/Resets\s+([A-Za-z]+\s+\d+:\d+\s*[AP]M)/i);
          const percentMatch = text.match(/(\d+)%\s*used/);
          if (resetsMatch) allModels.resetsIn = resetsMatch[1].trim();
          if (percentMatch) allModels.percentageUsed = parseInt(percentMatch[1], 10);
        }

        if (text.includes('Sonnet only') && text.includes('Resets')) {
          const resetsMatch = text.match(/Resets\s+([A-Za-z]+\s+\d+:\d+\s*[AP]M)/i);
          const percentMatch = text.match(/(\d+)%\s*used/);
          if (resetsMatch) sonnetOnly.resetsIn = resetsMatch[1].trim();
          if (percentMatch) sonnetOnly.percentageUsed = parseInt(percentMatch[1], 10);
        }
      });

      return { currentSession, allModels, sonnetOnly };
    });

    const usageData: ConsoleUsageData = {
      currentSession: data.currentSession,
      weeklyLimits: {
        allModels: data.allModels,
        sonnetOnly: data.sonnetOnly,
      },
      lastUpdated: new Date().toISOString(),
    };

    console.log('[Headless Scraper] Data extracted:', JSON.stringify(usageData, null, 2));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(usageData, null, 2));
    console.log('[Headless Scraper] Saved to:', OUTPUT_FILE);

    return usageData;
  } finally {
    await browser.close();
  }
}

export { scrapeHeadless };

if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeHeadless()
    .then(() => {
      console.log('[Headless Scraper] Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Headless Scraper] Error:', err.message);
      process.exit(1);
    });
}
