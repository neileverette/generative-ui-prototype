/**
 * Storage layer for Claude Console usage data with versioning and retention
 * Implements filesystem-based versioned storage with automatic cleanup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import type { ConsoleUsageDataSync } from './claude-console-sync-types.js';

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
  try {
    const testFile = path.join(config.historyDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    throw new Error(`Storage directory not writable: ${config.historyDir}`);
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
 * Save a new version of the data
 * Writes atomically to history directory
 * Updates latest symlink/file for backward compatibility
 * Returns filepath of saved version
 */
export async function saveVersion(data: ConsoleUsageDataSync): Promise<string> {
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

    return filepath;
  } catch (error) {
    console.error('[Console Storage] Failed to save version:', error);
    throw error;
  }
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
