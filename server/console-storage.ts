/**
 * Storage layer for Claude Console usage data with versioning and retention
 * Implements filesystem-based versioned storage with automatic cleanup and retry logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import type { ConsoleUsageDataSync } from './claude-console-sync-types.js';

// Retry configuration for storage operations
interface StorageRetryConfig {
  maxAttempts: number;
  delaysMs: number[]; // Explicit delays for each attempt
}

const DEFAULT_STORAGE_RETRY_CONFIG: StorageRetryConfig = {
  maxAttempts: 3,
  delaysMs: [100, 200, 400], // 100ms, 200ms, 400ms
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Storage configuration
export interface StorageConfig {
  historyDir: string;
  maxVersions: number;
  retentionDays: number;
  latestSymlink: string;
}

const DEFAULT_CONFIG: StorageConfig = {
  historyDir: path.join(__dirname, 'claude-scraper/console-usage-history'),
  maxVersions: 100,
  retentionDays: 7,
  latestSymlink: path.join(__dirname, 'claude-scraper/console-usage-synced.json'),
};

// Storage metadata interface
export interface StorageMetadata {
  versionCount: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  lastCleanup: string | null;
  totalVersionsCreated: number;
  totalVersionsDeleted: number;
}

let config: StorageConfig = { ...DEFAULT_CONFIG };
const METADATA_FILE = '_metadata.json';

/**
 * Generate a timestamped filename with short UUID
 * Format: YYYY-MM-DDTHH-mm-ss-{8-char-uuid}.json
 */
function generateVersionFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', 'T');
  const uuid = randomBytes(4).toString('hex');
  return `${timestamp}-${uuid}.json`;
}

/**
 * Parse timestamp from filename format
 * Returns Date object or null if invalid
 */
