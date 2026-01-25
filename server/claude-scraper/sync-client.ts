/**
 * EC2 Sync Client
 * POSTs Claude Console usage data to EC2 endpoint with retry logic
 *
 * Usage: import { syncToEC2, syncWithRetry } from './sync-client.js'
 */

import type { ConsoleUsageData } from './scrape.js';
import type { ConsoleUsageDataSync, SyncResponse } from '../claude-console-sync-types.js';

const DEFAULT_SYNC_URL = 'http://localhost:4000/api/claude/console-usage';
const SYNC_TIMEOUT_MS = 10000; // 10 seconds

// Sync error categories for retry logic
export enum SyncErrorCategory {
  NETWORK = 'NETWORK',   // Retry - network issues, timeouts
  AUTH = 'AUTH',         // No retry - authentication failed
  VALIDATION = 'VALIDATION', // No retry - data validation failed
  SERVER = 'SERVER',     // Retry - server errors (500, 502, 503)
  UNKNOWN = 'UNKNOWN'    // Retry - unknown errors
}

// Retry configuration for sync operations
export interface SyncRetryConfig {
  maxAttempts: number;
  delaysMs: number[]; // Explicit delays for each attempt
}

const DEFAULT_SYNC_RETRY_CONFIG: SyncRetryConfig = {
  maxAttempts: 3,
  delaysMs: [10000, 20000, 40000], // 10s, 20s, 40s
};

/**
 * Sync Retry Strategy
 * Handles retry logic specific to EC2 sync operations
 */
export class SyncRetryStrategy {
  private config: SyncRetryConfig;
  private attemptCount: number = 0;
  private lastError: SyncErrorCategory | null = null;

  constructor(config?: Partial<SyncRetryConfig>) {
    this.config = { ...DEFAULT_SYNC_RETRY_CONFIG, ...config };
  }

  /**
   * Classifies sync error into category for retry decision
   */
  static classifyError(error: Error, statusCode?: number): SyncErrorCategory {
    const message = error.message.toLowerCase();

    // Authentication errors
    if (statusCode === 401 || message.includes('authentication') || message.includes('api key')) {
      return SyncErrorCategory.AUTH;
    }

    // Validation errors
    if (statusCode === 400 || message.includes('validation') || message.includes('invalid data')) {
      return SyncErrorCategory.VALIDATION;
    }

    // Network errors (timeout, connection refused, etc.)
    if (message.includes('network error') || message.includes('timeout') || message.includes('econnrefused')) {
      return SyncErrorCategory.NETWORK;
    }

    // Server errors (500, 502, 503, 504)
    if (statusCode && statusCode >= 500) {
      return SyncErrorCategory.SERVER;
    }

    return SyncErrorCategory.UNKNOWN;
  }

  /**
   * Determines if error should be retried
   */
  shouldRetry(errorCategory: SyncErrorCategory, attemptNumber: number): boolean {
    // Auth and validation errors never retry
    if (errorCategory === SyncErrorCategory.AUTH || errorCategory === SyncErrorCategory.VALIDATION) {
      return false;
    }

    // Check if max attempts exceeded
    if (attemptNumber >= this.config.maxAttempts) {
      return false;
    }

    // Network, server, and unknown errors are retryable
    return true;
  }

  /**
   * Gets delay for next retry attempt
   */
  getDelay(attemptNumber: number): number {
    const index = attemptNumber - 1;
    if (index < this.config.delaysMs.length) {
      return this.config.delaysMs[index];
    }
    // Return last delay if we exceed the array
    return this.config.delaysMs[this.config.delaysMs.length - 1];
  }

  /**
   * Records a retry attempt
   */
  recordAttempt(): void {
    this.attemptCount++;
  }

  /**
   * Records sync failure
   */
  recordFailure(errorCategory: SyncErrorCategory): void {
    this.lastError = errorCategory;
  }

  /**
   * Records successful sync and resets state
   */
  recordSuccess(): void {
    this.attemptCount = 0;
    this.lastError = null;
  }

  /**
   * Gets current attempt count
   */
  getAttemptCount(): number {
    return this.attemptCount;
  }

  /**
   * Gets max attempts
   */
  getMaxAttempts(): number {
    return this.config.maxAttempts;
  }

  /**
   * Resets retry state
   */
  reset(): void {
    this.attemptCount = 0;
    this.lastError = null;
  }
}

/**
 * Syncs usage data to EC2 endpoint (single attempt, no retry)
 * @param data - ConsoleUsageData from scraper
 * @returns SyncResponse with success status and timestamp
 * @throws Error if sync fails (authentication, validation, network)
 */
