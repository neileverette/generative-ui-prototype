/**
 * Anthropic Admin API Client
 *
 * Fetches usage data from the Anthropic Admin API for token tracking.
 * Requires an Admin API key (starts with sk-ant-admin...).
 *
 * API Reference:
 * - Usage Report: GET /v1/organizations/usage_report/messages
 * - Cost Report: GET /v1/organizations/cost_report
 */

// =============================================================================
// TYPES
// =============================================================================

export interface UsageReportParams {
  starting_at: string; // ISO 8601 timestamp
  ending_at: string; // ISO 8601 timestamp
  bucket_width?: '1d' | '1h' | '1m'; // Granularity
  group_by?: ('model' | 'workspace_id')[];
}

export interface UsageResult {
  uncached_input_tokens: number;
  cache_creation?: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  cache_read_input_tokens: number;
  output_tokens: number;
  model?: string;
  workspace_id?: string;
}

export interface UsageReportBucket {
  starting_at: string;
  ending_at: string;
  results: UsageResult[];
}

export interface UsageReportResponse {
  data: UsageReportBucket[];
  has_more: boolean;
  next_page: string | null;
}

export interface TokenUsageData {
  today: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  monthToDate: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  modelBreakdown: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    percentage: number;
  }>;
  lastUpdated: string;
}

// =============================================================================
// API CLIENT
// =============================================================================

const ADMIN_API_BASE_URL = 'https://api.anthropic.com/v1';

/**
 * Fetch usage report from Anthropic Admin API
 */
