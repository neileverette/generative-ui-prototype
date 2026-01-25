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
import { validateSession } from './session-validator.js';

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
  // Validate session before scraping
  console.log('[Scraper] Validating session...');
  const validationResult = await validateSession();

  if (!validationResult.valid) {
    // Categorize error and determine if recovery should be attempted
    const reason = validationResult.reason || 'Unknown error';

    // Check if this is a likely expired session (not corrupted context or network issue)
    const isLikelyExpired = reason.includes('Session expired') ||
                           reason.includes('login page') ||
                           reason.includes('Redirected to login');

    const isNetworkIssue = reason.includes('Navigation timeout') ||
                          reason.includes('network error');

    const isCorrupted = reason.includes('Session directory') ||
                       reason.includes('Failed to launch browser context');

    // Attempt recovery for likely expired sessions
    if (isLikelyExpired) {
      console.log('[Scraper] Session appears expired. Attempting automatic recovery...');
      const recoveryResult = await validateSession(true);

      if (recoveryResult.valid) {
        console.log('[Scraper] Session recovered successfully! Continuing with scrape...');
        // Fall through to continue scraping
      } else {
        // Recovery failed
        const recoveryAction = recoveryResult.recoveryResult?.action;
        let errorMessage: string;

        if (recoveryAction === 'manual-login-required') {
          errorMessage = 'SESSION_EXPIRED: Auto-recovery failed. Manual login required. Run: npx tsx server/claude-scraper/login.ts';
        } else if (recoveryAction === 'network-error') {
          errorMessage = 'NETWORK_ERROR: Network timeout during recovery. Check connection and try again.';
        } else {
          errorMessage = `SESSION_EXPIRED: ${reason}. Run: npx tsx server/claude-scraper/login.ts`;
        }

        console.error(`[Scraper] ${errorMessage}`);
        throw new Error(errorMessage);
      }
    } else if (isNetworkIssue) {
      const errorMessage = 'NETWORK_ERROR: Network timeout accessing Console. Check connection and try again in 5 minutes.';
      console.error(`[Scraper] ${errorMessage}`);
      throw new Error(errorMessage);
    } else if (isCorrupted) {
      const errorMessage = 'CONTEXT_CORRUPTED: Browser session corrupted. Delete server/claude-scraper/.session/ and run: npx tsx server/claude-scraper/login.ts';
      console.error(`[Scraper] ${errorMessage}`);
      throw new Error(errorMessage);
    } else {
      // Unknown error
      const errorMessage = `UNKNOWN_ERROR: Session validation failed: ${reason}. Run: npx tsx server/claude-scraper/login.ts`;
      console.error(`[Scraper] ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  console.log('[Scraper] Session validated successfully');
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
