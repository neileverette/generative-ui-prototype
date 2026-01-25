/**
 * EC2 Sync Client
 * POSTs Claude Console usage data to EC2 endpoint
 *
 * Usage: import { syncToEC2 } from './sync-client.js'
 */

import type { ConsoleUsageData } from './scrape.js';
import type { ConsoleUsageDataSync, SyncResponse } from '../claude-console-sync-types.js';

const DEFAULT_SYNC_URL = 'http://localhost:4000/api/claude/console-usage';
const SYNC_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Syncs usage data to EC2 endpoint
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

    // Handle response codes
    if (response.ok) {
      // 2xx - Parse and return SyncResponse
      const syncResponse: SyncResponse = await response.json();
      return syncResponse;
    } else if (response.status === 401) {
      // Authentication failed
      throw new Error('Sync authentication failed: Invalid API key');
    } else if (response.status === 400) {
      // Validation failed - try to get error message
      let errorMessage = 'Invalid data format';
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorBody.error || errorMessage;
      } catch {
        // Couldn't parse error body, use default message
      }
      throw new Error(`Sync validation failed: ${errorMessage}`);
    } else {
      // Other error
      throw new Error(`Sync failed with status ${response.status}: ${response.statusText}`);
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

    // Re-throw our own errors
    throw error;
  }
}
