/**
 * TypeScript interfaces for Claude Console usage data sync
 * Used for scraper-to-EC2 data synchronization
 */

export interface ConsoleUsageDataSync {
  currentSession?: {
    resetsIn: string;
    percentageUsed: number;
  };
  weeklyLimits?: {
    allModels: {
      resetsIn: string;
      percentageUsed: number;
    };
    sonnetOnly: {
      resetsIn: string;
      percentageUsed: number;
    };
  };
  lastUpdated: string; // ISO 8601 timestamp
  isPartial?: boolean;
  extractionErrors?: Record<string, string>;
}

export interface SyncResponse {
  success: boolean;
  message: string;
  timestamp: string; // ISO 8601 timestamp
}

export interface StorageMetadata {
  versionCount: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  lastCleanup: string | null;
  totalVersionsCreated: number;
  totalVersionsDeleted: number;
}

export interface ConsoleUsageResponse extends ConsoleUsageDataSync {
  // Metadata fields
  isStale: boolean;           // true if data age > 10 minutes
  ageMinutes: number;         // age since lastUpdated
  source: 'ec2-sync';         // distinguish from local scraper
  versionInfo: {
    current: number;          // 1-based version number
    total: number;            // total versions available
    timestamp: string;        // file creation timestamp
    filename: string;         // version filename
  };
}
