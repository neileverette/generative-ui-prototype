/**
 * Scrape Claude Console using your real Chrome browser
 * Uses your existing login session - no Playwright auth needed
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, 'usage-data.json');

// Chrome user data directory (where your real Chrome stores cookies)
const CHROME_USER_DATA = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

async function scrape() {
  console.log('[Scraper] Connecting to Chrome profile...');
  console.log('[Scraper] Using Chrome data from:', CHROME_USER_DATA);

  // Launch using your real Chrome profile
  const browser = await chromium.launchPersistentContext(CHROME_USER_DATA, {
    headless: false, // Must be visible first time to verify it works
    channel: 'chrome', // Use real Chrome, not Chromium
    args: ['--profile-directory=Default'],
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = await browser.newPage();

    console.log('[Scraper] Navigating to usage page...');
    await page.goto('https://console.anthropic.com/settings/usage', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    console.log('[Scraper] Extracting usage data...');

    // Extract the data
    const data = await page.evaluate(() => {
      const body = document.body.innerText;

      // Parse current session
      const sessionMatch = body.match(/Current session\s*Resets in ([^\n]+)\s*(\d+)%/i);
      const currentSession = {
        resetsIn: sessionMatch ? sessionMatch[1].trim() : '',
        percentageUsed: sessionMatch ? parseInt(sessionMatch[2], 10) : 0,
      };

      // Parse all models
      const allModelsMatch = body.match(/All models\s*Resets ([^\n]+)\s*(\d+)%/i);
      const allModels = {
        resetsIn: allModelsMatch ? allModelsMatch[1].trim() : '',
        percentageUsed: allModelsMatch ? parseInt(allModelsMatch[2], 10) : 0,
      };

      // Parse sonnet only
      const sonnetMatch = body.match(/Sonnet only[^\d]*Resets ([^\n]+)\s*(\d+)%/i);
      const sonnetOnly = {
        resetsIn: sonnetMatch ? sonnetMatch[1].trim() : '',
        percentageUsed: sonnetMatch ? parseInt(sonnetMatch[2], 10) : 0,
      };

      return { currentSession, allModels, sonnetOnly };
    });

    const usageData = {
      currentSession: data.currentSession,
      weeklyLimits: {
        allModels: data.allModels,
        sonnetOnly: data.sonnetOnly,
      },
      lastUpdated: new Date().toISOString(),
    };

    console.log('[Scraper] Extracted:', JSON.stringify(usageData, null, 2));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(usageData, null, 2));
    console.log('[Scraper] Saved to:', OUTPUT_FILE);

    return usageData;
  } finally {
    await browser.close();
  }
}

scrape()
  .then(() => {
    console.log('[Scraper] Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Scraper] Error:', err.message);
    process.exit(1);
  });