async function fetchUsageReport(
  apiKey: string,
  params: UsageReportParams
): Promise<UsageReportResponse> {
  const url = new URL(`${ADMIN_API_BASE_URL}/organizations/usage_report/messages`);

  // Add query parameters
  url.searchParams.set('starting_at', params.starting_at);
  url.searchParams.set('ending_at', params.ending_at);

  if (params.bucket_width) {
    url.searchParams.set('bucket_width', params.bucket_width);
  }

  if (params.group_by && params.group_by.length > 0) {
    params.group_by.forEach((group) => {
      url.searchParams.append('group_by[]', group);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic Admin API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('[Admin API] Response:', JSON.stringify(data, null, 2));
  return data;
}

/**
 * Get today's date range (midnight to now in UTC)
 */
function getTodayRange(): { starting_at: string; ending_at: string } {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return {
    starting_at: todayStart.toISOString(),
    ending_at: now.toISOString(),
  };
}

/**
 * Get month-to-date range (first of month to now in UTC)
 */
function getMonthRange(): { starting_at: string; ending_at: string } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return {
    starting_at: monthStart.toISOString(),
    ending_at: now.toISOString(),
  };
}

/**
 * Aggregate token counts from usage report response
 */
function aggregateTokens(response: UsageReportResponse): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  let inputTokens = 0;
  let outputTokens = 0;

  for (const bucket of response.data) {
    for (const result of bucket.results) {
      inputTokens += result.uncached_input_tokens || 0;
      inputTokens += result.cache_read_input_tokens || 0;
      if (result.cache_creation) {
        inputTokens += result.cache_creation.ephemeral_1h_input_tokens || 0;
        inputTokens += result.cache_creation.ephemeral_5m_input_tokens || 0;
      }
      outputTokens += result.output_tokens || 0;
    }
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/**
 * Get model breakdown from usage report response
 */
function getModelBreakdown(
  response: UsageReportResponse,
  totalTokens: number
): TokenUsageData['modelBreakdown'] {
  const modelMap = new Map<
    string,
    { inputTokens: number; outputTokens: number; totalTokens: number }
  >();

  for (const bucket of response.data) {
    for (const result of bucket.results) {
      const model = result.model || 'unknown';
      const existing = modelMap.get(model) || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

      let input = result.uncached_input_tokens || 0;
      input += result.cache_read_input_tokens || 0;
      if (result.cache_creation) {
        input += result.cache_creation.ephemeral_1h_input_tokens || 0;
        input += result.cache_creation.ephemeral_5m_input_tokens || 0;
      }
      const output = result.output_tokens || 0;

      modelMap.set(model, {
        inputTokens: existing.inputTokens + input,
        outputTokens: existing.outputTokens + output,
        totalTokens: existing.totalTokens + input + output,
      });
    }
  }

  return Array.from(modelMap.entries())
    .map(([model, usage]) => ({
      model: normalizeModelName(model),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      percentage: totalTokens > 0 ? (usage.totalTokens / totalTokens) * 100 : 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

/**
 * Normalize model name to display name
 */
function normalizeModelName(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Fetch all pages of usage report (handles pagination)
 */
async function fetchAllUsageReportPages(
  apiKey: string,
  params: UsageReportParams
): Promise<UsageReportResponse> {
  const allData: UsageReportBucket[] = [];
  let nextPage: string | null = null;

  do {
    const url = new URL(`${ADMIN_API_BASE_URL}/organizations/usage_report/messages`);
    url.searchParams.set('starting_at', params.starting_at);
    url.searchParams.set('ending_at', params.ending_at);

    if (params.bucket_width) {
      url.searchParams.set('bucket_width', params.bucket_width);
    }

    if (params.group_by && params.group_by.length > 0) {
      params.group_by.forEach((group) => {
        url.searchParams.append('group_by[]', group);
      });
    }

    if (nextPage) {
      url.searchParams.set('page', nextPage);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic Admin API error: ${response.status} - ${errorText}`);
    }

    const data: UsageReportResponse = await response.json();
    allData.push(...data.data);
    nextPage = data.has_more ? data.next_page : null;
  } while (nextPage);

  return { data: allData, has_more: false, next_page: null };
}

// =============================================================================
// CACHING
// =============================================================================

interface CachedData {
  data: TokenUsageData;
  timestamp: number;
}

let tokenUsageCache: CachedData | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get token usage data from Anthropic Admin API
 *
 * Returns today's tokens and month-to-date tokens with model breakdown.
 * Results are cached for 30 minutes to prevent rate limiting.
 */
export async function getAnthropicTokenUsage(apiKey: string): Promise<TokenUsageData> {
  // Check cache first
  if (tokenUsageCache && Date.now() - tokenUsageCache.timestamp < CACHE_TTL_MS) {
    console.log('[Admin API] Returning cached data');
    return tokenUsageCache.data;
  }

  // Fetch today's usage
  const todayRange = getTodayRange();
  const todayResponse = await fetchAllUsageReportPages(apiKey, {
    ...todayRange,
    bucket_width: '1d',
    group_by: ['model'],
  });

  // Fetch month-to-date usage
  const monthRange = getMonthRange();
  const monthResponse = await fetchAllUsageReportPages(apiKey, {
    ...monthRange,
    bucket_width: '1d',
    group_by: ['model'],
  });

  // Aggregate today's tokens
  const todayTokens = aggregateTokens(todayResponse);

  // Aggregate month-to-date tokens
  const monthTokens = aggregateTokens(monthResponse);

  // Get model breakdown from month data
  const modelBreakdown = getModelBreakdown(monthResponse, monthTokens.totalTokens);

  const result: TokenUsageData = {
    today: todayTokens,
    monthToDate: monthTokens,
    modelBreakdown,
    lastUpdated: new Date().toISOString(),
  };

  // Cache the result
  tokenUsageCache = {
    data: result,
    timestamp: Date.now(),
  };

  return result;
}

/**
 * Validate an Admin API key by making a test request
 */
export async function validateAdminApiKey(apiKey: string): Promise<boolean> {
  try {
    // Make a minimal request to test the key
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    await fetchUsageReport(apiKey, {
      starting_at: oneHourAgo.toISOString(),
      ending_at: now.toISOString(),
      bucket_width: '1h',
    });

    return true;
  } catch (error) {
    console.error('[Admin API] Key validation failed:', error);
    return false;
  }
}
