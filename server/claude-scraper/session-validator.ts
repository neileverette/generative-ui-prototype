/**
 * Session Validator
 * Validates Claude Console session health before scraping attempts
 *
 * Checks if the browser session is still authenticated by:
 * 1. Verifying session directory exists
 * 2. Launching browser with persistent context
 * 3. Navigating to Console usage page
 * 4. Checking for authentication indicators
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '.session');

export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  timestamp: string;
}

/**
 * Validates the current session by checking authentication state
 * @returns Validation result indicating if session is valid and ready to use
 */
export async function validateSession(): Promise<SessionValidationResult> {
  const timestamp = new Date().toISOString();

  // Check if session directory exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    return {
      valid: false,
      reason: 'Session directory not found. No browser context saved.',
      timestamp,
    };
  }

  // Check if session directory has content
  const sessionFiles = fs.readdirSync(USER_DATA_DIR);
  if (sessionFiles.length === 0) {
    return {
      valid: false,
      reason: 'Session directory is empty. No browser context data.',
      timestamp,
    };
  }

  let browser;
  try {
    // Launch browser with persistent context
    browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      viewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();

    // Navigate to usage page with timeout
    try {
      await page.goto('https://console.anthropic.com/settings/usage', {
        waitUntil: 'networkidle',
        timeout: 10000,
      });
    } catch (error) {
      return {
        valid: false,
        reason: `Navigation timeout or network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      };
    }

    // Check for authentication indicators
    try {
      // Wait for either "Current session" text (authenticated) or redirect to login
      const isAuthenticated = await Promise.race([
        // Success case: usage page loaded
        page.waitForSelector('text=Current session', { timeout: 10000 })
          .then(() => true)
          .catch(() => false),
        // Failure case: redirected to login
        page.waitForURL('**/login**', { timeout: 10000 })
          .then(() => false)
          .catch(() => null),
      ]);

      if (isAuthenticated === true) {
        return {
          valid: true,
          timestamp,
        };
      } else if (isAuthenticated === false) {
        return {
          valid: false,
          reason: 'Redirected to login page. Session expired.',
          timestamp,
        };
      } else {
        // Check current URL to provide better error message
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
          return {
            valid: false,
            reason: 'Redirected to login page. Session expired.',
            timestamp,
          };
        } else {
          return {
            valid: false,
            reason: 'Could not verify authentication state. Page did not load expected content.',
            timestamp,
          };
        }
      }
    } catch (error) {
      return {
        valid: false,
        reason: `Authentication check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp,
      };
    }
  } catch (error) {
    return {
      valid: false,
      reason: `Failed to launch browser context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn('[Session Validator] Warning: Error closing browser:', closeError);
      }
    }
  }
}
