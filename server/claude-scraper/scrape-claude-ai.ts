/**
 * Scrape claude.ai/settings/usage
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.join(__dirname, 'usage-data.json');

// Chrome cookies location
const CHROME_PROFILE = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default');

async function scrape() {
  console.log('[Scraper] Launching Chrome...');

  // Launch with user's Chrome data to get cookies
  const userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--profile-directory=Default'],
  });

  try {
    const page = await browser.newPage();

    console.log('[Scraper] Navigating to claude.ai/settings/usage...');
    await page.goto('https://claude.ai/settings/usage', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for content
    await page.waitForTimeout(3000);

    console.log('[Scraper] Extracting data...');

    // Get page text
    const text = await page.evaluate(() => document.body.innerText);
    console.log('[Scraper] Page text:', text.substring(0, 500));

    // Parse the data
    const data = await page.evaluate(() => {
      const text = document.body.innerText;

      // Current session
      const sessionResetMatch = text.match(/Resets in (\d+ hr \d+ min|\d+ min)/i);
      const sessionPercentMatch = text.match(/(\d+)%\s*used/i);

      // Look for weekly data
      const allModelsMatch = text.match(/All models[\s\S]*?Resets ([^\n]+?)(\d+)%/i);
      const sonnetMatch = text.match(/Sonnet only[\s\S]*?Resets ([^\n]+?)(\d+)%/i);

      return {
        currentSession: {
          resetsIn: sessionResetMatch ? sessionResetMatch[1] : '',
          percentageUsed: sessionPercentMatch ? parseInt(sessionPercentMatch[1], 10) : 0,
        },
        weeklyLimits: {
          allModels: {
            resetsIn: allModelsMatch ? allModelsMatch[1].trim() : '',
            percentageUsed: allModelsMatch ? parseInt(allModelsMatch[2], 10) : 0,
          },
          sonnetOnly: {
            resetsIn: sonnetMatch ? sonnetMatch[1].trim() : '',
            percentageUsed: sonnetMatch ? parseInt(sonnetMatch[2], 10) : 0,
          },
        },
        rawText: text.substring(0, 1000),
      };
    });

    console.log('[Scraper] Extracted:', JSON.stringify(data, null, 2));

    const usageData = {
      currentSession: data.currentSession,
      weeklyLimits: data.weeklyLimits,
      lastUpdated: new Date().toISOString(),
    };

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
    console.error('[Scraper] Error:', err);
    process.exit(1);
  });