export async function syncToEC2(data: ConsoleUsageData): Promise<SyncResponse> {
  // Read environment variables
  const syncUrl = process.env.CLAUDE_SYNC_URL || DEFAULT_SYNC_URL;
  const apiKey = process.env.CLAUDE_SYNC_API_KEY;

  // If API key not set, log warning and return early
  if (!apiKey) {
    console.warn('[Sync Client] CLAUDE_SYNC_API_KEY not set. Skipping EC2 sync.');
    return {
      success: false,
      message: 'API key not configured',
      timestamp: new Date().toISOString(),
    };
  }

  // Transform ConsoleUsageData to ConsoleUsageDataSync format
  const syncData: ConsoleUsageDataSync = {
    currentSession: data.currentSession,
    weeklyLimits: data.weeklyLimits,
    lastUpdated: data.lastUpdated,
    isPartial: data.isPartial,
    extractionErrors: data.extractionErrors,
  };

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

  let statusCode: number | undefined;

  try {
    // POST to EC2 endpoint
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(syncData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    statusCode = response.status;

    // Handle response codes
    if (response.ok) {
      // 2xx - Parse and return SyncResponse
      const syncResponse: SyncResponse = await response.json();
      return syncResponse;
    } else if (response.status === 401) {
      // Authentication failed
      const error = new Error('Sync authentication failed: Invalid API key') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    } else if (response.status === 400) {
      // Validation failed - try to get error message
      let errorMessage = 'Invalid data format';
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorBody.error || errorMessage;
      } catch {
        // Couldn't parse error body, use default message
      }
      const error = new Error(`Sync validation failed: ${errorMessage}`) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    } else {
      // Other error
      const error = new Error(`Sync failed with status ${response.status}: ${response.statusText}`) as Error & { statusCode?: number };
      error.statusCode = response.status;
      throw error;
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Sync network error: Request timeout after 10s');
    }

    // Handle fetch errors (network issues)
    if (error instanceof TypeError) {
      throw new Error(`Sync network error: ${error.message}`);
    }

    // Re-throw errors with statusCode preserved
    throw error;
  }
}

/**
 * Syncs usage data to EC2 endpoint with automatic retry logic
 * @param data - ConsoleUsageData from scraper
 * @param verbose - Enable verbose logging
 * @returns SyncResponse with success status and timestamp
 * @throws Error if all retry attempts fail or error is not retryable
 */
export async function syncWithRetry(
  data: ConsoleUsageData,
  verbose: boolean = false
): Promise<SyncResponse> {
  const strategy = new SyncRetryStrategy();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= strategy.getMaxAttempts(); attempt++) {
    try {
      if (verbose && attempt > 1) {
        console.log(`[Sync Retry] Attempt ${attempt}/${strategy.getMaxAttempts()}...`);
      }

      const response = await syncToEC2(data);

      // Success! Record and return
      strategy.recordSuccess();

      if (verbose && attempt > 1) {
        console.log(`[Sync Retry] Sync succeeded on attempt ${attempt}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      strategy.recordAttempt();

      // Extract status code if available
      const statusCode = (error as any).statusCode;

      // Classify error
      const errorCategory = SyncRetryStrategy.classifyError(lastError, statusCode);
      strategy.recordFailure(errorCategory);

      // Check if we should retry
      if (!strategy.shouldRetry(errorCategory, attempt)) {
        // Non-retryable error or max attempts reached
        if (errorCategory === SyncErrorCategory.AUTH) {
          console.error('[Sync Retry] Authentication failed. No retry.');
        } else if (errorCategory === SyncErrorCategory.VALIDATION) {
          console.error('[Sync Retry] Validation failed. No retry.');
        } else if (attempt >= strategy.getMaxAttempts()) {
          console.error(`[Sync Retry] Max retry attempts (${strategy.getMaxAttempts()}) exhausted.`);
        }
        throw lastError;
      }

      // Calculate delay for next attempt
      const delayMs = strategy.getDelay(attempt);
      const delaySeconds = Math.floor(delayMs / 1000);

      console.error(
        `[Sync Retry] ${errorCategory} error on attempt ${attempt}/${strategy.getMaxAttempts()}: ${lastError.message}`
      );
      console.error(`[Sync Retry] Retrying in ${delaySeconds}s...`);

      if (verbose) {
        console.error(`[Sync Retry] Error category: ${errorCategory}, Next delay: ${delayMs}ms`);
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but throw last error as fallback
  throw lastError || new Error('Sync failed for unknown reason');
}
