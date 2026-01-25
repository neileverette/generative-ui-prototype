/**
 * One-time login script
 * Run this manually to save your Claude Console session
 *
 * Usage: npx ts-node server/claude-scraper/login.ts
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '.session');

async function login() {
  console.log('Opening browser for Claude Console login...');
  console.log('Session will be saved to:', USER_DATA_DIR);

  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  await page.goto('https://console.anthropic.com/settings/usage');

  console.log('\n===========================================');
  console.log('Please log in with Google SSO in the browser.');
  console.log('Once you see the Usage page, press Enter here.');
  console.log('===========================================\n');

  // Wait for user to press Enter
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  // Verify we're logged in by checking for usage data
  const content = await page.content();
  if (content.includes('Current session') || content.includes('Resets in')) {
    console.log('✓ Login successful! Session saved.');
  } else {
    console.log('⚠ Could not verify login. Check the browser.');
  }

  await browser.close();
  console.log('You can now run the scraper: npx ts-node server/claude-scraper/scrape.ts');
}

login().catch(console.error);
