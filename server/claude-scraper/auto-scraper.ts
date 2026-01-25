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
let lastSuccessfulValidation: Date | null = null;

// Check for verbose flag
const VERBOSE = process.argv.includes('--verbose');

async function runScraper(): Promise<void> {
  try {
    console.log(`[Auto-Scraper] Running scraper at ${new Date().toLocaleTimeString()}...`);

    if (VERBOSE && lastSuccessfulValidation) {
      const ageMinutes = Math.floor((Date.now() - lastSuccessfulValidation.getTime()) / 1000 / 60);
      console.log(`[Auto-Scraper] Session age: ${ageMinutes} minutes since last successful validation`);
    }

    const { stdout, stderr } = await execAsync(`bash "${SCRAPE_SCRIPT}"`);

    if (stdout) console.log(stdout.trim());
    if (stderr) console.error('[Auto-Scraper] stderr:', stderr.trim());

    consecutiveErrors = 0; // Reset error counter on success
    lastSuccessfulValidation = new Date(); // Track successful validation
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Categorize the error type
    let errorCategory = 'UNKNOWN';
    let specificAction = 'Check logs and retry manually';

    if (errorMessage.includes('SESSION_EXPIRED')) {
      errorCategory = 'SESSION_EXPIRED';
      specificAction = 'Run: npx tsx server/claude-scraper/login.ts';
    } else if (errorMessage.includes('NETWORK_ERROR')) {
      errorCategory = 'NETWORK_ERROR';
      specificAction = 'Check network connection and wait 5 minutes for retry';
    } else if (errorMessage.includes('CONTEXT_CORRUPTED')) {
      errorCategory = 'CONTEXT_CORRUPTED';
      specificAction = 'Delete server/claude-scraper/.session/ and run login.ts';
    } else if (errorMessage.includes('Session validation failed')) {
      // Legacy error message format
      errorCategory = 'SESSION_EXPIRED';
      specificAction = 'Run: npx tsx server/claude-scraper/login.ts';
    }

    // Log session age for debugging
    if (VERBOSE && lastSuccessfulValidation) {
      const ageMinutes = Math.floor((Date.now() - lastSuccessfulValidation.getTime()) / 1000 / 60);
      console.error(`[Auto-Scraper] Last successful validation was ${ageMinutes} minutes ago`);
    }

    // For session-related errors, exit immediately (no retry)
    if (errorCategory === 'SESSION_EXPIRED' || errorCategory === 'CONTEXT_CORRUPTED') {
      console.error(`[Auto-Scraper] ${errorCategory}: ${specificAction}`);
      console.error('[Auto-Scraper] Stopping auto-scraper. Restart after fixing the issue.');
      process.exit(1);
    }

    // For other errors, use existing retry logic
    consecutiveErrors++;
    console.error(`[Auto-Scraper] ${errorCategory} (${consecutiveErrors}/${MAX_ERRORS}):`, errorMessage);

    if (consecutiveErrors >= MAX_ERRORS) {
      console.error(`[Auto-Scraper] Stopped after ${MAX_ERRORS} consecutive failures.`);
      console.error(`[Auto-Scraper] Last error category: ${errorCategory}`);
      console.error(`[Auto-Scraper] Action required: ${specificAction}`);
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
