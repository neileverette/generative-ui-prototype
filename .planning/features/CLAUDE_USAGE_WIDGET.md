# Claude Usage Tracking Widget

## Overview
A dashboard widget that displays Claude-related usage metrics, split into two sections:
1. **Top**: Claude Code subscription usage (local data)
2. **Bottom**: API Credits usage (external API calls)

## Problem Statement
Users frequently hit Claude Code usage limits without warning. There's no built-in real-time visibility into:
- Current 5-hour window consumption
- Time until limit reset
- Estimated costs
- API credit balance and burn rate

## Goals
- Provide at-a-glance visibility into Claude usage
- Prevent surprise limit hits with progress bars and warnings
- Track spending patterns over time
- Support both subscription (Claude Code) and API credit tracking

---

## Data Sources & Availability

### Claude Code (Subscription) - LOCAL DATA

| Data Point | Source | How to Access |
|------------|--------|---------------|
| Session tokens | Local JSONL files | `~/.claude/projects/**/*.jsonl` |
| 5-hour window usage | Local files + calculation | Parse timestamps from JSONL |
| Estimated cost | Token counts + pricing | Calculate from token usage |
| Model breakdown | Local JSONL files | Parse model field from entries |

**Tools:**
- `ccusage` CLI: `npm install -g ccusage`
  - `ccusage --json` - Structured output
  - `ccusage daily` - Daily breakdown
  - `ccusage session` - Per-session details
  - `ccusage 5h` - 5-hour block tracking

**Direct file access:**
```bash
# Location of Claude Code conversation logs
~/.claude/projects/{project-hash}/*.jsonl
```

### API Credits - ADMIN API (Organizations Only)

| Data Point | Source | Endpoint |
|------------|--------|----------|
| Token usage by model | Usage API | `GET /v1/organizations/usage_report/messages` |
| Cost breakdown | Cost API | `GET /v1/organizations/cost_report` |
| Claude Code analytics | Analytics API | `GET /v1/organizations/usage_report/claude_code` |

**Requirements:**
- Admin API key (`sk-ant-admin-...`)
- Organization account (not available for individual accounts)
- Admin role in the organization

**Note:** Credit balance is NOT available via API - must be entered manually or scraped from Console.

---

## Widget Design Specification

### Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                    Pro Plan    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  5-Hour Window                                              │
│  ████████████████████░░░░░░░░░░  78%                       │
│  Resets in 2h 14m                                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Today     │  │    MTD      │  │  Sessions   │         │
│  │   $4.20     │  │   $48.50    │  │     12      │         │
│  │   est.      │  │   est.      │  │   today     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  Model Usage Today                                          │
│  Opus ████████░░  $3.20  │  Sonnet ██░░░░░░░░  $0.80       │
│  Haiku ░░░░░░░░░░  $0.20                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  API CREDITS                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Balance: $127.45                    Runway: ~73 days       │
│  ████████████████████████████░░░░░░░░░░░░░░░░░░            │
│                                                             │
│  This Month: $52.30              Burn Rate: $1.74/day       │
│                                                             │
│  By Model                                                   │
│  ┌──────────────────────────────────────────────┐          │
│  │ Opus    ████████████████  $28.40  (54%)      │          │
│  │ Sonnet  ██████████        $18.90  (36%)      │          │
│  │ Haiku   ██                $5.00   (10%)      │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  ⚠ Requires Admin API key for live data                    │
│  Last updated: 2 min ago                      ⟳ Refresh    │
└─────────────────────────────────────────────────────────────┘
```

### Component States

**Normal State:**
- Progress bar: Blue/indigo gradient
- All metrics visible

**Warning State (>70% usage):**
- Progress bar: Yellow/amber
- Warning icon appears
- "Approaching limit" text

**Critical State (>90% usage):**
- Progress bar: Red
- Pulse animation on card border
- "Near limit" alert badge

**No Data State:**
- Skeleton loaders for metrics
- "Run ccusage to populate" message for Claude Code section
- "Configure Admin API key" for API section

---

## Technical Implementation

### New Files to Create

```
src/
├── components/
│   └── a2ui/
│       └── ClaudeUsageCard.tsx       # Main widget component
├── types/
│   └── claude-usage.ts               # TypeScript interfaces
├── services/
│   └── claude-usage-client.ts        # Data fetching service
└── config/
    └── claude-usage.config.ts        # Configuration constants
```

### TypeScript Interfaces

```typescript
// src/types/claude-usage.ts