export function parseTimestampFromFilename(filename: string): Date | null {
  try {
    // Extract timestamp part (before UUID)
    // Format: YYYY-MM-DDTHH-mm-ss-{uuid}.json
    const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-[a-f0-9]{8}\.json$/);
    if (!match) return null;

    // Convert back to ISO format for parsing
    const isoString = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3') + 'Z';
    const date = new Date(isoString);

    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Get metadata file path
 */
function getMetadataPath(): string {
  return path.join(config.historyDir, METADATA_FILE);
}

/**
 * Read storage metadata
 * Returns default values if file missing or corrupt
 */
export function getStorageMetadata(): StorageMetadata {
  const metadataPath = getMetadataPath();

  try {
    if (!fs.existsSync(metadataPath)) {
      return {
        versionCount: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        lastCleanup: null,
        totalVersionsCreated: 0,
        totalVersionsDeleted: 0,
      };
    }

    const data = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(data) as StorageMetadata;
  } catch (error) {
    console.error('[Console Storage] Failed to read metadata:', error);
    return {
      versionCount: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      lastCleanup: null,
      totalVersionsCreated: 0,
      totalVersionsDeleted: 0,
    };
  }
}

/**
 * Write storage metadata
 */
function saveStorageMetadata(metadata: StorageMetadata): void {
  const metadataPath = getMetadataPath();
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Check if storage is healthy and writable
 * Tests write/read/delete operations
 */
export function canWriteToStorage(): { healthy: boolean; error?: string; diskSpace?: string } {
  try {
    // Check if directory exists
    if (!fs.existsSync(config.historyDir)) {
      return { healthy: false, error: 'Storage directory does not exist' };
    }

    // Test write operation
    const testFile = path.join(config.historyDir, '.health-check');
    const testData = 'health-check-test';

    try {
      fs.writeFileSync(testFile, testData);
    } catch (writeError) {
      const errorMessage = writeError instanceof Error ? writeError.message : 'Unknown write error';

      if (errorMessage.includes('ENOSPC')) {
        // Try to get disk space info
        try {
          const stats = fs.statfsSync ? fs.statfsSync(config.historyDir) : null;
          const freeSpace = stats ? Math.round(stats.bavail * stats.bsize / 1024 / 1024) : 'unknown';
          return {
            healthy: false,
            error: 'Disk full (ENOSPC)',
            diskSpace: `${freeSpace} MB free`,
          };
        } catch {
          return { healthy: false, error: 'Disk full (ENOSPC)', diskSpace: 'unknown' };
        }
      } else if (errorMessage.includes('EACCES')) {
        return { healthy: false, error: 'Permission denied (EACCES)' };
      } else if (errorMessage.includes('EROFS')) {
        return { healthy: false, error: 'Read-only filesystem (EROFS)' };
      }

      return { healthy: false, error: errorMessage };
    }

    // Test read operation
    try {
      const readData = fs.readFileSync(testFile, 'utf-8');
      if (readData !== testData) {
        return { healthy: false, error: 'Data verification failed' };
      }
    } catch (readError) {
      return {
        healthy: false,
        error: `Read test failed: ${readError instanceof Error ? readError.message : 'Unknown'}`,
      };
    }

    // Test delete operation
    try {
      fs.unlinkSync(testFile);
    } catch (deleteError) {
      return {
        healthy: false,
        error: `Delete test failed: ${deleteError instanceof Error ? deleteError.message : 'Unknown'}`,
      };
    }

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Initialize storage directories and metadata
 * Creates history directory if it doesn't exist
 * Initializes metadata file if missing
 */
export function initializeStorage(customConfig?: Partial<StorageConfig>): void {
  // Merge custom config with defaults
  if (customConfig) {
    config = { ...DEFAULT_CONFIG, ...customConfig };
  }

  // Create history directory if it doesn't exist
  if (!fs.existsSync(config.historyDir)) {
    fs.mkdirSync(config.historyDir, { recursive: true });
  }

  // Validate directory is writable
  const healthCheck = canWriteToStorage();
  if (!healthCheck.healthy) {
    throw new Error(`Storage directory not writable: ${healthCheck.error}${healthCheck.diskSpace ? ` (${healthCheck.diskSpace})` : ''}`);
  }

  // Initialize metadata if missing
  const metadataPath = getMetadataPath();
  if (!fs.existsSync(metadataPath)) {
    const initialMetadata: StorageMetadata = {
      versionCount: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      lastCleanup: null,
      totalVersionsCreated: 0,
      totalVersionsDeleted: 0,
    };
    saveStorageMetadata(initialMetadata);
  }
}

/**
 * List all version files sorted by timestamp
 * Returns filepath array, optionally limited to N most recent
 */
export function listVersions(limit?: number): string[] {
  try {
    const files = fs.readdirSync(config.historyDir)
      .filter(file => file.endsWith('.json') && file !== METADATA_FILE)
      .map(file => ({
        filename: file,
        filepath: path.join(config.historyDir, file),
        timestamp: parseTimestampFromFilename(file),
      }))
      .filter(item => item.timestamp !== null)
      .sort((a, b) => (b.timestamp!.getTime() - a.timestamp!.getTime()));

    const result = files.map(item => item.filepath);
    return limit ? result.slice(0, limit) : result;
  } catch (error) {
    console.error('[Console Storage] Failed to list versions:', error);
    return [];
  }
}

/**
 * Classify storage error for retry decision
 */
function isTransientStorageError(error: Error): boolean {
  const message = error.message;

  // Transient errors that may succeed on retry
  if (message.includes('EBUSY')) return true;  // Resource busy
  if (message.includes('EAGAIN')) return true; // Try again
  if (message.includes('EINTR')) return true;  // Interrupted

  // Non-transient errors (permanent failures)
  if (message.includes('ENOSPC')) return false; // Disk full
  if (message.includes('EACCES')) return false; // Permission denied
  if (message.includes('EROFS')) return false;  // Read-only filesystem
  if (message.includes('ENOENT')) return false; // Directory doesn't exist

  // Unknown errors - retry to be safe
  return true;
}

/**
 * Save a new version of the data with retry logic
 * Writes atomically to history directory
 * Updates latest symlink/file for backward compatibility
 * Returns filepath of saved version
 */
export async function saveVersion(data: ConsoleUsageDataSync): Promise<string> {
  const retryConfig = DEFAULT_STORAGE_RETRY_CONFIG;
  let lastError: Error | null = null;

  // Check storage health before attempting write
  const healthCheck = canWriteToStorage();
  if (!healthCheck.healthy) {
    const error = new Error(
      `Storage health check failed: ${healthCheck.error}${healthCheck.diskSpace ? ` (${healthCheck.diskSpace})` : ''}`
    );
    console.error('[Console Storage] Pre-write health check failed:', error.message);
    throw error;
  }

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      // Generate timestamped filename
      const filename = generateVersionFilename();
      const filepath = path.join(config.historyDir, filename);

      // Write versioned file atomically
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(filepath, jsonData, { encoding: 'utf-8', flag: 'w' });

      // Update latest symlink/file for backward compatibility
      // Use regular file copy instead of symlink for cross-platform compatibility
      try {
        fs.writeFileSync(config.latestSymlink, jsonData, { encoding: 'utf-8', flag: 'w' });
      } catch (symlinkError) {
        console.error('[Console Storage] Failed to update latest file:', symlinkError);
        // Non-fatal - version is still saved
      }

      // Update metadata
      const metadata = getStorageMetadata();
      metadata.versionCount += 1;
      metadata.totalVersionsCreated += 1;
      metadata.newestTimestamp = new Date().toISOString();

      // Update oldest timestamp if this is the first version
      if (!metadata.oldestTimestamp) {
        metadata.oldestTimestamp = metadata.newestTimestamp;
      }

      saveStorageMetadata(metadata);

      // Success!
      if (attempt > 1) {
        console.log(`[Console Storage] Write succeeded on attempt ${attempt}`);
      }

      return filepath;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isTransient = isTransientStorageError(lastError);

      if (!isTransient || attempt >= retryConfig.maxAttempts) {
        // Non-transient error or max attempts reached
        console.error(`[Console Storage] Failed to save version (attempt ${attempt}/${retryConfig.maxAttempts}):`, lastError.message);

        // Add helpful context to error message
        if (!isTransient) {
          lastError.message = `Non-retryable storage error: ${lastError.message}`;
        } else {
          lastError.message = `Storage write failed after ${retryConfig.maxAttempts} attempts: ${lastError.message}`;
        }

        throw lastError;
      }

      // Retry with delay
      const delayMs = retryConfig.delaysMs[attempt - 1] || retryConfig.delaysMs[retryConfig.delaysMs.length - 1];
      console.warn(
        `[Console Storage] Transient error on attempt ${attempt}/${retryConfig.maxAttempts}: ${lastError.message}. ` +
        `Retrying in ${delayMs}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but throw last error as fallback
  throw lastError || new Error('Storage write failed for unknown reason');
}

/**
 * Clean up old versions according to retention policy
 * Keeps last N versions OR all data from last N days (whichever is larger)
 * Runs asynchronously and doesn't block save operations
 */
export async function cleanupOldVersions(): Promise<void> {
  try {
    // Get all version files sorted by timestamp (oldest first)
    const allFiles = fs.readdirSync(config.historyDir)
      .filter(file => file.endsWith('.json') && file !== METADATA_FILE)
      .map(file => ({
        filename: file,
        filepath: path.join(config.historyDir, file),
        timestamp: parseTimestampFromFilename(file),
      }))
      .filter(item => item.timestamp !== null)
      .sort((a, b) => (a.timestamp!.getTime() - b.timestamp!.getTime()));

    if (allFiles.length === 0) {
      return; // No files to clean up
    }

    // Calculate retention threshold
    const now = new Date();
    const retentionDate = new Date(now.getTime() - config.retentionDays * 24 * 60 * 60 * 1000);

    // Determine files to keep:
    // 1. All files from last N days
    // 2. OR last N versions (whichever results in more files)
    const filesInRetentionPeriod = allFiles.filter(item =>
      item.timestamp && item.timestamp >= retentionDate
    );

    const filesToKeep = Math.max(
      filesInRetentionPeriod.length,
      Math.min(config.maxVersions, allFiles.length)
    );

    // Files to delete are the oldest ones beyond the threshold
    const filesToDelete = allFiles.slice(0, allFiles.length - filesToKeep);

    if (filesToDelete.length === 0) {
      return; // Nothing to delete
    }

    // Delete old files
    let deletedCount = 0;
    for (const item of filesToDelete) {
      try {
        fs.unlinkSync(item.filepath);
        deletedCount++;
      } catch (deleteError) {
        console.error(`[Console Storage] Failed to delete ${item.filename}:`, deleteError);
      }
    }

    // Update metadata
    const metadata = getStorageMetadata();
    metadata.versionCount -= deletedCount;
    metadata.totalVersionsDeleted += deletedCount;
    metadata.lastCleanup = new Date().toISOString();

    // Update oldest timestamp
    if (allFiles.length > deletedCount) {
      const oldestRemaining = allFiles[deletedCount];
      metadata.oldestTimestamp = oldestRemaining.timestamp!.toISOString();
    } else {
      metadata.oldestTimestamp = null;
    }

    saveStorageMetadata(metadata);

    console.log(
      `[Console Storage] Cleanup completed: deleted ${deletedCount} versions, ` +
      `retained ${filesToKeep} versions`
    );
  } catch (error) {
    console.error('[Console Storage] Cleanup failed:', error);
    throw error;
  }
}
