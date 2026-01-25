# Project State

## Current Focus

**Milestone**: v8.0 Scraper-to-EC2 Data Sync
**Phase**: 29 of 34 (EC2 API Endpoint)
**Plan**: Complete (1/1)
**Status**: Ready for Phase 30 (Data Sync Client)

## Quick Context

Starting v8.0 Scraper-to-EC2 Data Sync milestone. Decoupling data collection (laptop) from data serving (EC2) to enable the widget to work from anywhere.

**Current Architecture:**
- Scraper runs locally on laptop (authenticated Console session)
- Writes data to local JSON file
- Widget reads from local file via server endpoint
- Problem: Widget only works on same machine as scraper

**v8.0 Goals:**
- POST scraped data to EC2 endpoint after each successful scrape
- EC2 stores and serves usage data
- Widget fetches from EC2 instead of local file
- Add retry logic, error handling, and health checks
- Enable widget to work from anywhere, not just scraper machine

## Milestone Progress

| Milestone | Status | Phases | Shipped |
|-----------|--------|--------|---------|
| 1. Landing Page Redesign | Complete | 1-3 | 2025-01-23 |
| 2. Bug Fixes - Navigation & Chat | Complete | 4-5 | 2025-01-23 |
| 3. Chat Panel Visual Enhancements | Complete | 6-9 | 2025-01-24 |
| 4. Claude Code Widget Enhancements | Complete | 10-15 | 2025-01-24 |
| 5. Claude Data Hydration | Complete | 16-21 | 2025-01-24 |
| 6. Claude Scraper Service | In Progress | 22-27 | - |
| 7. Voice UI Restoration | Complete | 28 | 2025-01-24 |
| 8. Scraper-to-EC2 Data Sync | In Progress | 29-34 | - |

## Phase Status (Milestone 8)

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 29 | EC2 API Endpoint | Complete | 2026-01-25 |
| 30 | Data Sync Client | Not started | - |
| 31 | EC2 Data Storage | Not started | - |
| 32 | EC2 GET Endpoint | Not started | - |
| 33 | Widget Migration | Not started | - |
| 34 | Error Handling & Fallbacks | Not started | - |

## Recent Commits

| Commit | Type | Description |
|--------|------|-------------|
| `7bafdfc` | chore | Add environment variable documentation |
| `62d8b78` | feat | Add POST endpoint with authentication and validation |
| `783794e` | feat | Create TypeScript interfaces for Console usage data sync |
| `7658d8b` | feat | Update auto-scraper to handle partial data results |
| `7bf7500` | feat | Implement section-level error handling with partial data extraction |
| `f84e56b` | feat | Integrate retry strategy into auto-scraper |

## Next Actions

1. Plan Phase 30 (Data Sync Client) - Create client to POST usage data to EC2
2. Integrate sync client into auto-scraper after successful scrapes
3. Add retry logic for failed sync attempts
4. Test end-to-end sync flow from scraper to EC2

## Key Files

- `src/components/a2ui/ClaudeUsageCard.tsx` - Main component with fake data placeholders (250 lines)
- `server/claude-usage.ts` - Server-side JSONL parsing (current real data source)
- `src/services/mcp-client.ts` - MCP client that needs API integration
- Future: API client module for Anthropic services

## Data Integration Requirements

**Current State:**
- Real data (from JSONL): 5-hour window, today, month-to-date, model breakdown
- Fake data (magenta): Current session, weekly limits, plan info

**Milestone 5 Goals:**
1. Replace current session with real API data
2. Replace weekly limits (all models + Sonnet) with real API data
3. Replace plan info (name, tier, cost, billing date) with real API data
4. Remove all magenta placeholder styling
5. Add comprehensive error handling for API failures

**API Research Needed:**
- Anthropic Admin API capabilities
- Usage API endpoints
- Console scraping requirements (if API unavailable)
- Authentication methods
- Rate limiting constraints

## Session Log

