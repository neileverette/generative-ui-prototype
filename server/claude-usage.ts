/**
 * Claude Code Usage Tracking
 *
 * Parses JSONL files from ~/.claude/projects/ to calculate usage metrics
 * for the Claude Usage Widget.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
// =============================================================================
// TYPES (inlined to avoid tsconfig.node.json cross-boundary imports)
// =============================================================================

// Plan tiers for Claude Code subscription
export type ClaudePlanTier = 'free' | 'pro' | 'max5' | 'max20';

// Five-hour rolling window usage tracking
export interface FiveHourWindow {
  used: number;
  limit: number;
  percentage: number;
  resetsAt: string;
  resetsIn: string;
}

// Daily or month-to-date usage statistics
export interface UsageStats {
  tokens: number;
  estimatedCost: number;
  sessions: number;
}

// Per-model usage breakdown
export interface ModelUsage {
  model: 'opus' | 'sonnet' | 'haiku';
  tokens: number;
  cost: number;
  percentage: number;
}

// Claude Code subscription usage data
export interface ClaudeCodeUsage {
  plan: ClaudePlanTier;
  fiveHourWindow: FiveHourWindow;
  today: UsageStats;
  monthToDate: UsageStats;
  modelBreakdown: ModelUsage[];
  lastUpdated: string;
  dataSource: 'ccusage' | 'local-files' | 'manual';
}

interface UsageEntry {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

// =============================================================================
// CONFIGURATION (inline to avoid ESM import issues)
// =============================================================================

const PLAN_LIMITS: Record<ClaudePlanTier, number> = {
  free: 10000,
  pro: 44000,
  max5: 88000,
  max20: 220000,
};

const PRICING: Record<string, { input: number; output: number }> = {
  opus: { input: 15.0, output: 75.0 },
  sonnet: { input: 3.0, output: 15.0 },
  haiku: { input: 0.25, output: 1.25 },
};

// =============================================================================
// PATH UTILITIES
// =============================================================================

/**
 * Get the Claude projects directory path
 */
export function getClaudeProjectsDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.claude', 'projects');
}

/**
 * Convert project path to Claude directory name format
 * e.g., /Users/neil/Desktop/myproject -> -Users-neil-Desktop-myproject
 */
