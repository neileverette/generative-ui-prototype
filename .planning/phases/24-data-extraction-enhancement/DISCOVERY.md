# Phase 24: Data Extraction Enhancement - Discovery

## Research Goal

Understand what additional usage metrics and billing data are available in the Claude Console (console.anthropic.com) to extract beyond the current session and weekly limits data.

## Current Data Extracted

From Phase 23, the scraper currently extracts:
- **Current session**: Reset time, percentage used
- **Weekly limits (All models)**: Reset time, percentage used
- **Weekly limits (Sonnet only)**: Reset time, percentage used

## Target Data Fields

Based on frontend requirements (ClaudeUsageCard.tsx) and roadmap:

### 1. Plan Information (High Priority)
- **Plan name**: e.g., "Claude Pro", "Claude Team", "Claude Enterprise"
- **Tier level**: e.g., "Pro", "Team", "Enterprise"
- **Subscription cost**: e.g., "$20/month", "$30/month"
- **Next billing date**: ISO date string

### 2. Additional Metrics (Medium Priority)
- Cost per token/request metrics
- API key usage breakdown (if accessible)
- Organization-level usage (if applicable)

### 3. Historical Data (Low Priority)
- Historical usage trends (if available on usage page)
- Past billing periods

## Console UI Structure Analysis

Based on prior scraping work (Phase 16-21), the Console usage page structure:

**URL**: `https://console.anthropic.com/settings/usage`

**Known Sections:**
1. Current session usage
2. Weekly limits (All models)
3. Weekly limits (Sonnet only)

**Unknown Sections** (need exploration):
- Plan/subscription details section
- Billing information section
- Historical usage charts/tables
- API key breakdown

## DOM Extraction Strategy

Following Phase 23's section-independent extraction pattern:

```typescript
// Each new data section gets its own try/catch block
try {
  await page.waitForSelector('text=Plan', { timeout: 5000 });
  const planData = await page.evaluate(() => {
    // Extract plan details from DOM
  });
  sectionsExtracted++;
} catch (err) {
  extractionErrors['planInfo'] = err.message;
}
```

## Data Structure Enhancement

Extend `ConsoleUsageData` interface:

```typescript
export interface ConsoleUsageData {
  currentSession?: { ... };
  weeklyLimits?: { ... };

  // NEW: Plan information
  planInfo?: {
    name: string;
    tier: string;
    cost: string;
    nextBillingDate: string;
  };

  // NEW: Billing details (if available)
  billingInfo?: {
    currentCycle: string;
    costToDate: string;
  };

  lastUpdated: string;
  extractionErrors?: Record<string, string>;
  isPartial?: boolean;
}
```

## Risk Assessment

**DOM Stability**: Medium Risk
- Console UI may change without notice
- Section-independent extraction mitigates risk (partial data still valuable)

**Auth Requirements**: Low Risk
- Same session used for current scraping
- All data likely accessible on /settings/usage and /settings/billing pages

**Data Availability**: Medium Risk
- Plan/billing info may require separate pages (not on /settings/usage)
- May need multi-page scraping strategy

## Approach

### Plan 1: Explore Console Structure & Add Plan Info
1. Manual exploration of Console pages to identify plan/billing sections
2. Document DOM selectors for plan name, tier, cost, billing date
3. Implement plan info extraction following section-independent pattern
4. Update interface and frontend integration

### Plan 2: Add Billing Cycle Information (if accessible)
1. Extract billing cycle dates and costs
2. Add to ConsoleUsageData interface
3. Update auto-scraper section counting

### Alternative: Multi-Page Strategy
If plan/billing data is on separate pages:
- Navigate to /settings/billing after /settings/usage
- Extract additional data
- Combine into single ConsoleUsageData object
- Handle navigation failures gracefully

## Decision Points

1. **Single-page vs multi-page**: If billing data requires /settings/billing, add navigation step
2. **Required vs optional fields**: Make all new fields optional to maintain graceful degradation
3. **Section count**: Increment totalSections for each new data section added

## Next Steps

1. Manual Console exploration (requires valid session)
2. Document DOM selectors for new data fields
3. Create Plan 1 with concrete selectors
4. Optionally create Plan 2 if billing page required