export interface ClaudeCodeUsage {
  plan: 'free' | 'pro' | 'max5' | 'max20';
  fiveHourWindow: {
    used: number;        // tokens used
    limit: number;       // estimated limit
    percentage: number;  // 0-100
    resetsAt: string;    // ISO timestamp
    resetsIn: string;    // human readable "2h 14m"
  };
  today: {
    tokens: number;
    estimatedCost: number;
    sessions: number;
  };
  monthToDate: {
    tokens: number;
    estimatedCost: number;
    sessions: number;
  };
  modelBreakdown: Array<{
    model: 'opus' | 'sonnet' | 'haiku';
    tokens: number;
    cost: number;
    percentage: number;
  }>;
  lastUpdated: string;
  dataSource: 'ccusage' | 'local-files' | 'manual';
}

export interface ApiCreditsUsage {
  balance: number;           // manual entry or scraped
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
    date: string;            // projected depletion date
  };
  modelBreakdown: Array<{
    model: string;
    spend: number;
    percentage: number;
  }>;
  lastUpdated: string;
  dataSource: 'admin-api' | 'manual';
  hasAdminApi: boolean;
}

export interface ClaudeUsageWidgetProps {
  claudeCode: ClaudeCodeUsage | null;
  apiCredits: ApiCreditsUsage | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export type UsageStatus = 'normal' | 'warning' | 'critical';
```

### Configuration

```typescript
// src/config/claude-usage.config.ts

export const CLAUDE_USAGE_CONFIG = {
  // Plan token limits (approximate, dynamic in reality)
  planLimits: {
    free: 10000,
    pro: 44000,
    max5: 88000,
    max20: 220000,
  },

  // Thresholds for status
  thresholds: {
    warning: 70,   // percentage
    critical: 90,  // percentage
  },

  // Pricing per 1M tokens (as of Jan 2025)
  pricing: {
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
    'claude-4-opus': { input: 15.00, output: 75.00 },
    'claude-4-sonnet': { input: 3.00, output: 15.00 },
  },

  // Refresh intervals
  refreshInterval: {
    claudeCode: 300000,   // 5 minutes
    apiCredits: 3600000,  // 1 hour
  },

  // Local storage keys
  storageKeys: {
    config: 'claude-usage-config',
    cache: 'claude-usage-cache',
  },
} as const;
```

### Data Fetching Service

```typescript
// src/services/claude-usage-client.ts

import { ClaudeCodeUsage, ApiCreditsUsage } from '../types/claude-usage';

export const claudeUsageClient = {
  /**
   * Fetch Claude Code usage via backend proxy to ccusage
   */
  async getClaudeCodeUsage(): Promise<ClaudeCodeUsage> {
    const response = await fetch('/api/claude-usage/code');
    if (!response.ok) throw new Error('Failed to fetch Claude Code usage');
    return response.json();
  },

  /**
   * Fetch API credits usage (requires Admin API key)
   */
  async getApiCreditsUsage(): Promise<ApiCreditsUsage> {
    const response = await fetch('/api/claude-usage/api-credits');
    if (!response.ok) throw new Error('Failed to fetch API credits');
    return response.json();
  },

  /**
   * Update manual configuration (balance, plan, etc.)
   */
  async updateConfig(config: Partial<ClaudeUsageConfig>): Promise<void> {
    await fetch('/api/claude-usage/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },
};
```

### Backend Endpoints

Add to `server/index.ts`:

```typescript
// =============================================================================
// CLAUDE USAGE TRACKING
// =============================================================================

/**
 * Get Claude Code usage from local ccusage tool
 */
app.get('/api/claude-usage/code', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Run ccusage with JSON output
    const { stdout } = await execAsync('ccusage --json 2>/dev/null || echo "{}"');
    const rawData = JSON.parse(stdout);

    // Transform to our format
    const usage = transformCcusageData(rawData);
    res.json(usage);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get usage',
      fallback: getManualUsageData(),
    });
  }
});

/**
 * Get API credits usage from Anthropic Admin API
 */
app.get('/api/claude-usage/api-credits', async (req, res) => {
  const adminApiKey = process.env.ANTHROPIC_ADMIN_API_KEY;

  if (!adminApiKey) {
    return res.json({
      hasAdminApi: false,
      dataSource: 'manual',
      // Return manual/cached data
      ...getManualApiCreditsData(),
    });
  }

  try {
    // Fetch from Anthropic Usage API
    const usageResponse = await fetch(
      'https://api.anthropic.com/v1/organizations/usage_report/messages?' +
      `starting_at=${getMonthStart()}&ending_at=${getNow()}&bucket_width=1d`,
      {
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': adminApiKey,
        },
      }
    );

    const usageData = await usageResponse.json();
    const transformed = transformAnthropicUsageData(usageData);
    res.json(transformed);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch',
    });
  }
});