### 2026-01-25 - Phase 29 Complete
- Implemented EC2 API endpoint for scraper-to-EC2 data synchronization
- Created TypeScript interfaces (ConsoleUsageDataSync, SyncResponse) in claude-console-sync-types.ts
- Added POST /api/claude/console-usage endpoint with X-API-Key authentication
- Comprehensive validation: lastUpdated ISO 8601, percentageUsed 0-100, resetsIn non-empty
- Supports partial data (optional currentSession/weeklyLimits)
- Separate storage file (console-usage-synced.json) to avoid conflicts with local scraper
- Environment variable CLAUDE_SYNC_API_KEY for authentication
- Server startup logging shows sync endpoint configuration status
- Error responses: 401 (auth), 400 (validation), 500 (server errors)
- Phase 29 complete (1/1 plans): EC2 API Endpoint
- Commits: 783794e, 62d8b78, 7bafdfc
- Ready for Phase 30 (Data Sync Client)

### 2026-01-24 - Milestone 8 Created
- Created v8.0 Scraper-to-EC2 Data Sync milestone
- 6 phases defined (29-34)
- Focus: Decouple data collection from serving by syncing to EC2
- Scraper POSTs data to EC2, widget fetches from EC2
- Enables widget to work from anywhere, not just scraper machine
- Phase directories created
- ROADMAP.md and STATE.md updated
- Ready to plan Phase 29 (EC2 API Endpoint)

### 2026-01-25 - Phase 23 Complete
- Implemented graceful degradation for partial data extraction
- Modified ConsoleUsageData interface with optional sections (currentSession?, weeklyLimits?)
- Added extractionErrors field to document missing sections and isPartial flag
- Split extraction into three independent try/catch blocks with 5s timeouts each
- Each section (currentSession, allModels, sonnetOnly) extracts independently
- Saves partial data if at least 1 section succeeds, only fails if all sections fail
- Auto-scraper treats partial success as success (resets retry state and circuit breaker)
- Logs show completeness: "Scrape completed with partial data (2/3 sections). Missing: X"
- Verbose mode shows extractionErrors details for debugging
- Phase 23 complete (2/2 plans): Error Handling & Retry Logic
- Commits: 7bf7500, 7658d8b

### 2026-01-24 - Phase 23 Plan 1 Complete
- Implemented retry strategy with exponential backoff and circuit breaker pattern
- Created retry-strategy.ts module (224 lines)
- Exponential backoff: 30s → 5min max with 0-10s jitter
- Circuit breaker: Opens after 3 failures, waits 60s, closes after 2 successes
- Auto-scraper uses RetryStrategy for intelligent error handling
- Fatal errors (SESSION_EXPIRED, CONTEXT_CORRUPTED) exit immediately
- Network errors retry with exponential backoff via setTimeout
- Successful scrapes reset retry state and continue 5-minute interval
- Commits: 3498cf0, f84e56b

### 2026-01-25 - Phase 22 Complete
- Implemented session recovery mechanism with auto-refresh attempts
- Added error categorization (SESSION_EXPIRED, NETWORK_ERROR, CONTEXT_CORRUPTED)
- Session age tracking and verbose logging (--verbose flag)
- Auto-recovery attempts for soft expirations, exits immediately on hard failures
- Phase 22 complete (2/2 plans): Session Management & Authentication
- Commits: 24f0a01, 03d4cf6

### 2025-01-24 - Phase 22 Plan 1 Complete
- Implemented session validation and health checking
- Created session-validator.ts module (142 lines)
- Integrated validation into scraper startup flow
- Enhanced auto-scraper error handling for session failures
- Session expires are now detected proactively with clear user guidance
- Commits: 92fff73, 22d502a

### 2025-01-24 - Milestone 6 Created
- Created v6.0 Claude Scraper Service milestone
- 6 phases defined (22-27)
- Focus: Production reliability, monitoring, expanded data extraction
- Phase directories created
- ROADMAP.md and STATE.md updated
- Ready to plan Phase 22 (Session Management & Authentication)

### 2025-01-24 - Milestone 5 Complete
- v5.0 Claude Data Hydration shipped
- All 6 phases (16-21) completed
- Built Playwright-based scraper with headless operation
- Integrated real Console data for session and weekly limits
- Added auto-refresh (5 min) and manual refresh
- Removed all fake data and magenta placeholders
- Created milestone archive: milestones/v5.0-ROADMAP.md
- Updated MILESTONES.md with all 5 milestones
- Updated PROJECT.md and ROADMAP.md
- Tagged v5.0 in git

---
*Last updated: 2026-01-25 after Phase 22 completion*
