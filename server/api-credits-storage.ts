/**
 * API Credits Storage & Calculation
 *
 * Handles storage of manual credit balance entries and calculates
 * burn rate and runway projections.
 */

import fs from 'fs';
import path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export interface BalanceEntry {
  balance: number;
  timestamp: string;
  source: 'manual' | 'admin-api';
}

export interface ApiCreditsStorage {
  currentBalance: number;
  balanceHistory: BalanceEntry[];
  lastUpdated: string;
  hasAdminApi: boolean;
  adminApiKey?: string; // encrypted or just stored (for future use)
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ApiCreditsUsage {
  balance: number;
  thisMonth: {
    spend: number;
    startDate: string;
  };
  burnRate: {
    daily: number;
    monthly: number;
  };
  runway: {
    days: number;
    date: string;
  };
  modelBreakdown: Array<{
    model: string;
    spend: number;
    percentage: number;
  }>;
  // Token usage from Admin API
  tokenUsage?: {
    today: TokenUsage;
    monthToDate: TokenUsage;
    modelBreakdown: Array<{
      model: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      percentage: number;
    }>;
  };
  lastUpdated: string;
  dataSource: 'admin-api' | 'manual';
  hasAdminApi: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG_DIR = '.config';
const STORAGE_FILE = 'api-credits.json';

function getStoragePath(): string {
  const projectRoot = process.cwd();
  return path.join(projectRoot, CONFIG_DIR, STORAGE_FILE);
}

function ensureConfigDir(): void {
  const configDir = path.join(process.cwd(), CONFIG_DIR);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// =============================================================================
// STORAGE OPERATIONS
// =============================================================================

/**
 * Load credits data from storage file
 */
export function loadCredits(): ApiCreditsStorage | null {
  const storagePath = getStoragePath();

  if (!fs.existsSync(storagePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(storagePath, 'utf-8');
    return JSON.parse(data) as ApiCreditsStorage;
  } catch (error) {
    console.error('[API Credits] Error loading storage:', error);
    return null;
  }
}

/**
 * Save credits data to storage file
 */
export function saveCredits(storage: ApiCreditsStorage): void {
  ensureConfigDir();
  const storagePath = getStoragePath();

  try {
    fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2));
    console.log('[API Credits] Storage saved to:', storagePath);
  } catch (error) {
    console.error('[API Credits] Error saving storage:', error);
    throw error;
  }
}

/**
 * Update the current balance with a new entry
 */
export function updateBalance(
  balance: number,
  source: 'manual' | 'admin-api' = 'manual'
): ApiCreditsStorage {
  const existing = loadCredits();
  const now = new Date().toISOString();

  const newEntry: BalanceEntry = {
    balance,
    timestamp: now,
    source,
  };

  const storage: ApiCreditsStorage = {
    currentBalance: balance,
    balanceHistory: existing
      ? [...existing.balanceHistory, newEntry].slice(-100) // Keep last 100 entries
      : [newEntry],
    lastUpdated: now,
    hasAdminApi: existing?.hasAdminApi || false,
    adminApiKey: existing?.adminApiKey,
  };

  saveCredits(storage);
  return storage;
}

/**
 * Save Admin API key to storage
 */
export function saveAdminApiKey(apiKey: string): void {
  const existing = loadCredits();
  const now = new Date().toISOString();

  const storage: ApiCreditsStorage = existing
    ? {
        ...existing,
        hasAdminApi: true,
        adminApiKey: apiKey,
        lastUpdated: now,
      }
    : {
        currentBalance: 0,
        balanceHistory: [],
        lastUpdated: now,
        hasAdminApi: true,
        adminApiKey: apiKey,
      };

  saveCredits(storage);
}

/**
 * Get Admin API key from storage
 */
export function getAdminApiKey(): string | null {
  const storage = loadCredits();
  return storage?.adminApiKey || null;
}

/**
 * Check if Admin API is configured
 */
export function hasAdminApiConfigured(): boolean {
  const storage = loadCredits();
  return storage?.hasAdminApi || false;
}

// =============================================================================
// BURN RATE CALCULATION
// =============================================================================

/**
 * Calculate burn rate from balance history
 */
export function calculateBurnRate(history: BalanceEntry[]): {
  daily: number;
  monthly: number;
} {
  if (history.length < 2) {
    return { daily: 0, monthly: 0 };
  }

  // Sort by timestamp (oldest first)
  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate total spend and time period
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];

  const balanceChange = oldest.balance - newest.balance;
  const msElapsed =
    new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime();
  const daysElapsed = msElapsed / (24 * 60 * 60 * 1000);

  if (daysElapsed < 0.01 || balanceChange <= 0) {
    // Not enough time or balance increased (deposit)
    return { daily: 0, monthly: 0 };
  }

  const dailyRate = balanceChange / daysElapsed;

  return {
    daily: parseFloat(dailyRate.toFixed(2)),
    monthly: parseFloat((dailyRate * 30).toFixed(2)),
  };
}

/**
 * Calculate runway (days until balance depleted)
 */
export function calculateRunway(
  balance: number,
  dailyBurnRate: number
): { days: number; date: string } {
  if (dailyBurnRate <= 0 || balance <= 0) {
    return {
      days: 999, // Effectively infinite
      date: new Date(Date.now() + 999 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const days = Math.floor(balance / dailyBurnRate);
  const depletionDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return {
    days,
    date: depletionDate.toISOString(),
  };
}

/**
 * Calculate this month's spend from history
 */
export function calculateMonthSpend(history: BalanceEntry[]): {
  spend: number;
  startDate: string;
} {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartISO = monthStart.toISOString();

  // Filter entries from this month
  const monthEntries = history.filter(
    (e) => new Date(e.timestamp) >= monthStart
  );

  if (monthEntries.length < 2) {
    return { spend: 0, startDate: monthStartISO };
  }

  // Sort by timestamp
  const sorted = [...monthEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Spend = first entry balance - last entry balance
  const spend = Math.max(0, sorted[0].balance - sorted[sorted.length - 1].balance);

  return {
    spend: parseFloat(spend.toFixed(2)),
    startDate: monthStartISO,
  };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Get API credits usage data
 */
export function getApiCreditsUsage(): ApiCreditsUsage | null {
  const storage = loadCredits();

  if (!storage) {
    return null;
  }

  const burnRate = calculateBurnRate(storage.balanceHistory);
  const runway = calculateRunway(storage.currentBalance, burnRate.daily);
  const thisMonth = calculateMonthSpend(storage.balanceHistory);

  return {
    balance: storage.currentBalance,
    thisMonth,
    burnRate,
    runway,
    modelBreakdown: [], // Would require Admin API for actual breakdown
    lastUpdated: storage.lastUpdated,
    dataSource: storage.hasAdminApi ? 'admin-api' : 'manual',
    hasAdminApi: storage.hasAdminApi,
  };
}