/**
 * Update manual configuration
 */
app.post('/api/claude-usage/config', async (req, res) => {
  const config = req.body;
  // Store in local JSON file or environment
  await saveUsageConfig(config);
  res.json({ success: true });
});
```

### A2UI Component Type

Add to `src/types/a2ui.ts`:

```typescript
export interface ClaudeUsageComponent extends A2UIComponentBase {
  component: 'claude_usage';
  props: {
    claudeCode: ClaudeCodeUsage | null;
    apiCredits: ApiCreditsUsage | null;
    showApiSection: boolean;
  };
}

// Add to ComponentType union
export type ComponentType =
  | 'metric_card'
  | 'card_group'
  | 'data_table'
  | 'alert_list'
  | 'status_indicator'
  | 'progress_bar'
  | 'ecr_summary'
  | 'claude_usage';  // ADD THIS
```

---

## Implementation Phases

### Phase 1: Core Widget (MVP)
- [ ] Create TypeScript interfaces
- [ ] Create ClaudeUsageCard component with static layout
- [ ] Add basic progress bar with status colors
- [ ] Implement skeleton loading states
- [ ] Register component in A2UI registry

### Phase 2: Local Data Integration
- [ ] Create backend endpoint for ccusage
- [ ] Parse JSONL files directly as fallback
- [ ] Calculate 5-hour window from timestamps
- [ ] Display real Claude Code metrics

### Phase 3: API Credits Section
- [ ] Add Admin API integration (if key provided)
- [ ] Create manual entry modal for balance
- [ ] Calculate burn rate and runway
- [ ] Store config in local JSON

### Phase 4: Polish & UX
- [ ] Add refresh button with loading state
- [ ] Implement auto-refresh intervals
- [ ] Add warning/critical animations
- [ ] Create settings modal for configuration

---

## Environment Variables

Add to `.env.local`:

```bash
# Optional: Anthropic Admin API key for organization usage data
# Get from: https://console.anthropic.com/settings/admin-keys
ANTHROPIC_ADMIN_API_KEY=sk-ant-admin-...

# Manual config overrides
CLAUDE_PLAN_TIER=pro  # free | pro | max5 | max20
CLAUDE_API_BALANCE=150.00  # Manual credit balance entry
```

---

## Dependencies

### Required (already installed)
- React 18
- Tailwind CSS
- lucide-react (icons)

### Optional CLI Tools
```bash
# For enhanced local usage tracking
npm install -g ccusage
```

---

## Testing Checklist

- [ ] Widget renders with no data (empty state)
- [ ] Widget renders with mock Claude Code data
- [ ] Widget renders with mock API Credits data
- [ ] Progress bar shows correct percentage
- [ ] Warning state triggers at 70%
- [ ] Critical state triggers at 90%
- [ ] Refresh button works
- [ ] Manual balance entry saves correctly
- [ ] Responsive on mobile

---

## API Reference

### Anthropic Admin API

**Usage Report Endpoint:**
```
GET https://api.anthropic.com/v1/organizations/usage_report/messages
```

Parameters:
- `starting_at` (required): ISO 8601 timestamp
- `ending_at` (required): ISO 8601 timestamp
- `bucket_width`: `1m` | `1h` | `1d`
- `group_by[]`: `model` | `workspace_id` | `api_key_id`

**Cost Report Endpoint:**
```
GET https://api.anthropic.com/v1/organizations/cost_report
```

Parameters:
- `starting_at` (required): ISO 8601 timestamp
- `ending_at` (required): ISO 8601 timestamp
- `group_by[]`: `workspace_id` | `description`

**Headers:**
```
anthropic-version: 2023-06-01
x-api-key: sk-ant-admin-...
```

---

## Resources

- [Anthropic Usage & Cost API](https://platform.claude.com/docs/en/api/usage-cost-api)
- [Claude Code Analytics API](https://platform.claude.com/docs/en/build-with-claude/claude-code-analytics-api)
- [ccusage GitHub](https://github.com/ryoppippi/ccusage)
- [Claude Code Cost Management](https://code.claude.com/docs/en/costs)
- [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor)

---

## Notes

### Limitations
1. **No real-time limit API**: Claude Code limits are dynamic and not exposed via API
2. **Credit balance not in API**: Must be manually entered or scraped from Console
3. **Admin API org-only**: Individual accounts cannot access Usage/Cost APIs
4. **5-hour window is rolling**: Calculations are approximations

### Future Enhancements
- Browser extension to scrape Console data
- Webhook alerts when approaching limits
- Historical trend charts
- Team usage comparison (for orgs)
- Integration with cost anomaly detection
