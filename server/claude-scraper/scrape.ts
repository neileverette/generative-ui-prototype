/**
 * Claude Console Usage Scraper
 * Runs headlessly using saved session, extracts usage data
 *
 * Usage: npx ts-node server/claude-scraper/scrape.ts
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '.session');
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

async function scrape(): Promise<ConsoleUsageData> {
  // Check if session exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    throw new Error('No session found. Run login.ts first.');
  }

  console.log('[Scraper] Starting headless browser...');

  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = await browser.newPage();

    console.log('[Scraper] Navigating to usage page...');
    await page.goto('https://console.anthropic.com/settings/usage', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for the usage data to load
    await page.waitForSelector('text=Current session', { timeout: 10000 });

    console.log('[Scraper] Extracting usage data...');

    // Extract the data from the page
    const data = await page.evaluate(() => {
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || '';
      };

      // Find all sections by looking for headers
      const sections = document.querySelectorAll('div');
      let currentSession = { resetsIn: '', percentageUsed: 0 };
      let allModels = { resetsIn: '', percentageUsed: 0 };
      let sonnetOnly = { resetsIn: '', percentageUsed: 0 };

      sections.forEach((section) => {
        const text = section.textContent || '';

        // Current session section
        if (text.includes('Current session') && text.includes('Resets in')) {
          const resetsMatch = text.match(/Resets in ([^%]+?)(?=\d+%)/);
          const percentMatch = text.match(/(\d+)%\s*used/);
          if (resetsMatch) currentSession.resetsIn = resetsMatch[1].trim();
          if (percentMatch) currentSession.percentageUsed = parseInt(percentMatch[1], 10);
        }

        // Weekly - All models
        if (text.includes('All models') && text.includes('Resets')) {
          const resetsMatch = text.match(/Resets\s+([A-Za-z]+\s+\d+:\d+\s*[AP]M)/i);
          const percentMatch = text.match(/(\d+)%\s*used/);
          if (resetsMatch) allModels.resetsIn = resetsMatch[1].trim();
          if (percentMatch) allModels.percentageUsed = parseInt(percentMatch[1], 10);
        }

        // Weekly - Sonnet only
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

    console.log('[Scraper] Data extracted:', JSON.stringify(usageData, null, 2));

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(usageData, null, 2));
    console.log('[Scraper] Saved to:', OUTPUT_FILE);

    return usageData;
  } finally {
    await browser.close();
  }
}

export { scrape };

// Run if called directly (ESM-compatible check)
if (import.meta.url === `file://${process.argv[1]}`) {
  scrape()
    .then(() => {
      console.log('[Scraper] Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Scraper] Error:', err.message);
      process.exit(1);
    });
}
