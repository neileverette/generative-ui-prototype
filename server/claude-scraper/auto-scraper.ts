/**
 * Auto-Scraper Service
 * Runs the Claude Console scraper every 5 minutes in the background
 *
 * Usage: npx tsx server/claude-scraper/auto-scraper.ts
 */

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRAPE_SCRIPT = path.join(__dirname, 'scrape-silent.sh');
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let consecutiveErrors = 0;
const MAX_ERRORS = 3;

async function runScraper(): Promise<void> {
  try {
    console.log(`[Auto-Scraper] Running scraper at ${new Date().toLocaleTimeString()}...`);

    const { stdout, stderr } = await execAsync(`bash "${SCRAPE_SCRIPT}"`);

    if (stdout) console.log(stdout.trim());
    if (stderr) console.error('[Auto-Scraper] stderr:', stderr.trim());

    consecutiveErrors = 0; // Reset error counter on success
  } catch (error) {
    consecutiveErrors++;
    console.error(`[Auto-Scraper] Error (${consecutiveErrors}/${MAX_ERRORS}):`, error instanceof Error ? error.message : error);

    if (consecutiveErrors >= MAX_ERRORS) {
      console.error(`[Auto-Scraper] Too many consecutive errors. Stopping.`);
      console.error('[Auto-Scraper] Make sure:');
      console.error('  1. Chrome is running');
      console.error('  2. You are logged into claude.ai in Chrome');
      console.error('  3. Chrome > View > Developer > Allow JavaScript from Apple Events is enabled');
      process.exit(1);
    }
  }
}

// Run immediately on start
console.log('[Auto-Scraper] Starting Claude Console auto-scraper...');
console.log(`[Auto-Scraper] Will scrape every ${INTERVAL_MS / 1000 / 60} minutes`);
runScraper();

// Then run every 5 minutes
setInterval(runScraper, INTERVAL_MS);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Auto-Scraper] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Auto-Scraper] Shutting down gracefully...');
  process.exit(0);
});
