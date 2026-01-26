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
import fs from 'fs';
import { RetryStrategy, ErrorCategory, CircuitState } from './retry-strategy.js';
import type { ConsoleUsageData } from './scrape.js';
import { syncWithRetry, getSyncMetrics } from './sync-client.js';
import { cleanupCache, shouldCleanup } from './cleanup-cache.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRAPE_SCRIPT = path.join(__dirname, 'scrape-silent.sh');
const OUTPUT_FILE = path.join(__dirname, 'usage-data.json');
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Initialize retry strategy with defaults
const retryStrategy = new RetryStrategy();
let lastSuccessfulValidation: Date | null = null;
let retryTimeoutId: NodeJS.Timeout | null = null;

// Check for verbose flag
const VERBOSE = process.argv.includes('--verbose');

// Scraper metrics tracking
let scraperRunCount = 0;
let lastCircuitStateTransition: { from: CircuitState; to: CircuitState; timestamp: Date } | null = null;
let lastCleanupTime: Date | null = null;

// Cleanup configuration
const CLEANUP_INTERVAL_RUNS = 12; // Clean every 12 runs (1 hour if runs are every 5 min)
const CLEANUP_THRESHOLD_MB = 50; // Clean if session cache exceeds 50MB

async function runScraper(): Promise<void> {
  scraperRunCount++;
  const runStartTime = Date.now();

  try {
    // Periodic cache cleanup to prevent memory bloat
    if (scraperRunCount % CLEANUP_INTERVAL_RUNS === 0 || shouldCleanup(CLEANUP_THRESHOLD_MB)) {
      try {
        if (VERBOSE) {
          console.log('[Auto-Scraper] Running periodic cache cleanup...');
        }
        const cleanupStats = await cleanupCache(VERBOSE);
        lastCleanupTime = new Date();

        if (cleanupStats.bytesFreed > 0) {
          const mbFreed = (cleanupStats.bytesFreed / 1024 / 1024).toFixed(2);
          console.log(`[Auto-Scraper] Cache cleanup: freed ${mbFreed} MB`);
        }
      } catch (cleanupError) {
        // Don't fail the scraper if cleanup fails
        console.warn('[Auto-Scraper] Cache cleanup failed:', cleanupError);
      }
    }

    // Check if circuit breaker is open
    if (retryStrategy.isCircuitOpen()) {
      const circuitState = retryStrategy.getCircuitState();
      console.log(`[Auto-Scraper] Circuit breaker is ${circuitState}. Skipping scrape attempt.`);
      if (VERBOSE) {
        console.log('[Auto-Scraper] Waiting for circuit to transition to HALF_OPEN state...');
      }
      return;
    }

    const prevCircuitState = retryStrategy.getCircuitState();
    if (VERBOSE && prevCircuitState !== 'CLOSED') {
      console.log(`[Auto-Scraper] Circuit state: ${prevCircuitState}`);
    }

    console.log(
      `[Auto-Scraper] Running scraper at ${new Date().toLocaleTimeString()} ` +
      `(run #${scraperRunCount})...`
    );

    if (VERBOSE && lastSuccessfulValidation) {
      const ageMinutes = Math.floor((Date.now() - lastSuccessfulValidation.getTime()) / 1000 / 60);
      console.log(`[Auto-Scraper] Session age: ${ageMinutes} minutes since last successful validation`);
    }

    const { stdout, stderr } = await execAsync(`bash "${SCRAPE_SCRIPT}"`);

    if (stdout) console.log(stdout.trim());
    if (stderr) console.error('[Auto-Scraper] stderr:', stderr.trim());

    // Check if data was saved and whether it's partial
    let isPartial = false;
    let sectionsExtracted = 0;
    let totalSections = 3;
    let extractionErrors: Record<string, string> = {};
    let usageData: ConsoleUsageData | null = null;

    try {
      const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      usageData = data;
      isPartial = data.isPartial || false;
      extractionErrors = data.extractionErrors || {};

      // Count extracted sections
      if (data.currentSession) sectionsExtracted++;
      if (data.weeklyLimits?.allModels) sectionsExtracted++;
      if (data.weeklyLimits?.sonnetOnly) sectionsExtracted++;
    } catch (err) {
      // If we can't read the file, treat as full success (backward compatible)
      sectionsExtracted = totalSections;
    }

    // Success! Record in retry strategy and circuit breaker (partial = success)
    retryStrategy.reset();
    retryStrategy.recordSuccess();
    lastSuccessfulValidation = new Date();

    // Log result based on completeness
    if (isPartial) {
      const missing = Object.keys(extractionErrors).join(', ');
      console.log(`[Auto-Scraper] Scrape completed with partial data (${sectionsExtracted}/${totalSections} sections). Missing: ${missing}`);
      if (VERBOSE && Object.keys(extractionErrors).length > 0) {
        console.log('[Auto-Scraper] Extraction errors:', JSON.stringify(extractionErrors, null, 2));
      }
    } else {
      console.log(`[Auto-Scraper] Scrape completed successfully (${sectionsExtracted}/${totalSections} sections)`);
    }

    const newCircuitState = retryStrategy.getCircuitState();
    if (newCircuitState !== prevCircuitState) {
      lastCircuitStateTransition = {
        from: prevCircuitState,
        to: newCircuitState,
        timestamp: new Date(),
      };
      console.log(`[Auto-Scraper] Circuit state transition: ${prevCircuitState} → ${newCircuitState}`);
    }

    // Log performance metrics
    const runDuration = Date.now() - runStartTime;
    if (VERBOSE) {
      console.log(`[Auto-Scraper] Scrape completed in ${runDuration}ms`);

      // Log sync metrics every 5 runs
      if (scraperRunCount % 5 === 0) {
        const syncMetrics = getSyncMetrics();
        console.log('[Auto-Scraper] Sync metrics:', syncMetrics);
      }
    }

    // Sync to EC2 with retry logic (continue scraper operation even if all retries fail)
    if (usageData) {
      try {
        const syncResponse = await syncWithRetry(usageData, VERBOSE);
        if (syncResponse.success) {
          console.log(`[Auto-Scraper] Synced to EC2 at ${syncResponse.timestamp}`);
          if (VERBOSE) {
            console.log('[Auto-Scraper] EC2 sync successful');
          }
        } else {
          console.warn(`[Auto-Scraper] EC2 sync failed: ${syncResponse.message}`);
        }
      } catch (syncError) {
        // Log but don't crash - scraper continues regardless
        const syncErrorMsg = syncError instanceof Error ? syncError.message : String(syncError);
        console.warn(`[Auto-Scraper] EC2 sync error after retries: ${syncErrorMsg}`);
        if (VERBOSE) {
          console.warn('[Auto-Scraper] Scraper will continue despite sync failure');
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Classify error using RetryStrategy
    const errorCategory = RetryStrategy.classifyError(errorMessage);

    // Map ErrorCategory enum to action messages
    let specificAction = 'Check logs and retry manually';

    switch (errorCategory) {
      case ErrorCategory.SESSION_EXPIRED:
        specificAction = 'Run: npx tsx server/claude-scraper/login.ts';
        break;
      case ErrorCategory.NETWORK_ERROR:
        specificAction = 'Check network connection. Auto-retry with exponential backoff.';
        break;
      case ErrorCategory.CONTEXT_CORRUPTED:
        specificAction = 'Delete server/claude-scraper/.session/ and run login.ts';
        break;
      case ErrorCategory.UNKNOWN:
        specificAction = 'Check logs and retry manually';
        break;
    }

    // Log session age for debugging
    if (VERBOSE && lastSuccessfulValidation) {
      const ageMinutes = Math.floor((Date.now() - lastSuccessfulValidation.getTime()) / 1000 / 60);
      console.error(`[Auto-Scraper] Last successful validation was ${ageMinutes} minutes ago`);
    }

    // For session-related errors, exit immediately (no retry)
    if (errorCategory === ErrorCategory.SESSION_EXPIRED ||
        errorCategory === ErrorCategory.CONTEXT_CORRUPTED) {
      console.error(`[Auto-Scraper] ${errorCategory}: ${specificAction}`);
      console.error('[Auto-Scraper] Stopping auto-scraper. Restart after fixing the issue.');
      process.exit(1);
    }

    // Record failure in circuit breaker
    const prevCircuitState = retryStrategy.getCircuitState();
    retryStrategy.recordFailure();
    retryStrategy.recordAttempt();
    const newCircuitState = retryStrategy.getCircuitState();

    // Log circuit state transition
    if (newCircuitState !== prevCircuitState) {
      lastCircuitStateTransition = {
        from: prevCircuitState,
        to: newCircuitState,
        timestamp: new Date(),
      };
      console.error(
        `[Auto-Scraper] Circuit breaker transition: ${prevCircuitState} → ${newCircuitState} ` +
        `(error: ${errorCategory})`
      );
    }

    const attemptNumber = retryStrategy.getAttemptCount();
    const maxAttempts = retryStrategy.getMaxAttempts();

    // Check if we should retry
    if (!retryStrategy.shouldRetry(errorCategory, attemptNumber)) {
      const circuitState = retryStrategy.getCircuitState();

      if (circuitState === 'OPEN') {
        console.error(`[Auto-Scraper] Circuit breaker OPEN after ${attemptNumber} attempts.`);
        console.error('[Auto-Scraper] Scraper will pause retries for 60s before testing recovery.');
        console.error(`[Auto-Scraper] Last error category: ${errorCategory}`);
        console.error(`[Auto-Scraper] Action: ${specificAction}`);
        // Don't exit - let circuit breaker handle recovery
        return;
      } else {
        console.error(`[Auto-Scraper] Stopped after ${maxAttempts} consecutive failures.`);
        console.error(`[Auto-Scraper] Last error category: ${errorCategory}`);
        console.error(`[Auto-Scraper] Action required: ${specificAction}`);
        process.exit(1);
      }
    }

    // Calculate backoff delay for retry
    const delayMs = retryStrategy.calculateDelay(attemptNumber);
    const delaySeconds = Math.floor(delayMs / 1000);

    console.error(`[Auto-Scraper] ${errorCategory} (attempt ${attemptNumber}/${maxAttempts}):`, errorMessage);
    console.error(`[Auto-Scraper] Recoverable error. Retrying in ${delaySeconds}s...`);

    if (VERBOSE) {
      console.error(`[Auto-Scraper] Exponential backoff: ${delayMs}ms (base: 30s, max: 5min)`);
    }

    // Schedule immediate retry after backoff (not next 5-min interval)
    if (retryTimeoutId) {
      clearTimeout(retryTimeoutId);
    }

    retryTimeoutId = setTimeout(() => {
      console.log('[Auto-Scraper] Retry attempt starting...');
      runScraper();
    }, delayMs);
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
