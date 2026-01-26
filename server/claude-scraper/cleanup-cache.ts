/**
 * Cleanup utility for Playwright browser cache
 * Clears cache while preserving authentication cookies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '.session');

interface CleanupStats {
  bytesFreed: number;
  filesDeleted: number;
  directoriesProcessed: number;
}

/**
 * Recursively calculate directory size
 */
function getDirectorySize(dirPath: string): number {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }

  return totalSize;
}

/**
 * Recursively delete directory contents
 */
function deleteDirContents(dirPath: string, stats: CleanupStats): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const fileStats = fs.statSync(filePath);

    if (fileStats.isDirectory()) {
      deleteDirContents(filePath, stats);
      fs.rmdirSync(filePath);
      stats.directoriesProcessed++;
    } else {
      stats.bytesFreed += fileStats.size;
      fs.unlinkSync(filePath);
      stats.filesDeleted++;
    }
  }
}

/**
 * Clean browser cache while preserving cookies and session data
 */
export async function cleanupCache(verbose = false): Promise<CleanupStats> {
  const stats: CleanupStats = {
    bytesFreed: 0,
    filesDeleted: 0,
    directoriesProcessed: 0,
  };

  if (!fs.existsSync(USER_DATA_DIR)) {
    if (verbose) {
      console.log('[Cleanup] Session directory does not exist, nothing to clean');
    }
    return stats;
  }

  // Calculate size before cleanup
  const sizeBefore = getDirectorySize(USER_DATA_DIR);

  if (verbose) {
    console.log(`[Cleanup] Session directory size: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB`);
  }

  // Directories to clean (cache directories that can grow large)
  const dirsToClean = [
    'Default/Cache',
    'Default/Code Cache',
    'GraphiteDawnCache',
    'Default/Service Worker/CacheStorage',
    'Default/Application Cache',
    'BrowserMetrics',
  ];

  for (const dir of dirsToClean) {
    const dirPath = path.join(USER_DATA_DIR, dir);

    if (fs.existsSync(dirPath)) {
      if (verbose) {
        const dirSize = getDirectorySize(dirPath);
        console.log(`[Cleanup] Cleaning ${dir} (${(dirSize / 1024 / 1024).toFixed(2)} MB)...`);
      }

      deleteDirContents(dirPath, stats);
    }
  }

  // Calculate size after cleanup
  const sizeAfter = getDirectorySize(USER_DATA_DIR);
  const actualFreed = sizeBefore - sizeAfter;

  if (verbose) {
    console.log(`[Cleanup] Freed ${(actualFreed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[Cleanup] Deleted ${stats.filesDeleted} files from ${stats.directoriesProcessed} directories`);
    console.log(`[Cleanup] Session directory size after cleanup: ${(sizeAfter / 1024 / 1024).toFixed(2)} MB`);
  }

  return {
    ...stats,
    bytesFreed: actualFreed,
  };
}

/**
 * Check if cleanup is needed based on size threshold
 */
export function shouldCleanup(thresholdMB = 50): boolean {
  if (!fs.existsSync(USER_DATA_DIR)) {
    return false;
  }

  const size = getDirectorySize(USER_DATA_DIR);
  const sizeMB = size / 1024 / 1024;

  return sizeMB > thresholdMB;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  console.log('[Cleanup] Starting browser cache cleanup...');

  cleanupCache(verbose)
    .then((stats) => {
      console.log('[Cleanup] ✓ Cleanup complete');
      console.log(`[Cleanup] Freed ${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
    })
    .catch((error) => {
      console.error('[Cleanup] Error during cleanup:', error);
      process.exit(1);
    });
}