export function projectPathToDirName(projectPath: string): string {
  // Claude Code uses dashes for slashes and keeps the leading dash
  return projectPath.replace(/\//g, '-');
}

/**
 * Get all JSONL files for a project
 */
export function getProjectJSONLFiles(projectDirName: string): string[] {
  const projectsDir = getClaudeProjectsDir();
  const projectDir = path.join(projectsDir, projectDirName);

  if (!fs.existsSync(projectDir)) {
    return [];
  }

  return fs
    .readdirSync(projectDir)
    .filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'))
    .map((f) => path.join(projectDir, f));
}

// =============================================================================
// JSONL PARSING
// =============================================================================

/**
 * Parse a single JSONL file for usage entries
 */
export async function parseJSONLFile(filePath: string): Promise<UsageEntry[]> {
  const entries: UsageEntry[] = [];

  if (!fs.existsSync(filePath)) {
    return entries;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);

      // Only process assistant messages with usage data
      if (data.type === 'assistant' && data.message?.usage) {
        const usage = data.message.usage;
        entries.push({
          timestamp: data.timestamp,
          model: data.message.model || 'unknown',
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheCreationTokens: usage.cache_creation_input_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

// =============================================================================
// CALCULATION UTILITIES
// =============================================================================

/**
 * Filter entries to last 5 hours
 */
export function filterToFiveHourWindow(entries: UsageEntry[]): UsageEntry[] {
  const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
  return entries.filter((e) => new Date(e.timestamp).getTime() >= fiveHoursAgo);
}

/**
 * Calculate when the 5-hour window resets
 */
export function calculateResetTime(windowEntries: UsageEntry[]): {
  resetsAt: string;
  resetsIn: string;
} {
  if (windowEntries.length === 0) {
    // If no entries, window resets in 5 hours from now
    const resetsAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
    return {
      resetsAt: resetsAt.toISOString(),
      resetsIn: '5h 0m',
    };
  }

  // Find the oldest entry in the window
  const timestamps = windowEntries.map((e) => new Date(e.timestamp).getTime());
  const oldestEntry = Math.min(...timestamps);

  // Window resets 5 hours after the oldest entry
  const resetsAt = new Date(oldestEntry + 5 * 60 * 60 * 1000);
  const msUntilReset = resetsAt.getTime() - Date.now();

  if (msUntilReset <= 0) {
    // Window has already reset, calculate new reset time
    return calculateResetTime([]);
  }

  const hours = Math.floor(msUntilReset / (60 * 60 * 1000));
  const minutes = Math.floor((msUntilReset % (60 * 60 * 1000)) / (60 * 1000));

  return {
    resetsAt: resetsAt.toISOString(),
    resetsIn: `${hours}h ${minutes}m`,
  };
}

/**
 * Normalize model identifier to short name
 */
export function normalizeModelName(model: string): 'opus' | 'sonnet' | 'haiku' {
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  // Default to sonnet for any other model
  return 'sonnet';
}

/**
 * Aggregate usage by model
 */
export function aggregateByModel(
  entries: UsageEntry[]
): Map<string, { tokens: number; inputTokens: number; outputTokens: number }> {
  const modelUsage = new Map<
    string,
    { tokens: number; inputTokens: number; outputTokens: number }
  >();

  for (const entry of entries) {
    const modelKey = normalizeModelName(entry.model);
    const existing = modelUsage.get(modelKey) || {
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    const totalTokens =
      entry.inputTokens +
      entry.outputTokens +
      entry.cacheCreationTokens +
      entry.cacheReadTokens;

    modelUsage.set(modelKey, {
      tokens: existing.tokens + totalTokens,
      inputTokens:
        existing.inputTokens +
        entry.inputTokens +
        entry.cacheCreationTokens +
        entry.cacheReadTokens,
      outputTokens: existing.outputTokens + entry.outputTokens,
    });
  }

  return modelUsage;
}

/**
 * Estimate cost based on token usage
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const normalizedModel = normalizeModelName(model);
  const rates = PRICING[normalizedModel] || PRICING.sonnet;

  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}

/**
 * Create an empty usage response
 */
function createEmptyUsageResponse(plan: ClaudePlanTier): ClaudeCodeUsage {
  return {
    plan,
    fiveHourWindow: {
      used: 0,
      limit: PLAN_LIMITS[plan],
      percentage: 0,
      resetsAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      resetsIn: '5h 0m',
    },
    today: { tokens: 0, estimatedCost: 0, sessions: 0 },
    monthToDate: { tokens: 0, estimatedCost: 0, sessions: 0 },
    modelBreakdown: [],
    lastUpdated: new Date().toISOString(),
    dataSource: 'local-files',
  };
}

// =============================================================================
// MAIN AGGREGATION FUNCTION
// =============================================================================

/**
 * Get usage for a specific project directory
 */
export async function getClaudeCodeUsage(
  projectPath: string,
  plan: ClaudePlanTier = 'pro'
): Promise<ClaudeCodeUsage> {
  // Check if Claude directory exists
  const projectsDir = getClaudeProjectsDir();
  if (!fs.existsSync(projectsDir)) {
    console.log('[Claude Usage] Projects directory not found:', projectsDir);
    return createEmptyUsageResponse(plan);
  }

  // Convert project path to directory name
  const projectDirName = projectPathToDirName(projectPath);
  const projectDirPath = path.join(projectsDir, projectDirName);

  // Check if project directory exists
  if (!fs.existsSync(projectDirPath)) {
    console.log('[Claude Usage] Project directory not found:', projectDirPath);
    return createEmptyUsageResponse(plan);
  }

  // Get JSONL files
  const jsonlFiles = getProjectJSONLFiles(projectDirName);
  if (jsonlFiles.length === 0) {
    console.log('[Claude Usage] No JSONL files found for project');
    return createEmptyUsageResponse(plan);
  }

  // Parse all JSONL files
  const allEntries: UsageEntry[] = [];
  for (const file of jsonlFiles) {
    const entries = await parseJSONLFile(file);
    allEntries.push(...entries);
  }

  // Sort by timestamp
  allEntries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate 5-hour window
  const windowEntries = filterToFiveHourWindow(allEntries);
  const windowTokens = windowEntries.reduce(
    (sum, e) =>
      sum +
      e.inputTokens +
      e.outputTokens +
      e.cacheCreationTokens +
      e.cacheReadTokens,
    0
  );
  const planLimit = PLAN_LIMITS[plan];
  const windowPercentage = Math.min(100, (windowTokens / planLimit) * 100);
  const resetInfo = calculateResetTime(windowEntries);

  // Calculate today's usage
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = allEntries.filter(
    (e) => new Date(e.timestamp) >= todayStart
  );
  const todayTokens = todayEntries.reduce(
    (sum, e) =>
      sum +
      e.inputTokens +
      e.outputTokens +
      e.cacheCreationTokens +
      e.cacheReadTokens,
    0
  );

  // Count today's sessions (files modified today)
  const todaySessions = jsonlFiles.filter((f) => {
    try {
      const stat = fs.statSync(f);
      return stat.mtime >= todayStart;
    } catch {
      return false;
    }
  }).length;

  // Calculate MTD usage
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const mtdEntries = allEntries.filter(
    (e) => new Date(e.timestamp) >= monthStart
  );
  const mtdTokens = mtdEntries.reduce(
    (sum, e) =>
      sum +
      e.inputTokens +
      e.outputTokens +
      e.cacheCreationTokens +
      e.cacheReadTokens,
    0
  );

  // Calculate model breakdown (today)
  const modelAgg = aggregateByModel(todayEntries);
  const totalTodayCost = Array.from(modelAgg.entries()).reduce(
    (sum, [model, usage]) =>
      sum + estimateCost(usage.inputTokens, usage.outputTokens, model),
    0
  );

  const modelBreakdown: ModelUsage[] = Array.from(modelAgg.entries())
    .map(([model, usage]) => ({
      model: model as 'opus' | 'sonnet' | 'haiku',
      tokens: usage.tokens,
      cost: estimateCost(usage.inputTokens, usage.outputTokens, model),
      percentage: todayTokens > 0 ? (usage.tokens / todayTokens) * 100 : 0,
    }))
    .filter((m) => m.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);

  // Calculate MTD cost
  const mtdModelAgg = aggregateByModel(mtdEntries);
  const mtdCost = Array.from(mtdModelAgg.entries()).reduce(
    (sum, [model, usage]) =>
      sum + estimateCost(usage.inputTokens, usage.outputTokens, model),
    0
  );

  console.log(
    `[Claude Usage] Parsed ${allEntries.length} entries from ${jsonlFiles.length} files`
  );
  console.log(
    `[Claude Usage] 5hr window: ${windowTokens} tokens (${windowPercentage.toFixed(1)}%)`
  );

  return {
    plan,
    fiveHourWindow: {
      used: windowTokens,
      limit: planLimit,
      percentage: parseFloat(windowPercentage.toFixed(1)),
      resetsAt: resetInfo.resetsAt,
      resetsIn: resetInfo.resetsIn,
    },
    today: {
      tokens: todayTokens,
      estimatedCost: parseFloat(totalTodayCost.toFixed(2)),
      sessions: todaySessions,
    },
    monthToDate: {
      tokens: mtdTokens,
      estimatedCost: parseFloat(mtdCost.toFixed(2)),
      sessions: jsonlFiles.length,
    },
    modelBreakdown,
    lastUpdated: new Date().toISOString(),
    dataSource: 'local-files',
  };
}
