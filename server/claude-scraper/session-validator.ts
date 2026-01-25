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
  recoveryAttempted?: boolean;
  recoveryResult?: SessionRecoveryResult;
}

export interface SessionRecoveryResult {
  recovered: boolean;
  action: 'auto-refreshed' | 'manual-login-required' | 'network-error';
  timestamp: string;
}

/**
 * Attempts to recover an expired session by refreshing the browser
 * Runs headless first, only shows browser if manual login is required
 * @returns Recovery result indicating if session was recovered and what action is needed
 */
export async function attemptSessionRecovery(): Promise<SessionRecoveryResult> {
  const timestamp = new Date().toISOString();

  console.log('[Session Recovery] Attempting session recovery...');
  console.log('[Session Recovery] Opening browser in headless mode...');

  let browser;
  try {
    // Launch browser with persistent context (headless to avoid interrupting user)
    browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      viewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();

    // Navigate to usage page
    try {
      await page.goto('https://console.anthropic.com/settings/usage', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch (error) {
      console.error('[Session Recovery] Network error during navigation');
      return {
        recovered: false,
        action: 'network-error',
        timestamp,
      };
    }

    // Wait up to 30 seconds for either auto-refresh success or login page
    try {
      const result = await Promise.race([
        // Success: "Current session" appears (auto-refreshed)
        page.waitForSelector('text=Current session', { timeout: 30000 })
          .then(() => 'auto-refreshed' as const),
        // Failure: Redirected to login page (manual login required)
        page.waitForURL('**/login**', { timeout: 30000 })
          .then(() => 'manual-login-required' as const),
      ]).catch(() => 'timeout' as const);

      if (result === 'auto-refreshed') {
        console.log('[Session Recovery] Success! Session auto-refreshed.');
        // Close browser since recovery succeeded
        await browser.close();
        return {
          recovered: true,
          action: 'auto-refreshed',
          timestamp,
        };
      } else if (result === 'manual-login-required') {
        console.log('[Session Recovery] Manual login required.');
        console.log('[Session Recovery] Run: npx tsx server/claude-scraper/login.ts');
        // Close headless browser - user needs to run login.ts
        await browser.close();
        return {
          recovered: false,
          action: 'manual-login-required',
          timestamp,
        };
      } else {
        // Timeout - check current state
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
          console.log('[Session Recovery] Redirected to login page.');
          console.log('[Session Recovery] Run: npx tsx server/claude-scraper/login.ts');
          await browser.close();
          return {
            recovered: false,
            action: 'manual-login-required',
            timestamp,
          };
        } else {
          console.error('[Session Recovery] Timeout waiting for page state.');
          await browser.close();
          return {
            recovered: false,
            action: 'network-error',
            timestamp,
          };
        }
      }
    } catch (error) {
      console.error('[Session Recovery] Error during recovery attempt:', error);
      await browser.close();
      return {
        recovered: false,
        action: 'network-error',
        timestamp,
      };
    }
  } catch (error) {
    console.error('[Session Recovery] Failed to launch browser:', error);
    return {
      recovered: false,
      action: 'network-error',
      timestamp,
    };
  }
}

/**
 * Validates the current session by checking authentication state
 * @param attemptRecovery If true, will attempt to recover the session if validation fails
 * @returns Validation result indicating if session is valid and ready to use
 */
export async function validateSession(attemptRecovery: boolean = false): Promise<SessionValidationResult> {
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
        const failedResult = {
          valid: false,
          reason: 'Redirected to login page. Session expired.',
          timestamp,
        };

        // Attempt recovery if requested
        if (attemptRecovery) {
          console.log('[Session Validator] Session expired. Attempting recovery...');
          const recoveryResult = await attemptSessionRecovery();
          return {
            ...failedResult,
            recoveryAttempted: true,
            recoveryResult,
            valid: recoveryResult.recovered,
          };
        }

        return failedResult;
      } else {
        // Check current URL to provide better error message
        const currentUrl = page.url();
        const failedResult = {
          valid: false,
          reason: currentUrl.includes('login')
            ? 'Redirected to login page. Session expired.'
            : 'Could not verify authentication state. Page did not load expected content.',
          timestamp,
        };

        // Attempt recovery if requested and likely expired
        if (attemptRecovery && currentUrl.includes('login')) {
          console.log('[Session Validator] Session expired. Attempting recovery...');
          const recoveryResult = await attemptSessionRecovery();
          return {
            ...failedResult,
            recoveryAttempted: true,
            recoveryResult,
            valid: recoveryResult.recovered,
          };
        }

        return failedResult;
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
