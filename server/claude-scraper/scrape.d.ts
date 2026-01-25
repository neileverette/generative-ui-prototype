/**
 * Claude Console Usage Scraper
 * Runs headlessly using saved session, extracts usage data
 *
 * Usage: npx ts-node server/claude-scraper/scrape.ts
 */
export interface ConsoleUsageData {
    currentSession: {
        resetsIn: string;
        percentageUsed: number;
    };
    weeklyLimits: {
        allModels: {
            resetsIn: string;
            percentageUsed: number;
        };
        sonnetOnly: {
            resetsIn: string;
            percentageUsed: number;
        };
    };
    lastUpdated: string;
    error?: string;
}
declare function scrape(): Promise<ConsoleUsageData>;
export { scrape };
