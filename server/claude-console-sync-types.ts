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
