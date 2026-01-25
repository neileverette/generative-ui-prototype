# Project State

## Current Focus

**Milestone**: v9.0 Dynamic Widget Loading & Utterance Routing
**Phase**: 35 of 41 (Utterance-to-Widget Routing System)
**Plan**: Not started
**Status**: Ready to plan Phase 35

## Quick Context

Starting v9.0 Dynamic Widget Loading & Utterance Routing milestone. Building a chat-driven widget loading system where utterances control UI state and widget composition.

**Core Concept:**
- Chat input drives the display, order, and composition of widgets
- Widgets organized into groups (overview, costs, metrics, etc.)
- Utterances (chat or shortcuts) invoke widget groups
- Initial page load auto-invokes "overview" group

**v9.0 Goals:**
- Build utterance-to-widget routing engine with pattern matching
- Define widget groups and configuration schema
- Auto-load "overview" group on initial page load (invisible utterance)
- Dynamically load/unload widgets based on active utterance
- Connect UI shortcuts to trigger widget groups
- Integrate with chat system to replace existing widget logic

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
| 9. Dynamic Widget Loading & Utterance Routing | In Progress | 35-41 | - |

## Phase Status (Milestone 9)

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 35 | Utterance-to-Widget Routing System | Not started | - |
| 36 | Widget Group Configuration | Not started | - |
| 37 | Initial Load with Invisible Utterance | Not started | - |
| 38 | Dynamic Widget Loader | Not started | - |
| 39 | Shortcut Group UI Integration | Not started | - |
| 40 | Chat-to-Routing Integration | Not started | - |
| 41 | Testing & Edge Cases | Not started | - |

## Recent Commits

| Commit | Type | Description |
|--------|------|-------------|
| `dd77836` | chore | Document CLAUDE_SYNC_URL env var |
| `72392c9` | feat | Integrate sync into auto-scraper |
| `143d4db` | feat | Create EC2 sync client module |
| `7bafdfc` | chore | Add environment variable documentation |
| `62d8b78` | feat | Add POST endpoint with authentication and validation |
| `783794e` | feat | Create TypeScript interfaces for Console usage data sync |

## Next Actions

1. Plan Phase 35 (Utterance-to-Widget Routing System) - Build core routing engine
2. Design pattern matching system for utterance → group resolution
3. Create TypeScript interfaces for routes, groups, and routing results
4. Define routing precedence rules (exact > keyword > fuzzy)

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

### 2026-01-25 - Milestone 9 Created
- Created v9.0 Dynamic Widget Loading & Utterance Routing milestone
- 7 phases defined (35-41)
- Focus: Chat-driven widget loading with groups and utterances
- Chat input/shortcuts invoke widget groups, page auto-loads "overview" on initial load
- Phase directories created
- ROADMAP.md and STATE.md updated
- Ready to plan Phase 35 (Utterance-to-Widget Routing System)

### 2026-01-25 - Phase 31 Planned
- Created executable plan for Phase 31: EC2 Data Storage
- Plan file: .planning/phases/31-ec2-data-storage/31-ec2-data-storage-PLAN.md
- Storage layer design: Versioned filesystem storage with retention policies
- Architecture: `console-usage-history/` directory with timestamped JSON files
- Retention: Keep last 100 versions OR 7 days of data (whichever is larger)
- Features: Atomic writes, auto-cleanup, metadata tracking, backward compatibility
- Module to create: server/console-storage.ts with init/save/cleanup functions
- Integration: Update POST endpoint to use versioned storage instead of single file
- Testing plan: Version creation, cleanup, error handling, backward compatibility
- Ready to execute Phase 31 (1/1 plan)

### 2026-01-25 - Phase 30 Complete
- Implemented data sync client to POST usage data to EC2 after successful scrapes
- Created sync-client.ts module with syncToEC2 function using native fetch
- Integrated sync into auto-scraper with error isolation (sync failures don't crash scraper)
- 10-second timeout with AbortController for sync requests
- Handles response codes: 2xx (success), 401 (auth), 400 (validation), network errors
- Environment variables: CLAUDE_SYNC_URL (defaults to localhost), CLAUDE_SYNC_API_KEY (required)
- Sync happens after data saved locally, wrapped in try/catch
- Comprehensive logging with verbose mode support
- Phase 30 complete (1/1 plans): Data Sync Client
- Commits: 143d4db, 72392c9, dd77836
- Ready for Phase 31 (EC2 Data Storage)

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
