# Roadmap: Console Landing Page

## Milestones

- [x] **Milestone 1: Landing Page Redesign** - Complete the landing page redesign (Phases 1-3)
- [x] **Milestone 2: Bug Fixes - Navigation & Chat** - Fix shortcut card clicks and chat widget results (Phases 4-5)
- [x] **Milestone 3: Chat Panel Visual Enhancements** - Visual polish for the right-side chat panel (Phases 6-9)
- [x] **Milestone 4: Claude Code Widget Enhancements** - Rebuild ClaudeUsageCard to match wireframe design (Phases 10-15)
- [x] **Milestone 5: Claude Data Hydration** - Replace fake data with real API data from Claude/Anthropic (Phases 16-21) — [Details](milestones/v5.0-ROADMAP.md)
- [ ] **Milestone 6: Claude Scraper Service** - Improve reliability, error handling, and expand scraper capabilities (Phases 22-27)
- [x] **Milestone 7: Voice UI Restoration** - Restore voice input button as persistent floating element (Phase 28)

---

## Milestone 1: Landing Page Redesign (COMPLETE)

### Overview

Complete the landing page redesign by fixing TypeScript errors, testing functionality, applying visual polish to match the mockup, and verifying all integrations work correctly.

### Domain Expertise

None — standard React/TypeScript patterns

### Phases

- [x] **Phase 1: Fix & Verify** - Fix TypeScript errors and verify page renders
- [x] **Phase 2: Visual Polish** - Match mockup design (spacing, colors, typography)
- [x] **Phase 3: Integration & Ship** - Verify data flows and navigation, final testing

## Phase Details

### Phase 1: Fix & Verify
**Goal**: Resolve TypeScript build errors and confirm landing page renders
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established patterns)
**Plans**: 1 plan

Plans:
- [x] 01-01: Fix NavigationCard TypeScript errors and verify render

### Phase 2: Visual Polish
**Goal**: Update styling to match mockup design
**Depends on**: Phase 1
**Research**: Unlikely (CSS/Tailwind work)
**Plans**: 1 plan

Plans:
- [x] 02-01: Apply spacing, colors, and typography from mockup

### Phase 3: Integration & Ship
**Goal**: Verify data flows from APIs, test navigation between views
**Depends on**: Phase 2
**Research**: Unlikely (existing API patterns)
**Plans**: 1 plan

Plans:
- [x] 03-01: Test API data flows and view navigation

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fix & Verify | 1/1 | Complete | 2025-01-23 |
| 2. Visual Polish | 1/1 | Complete | 2025-01-23 |
| 3. Integration & Ship | 1/1 | Complete | 2025-01-23 |

## Summary

**Project Status: COMPLETE**

All phases finished successfully:
- Build passes with no TypeScript errors
- UI updated to match mockup design
- APIs verified working (MCP tool calls, AWS costs, system metrics)

### Working APIs
- `POST /api/mcp/call` - MCP tool calls (datadog metrics)
- `GET /api/costs/overview` - AWS costs
- System metrics, containers, uptime all functional

### Dev Server
```bash
npm run dev
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
```

---

## Milestone 2: Bug Fixes - Navigation & Chat (COMPLETE)

### Overview

Fix two critical bugs affecting user interaction: shortcut cards becoming unresponsive when clicked, and chat widget not displaying results for matching queries.

### Domain Expertise

None — standard React/TypeScript event handling and state management

### Phases

- [x] **Phase 4: Fix Shortcut Card Clicks** - Resolve unresponsive interface when clicking navigation/shortcut cards
- [x] **Phase 5: Fix Chat Widget Results** - Display widget results when user input matches common phrases

## Phase Details (Milestone 2)

### Phase 4: Fix Shortcut Card Clicks
**Goal**: Fix the bug where clicking shortcut cards causes the interface to become unresponsive
**Depends on**: Nothing (can start immediately)
**Research**: Unlikely (debugging existing code)
**Expected behavior**: Clicking cards should trigger their intended action without breaking the UI

Key investigation areas:
- Event handlers on NavigationCard/shortcut card components
- State updates triggered by card clicks
- Possible infinite loops or blocking operations

Plans:
- [x] 04-01: Debug and fix shortcut card click handlers

### Phase 5: Fix Chat Widget Results
**Goal**: Display widget results when user input matches common phrases
**Depends on**: Phase 4
**Research**: Unlikely (debugging/implementing existing pattern)
**Expected behavior**: Match user input against list of common phrases and display corresponding widgets

Key investigation areas:
- Chat input handling and message processing
- Widget rendering logic based on query matching
- Common phrase matching implementation

Plans:
- [x] 05-01: Fix missing CopilotKit actions for chat-to-widget flow

## Progress (Milestone 2)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Fix Shortcut Card Clicks | 1/1 | Complete | 2025-01-23 |
| 5. Fix Chat Widget Results | 1/1 | Complete | 2025-01-23 |

## Summary (Milestone 2)

**Milestone Status: COMPLETE**

Both bugs fixed:
- Phase 4: Added error handling and recovery to navigation handlers
- Phase 5: Added missing CopilotKit actions for costs and automations, fixed view transition in showDeployments

All 6 common query types now work correctly:
1. "Show all system metrics" -> fetchSystemMetrics
2. "Show running containers" -> fetchContainersList
3. "Show deployments" -> showDeployments
4. "Show me AWS costs" -> fetchCostsOverview
5. "Show Claude usage" -> showClaudeUsage
6. "Show automation workflows" -> fetchAutomations

---

## Milestone 3: Chat Panel Visual Enhancements

### Overview

Apply visual polish to the right-side chat panel to improve aesthetics and user experience. Includes header styling, message cleanup, and input box refinements.

### Domain Expertise

None — CSS/Tailwind styling work

### Phases

- [x] **Phase 6: Welcome Header Styling** - Bold headline, larger subtitle, improved spacing
- [x] **Phase 7: Instruction Message Cleanup** - Remove feedback buttons from instructional text
- [x] **Phase 8: Input Box Polish** - Corner radius and bottom padding adjustments
- [x] **Phase 9: Send Icon Rotation** - Rotate send icon 90 degrees clockwise

## Phase Details (Milestone 3)

### Phase 6: Welcome Header Styling
**Goal**: Improve the visual hierarchy of the chat panel header
**Depends on**: Nothing (can start immediately)
**Research**: Unlikely (CSS/Tailwind work)

Requirements:
- Make "Welcome to Console" headline bold
- Make subtitle text underneath larger
- Add more padding between header elements

Plans:
- [x] 06-01: Apply header typography and spacing improvements

### Phase 7: Instruction Message Cleanup
**Goal**: Remove inappropriate feedback controls from instructional content
**Depends on**: Phase 6
**Research**: Unlikely (component modification)

Requirements:
- Remove thumbs up/thumbs down buttons from the initial instruction message
- The instruction is informational, not a real chat message requiring feedback

Plans:
- [x] 07-01: Remove feedback buttons from instruction message

### Phase 8: Input Box Polish
**Goal**: Refine the chat input box styling
**Depends on**: Phase 7
**Research**: Unlikely (CSS adjustments)

Requirements:
- Set input box corner radius to 8px
- Add 16px padding below input box (not touching window bottom)

Plans:
- [x] 08-01: Apply input box styling refinements

### Phase 9: Send Icon Rotation
**Goal**: Correct the send icon orientation
**Depends on**: Phase 8
**Research**: Unlikely (CSS transform)

Requirements:
- Rotate send icon 90 degrees clockwise

Plans:
- [x] 09-01: Apply rotation transform to send icon

## Progress (Milestone 3)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Welcome Header Styling | 1/1 | Complete | 2025-01-24 |
| 7. Instruction Message Cleanup | 1/1 | Complete | 2025-01-24 |
| 8. Input Box Polish | 1/1 | Complete | 2025-01-24 |
| 9. Send Icon Rotation | 1/1 | Complete | 2025-01-24 |

## Summary (Milestone 3)

**Milestone Status: COMPLETE**

All visual enhancements applied to the chat panel:
- Phase 6: Welcome header with bold headline, larger subtitle, improved spacing
- Phase 7: Removed feedback controls from initial instruction message
- Phase 8: Input box with 8px corner radius and 16px bottom padding
- Phase 9: Send icon rotated 90 degrees clockwise (rightward arrow)

---

## Milestone 4: Claude Code Widget Enhancements

### Overview

Rebuild the ClaudeUsageCard component to match the new wireframe design. The new design is cleaner and more focused, showing plan information with two progress bars (5-hour limit and weekly limit) and a warning banner when approaching limits.

### Domain Expertise

None - React/TypeScript component refactoring with existing data patterns

### Wireframe Reference

See `~/Desktop/claude.png` for the target design.

### Key Changes from Current Implementation

1. **Remove**: Model breakdown, token counts display, API section
2. **Add**: Plan info section (fake data), weekly limit section (fake data at 40%)
3. **Modify**: 5-hour limit to show percentage-based display only (real data from JSONL)
4. **Add**: Warning banner above progress bars when near limit
5. **Keep**: 5-minute auto-refresh + manual refresh

### Phases

- [x] **Phase 10: Card Layout Foundation** - Restructure card with new header and clean layout (also includes Phases 11, 14, 15)
- [x] **Phase 11: Plan Info Section** - Merged into Phase 10
- [ ] **Phase 12: Five-Hour Limit Section** - Connect to real JSONL data (currently using fake data)
- [ ] **Phase 13: Weekly Limit Section** - Keep as fake data (already implemented in Phase 10)
- [x] **Phase 14: Warning Banner** - Merged into Phase 10
- [x] **Phase 15: Remove Legacy Features** - Merged into Phase 10

## Phase Details (Milestone 4)

### Phase 10: Card Layout Foundation
**Goal**: Restructure the card component with new header layout
**Depends on**: Nothing (can start immediately)
**Research**: Unlikely (component refactoring)

Requirements:
- Simplify card to single section (remove API section divider)
- Header: "Claude" in bold
- Clean, minimal container styling

Plans:
- [ ] 10-01: Restructure ClaudeUsageCard layout

### Phase 11: Plan Info Section
**Goal**: Add plan information display with fake data
**Depends on**: Phase 10
**Research**: Unlikely (static data display)

Requirements:
- Plan: "Claude Code Max (5x tier, based on $100/month)"
- Cost: "$100/m"
- Next bill: "[mo]/[day]" (placeholder format)
- All data is hardcoded/fake for this phase

Plans:
- [ ] 11-01: Add plan info section with fake data

### Phase 12: Five-Hour Limit Section
**Goal**: Refactor 5-hour limit to show percentage-based display only
**Depends on**: Phase 11
**Research**: Unlikely (existing JSONL parsing works)

Requirements:
- "5-hour limit" label on left, "Resets in Xh Xm" on right
- Progress bar showing usage
- "X% used / Y% remain" below the bar
- Use real data from JSONL files (existing logic)
- 5-minute auto-refresh interval
- Manual refresh button

Plans:
- [ ] 12-01: Refactor 5-hour limit to percentage display

### Phase 13: Weekly Limit Section
**Goal**: Add weekly limit progress bar with fake data
**Depends on**: Phase 12
**Research**: Unlikely (mirroring 5-hour section)

Requirements:
- "Weekly limit" label on left, "Resets in X days" on right
- Progress bar at 40%
- "40% used / 60% remain" below
- All data is hardcoded/fake (show 40%)

Plans:
- [ ] 13-01: Add weekly limit section with fake data

### Phase 14: Warning Banner
**Goal**: Add conditional warning when approaching usage limit
**Depends on**: Phase 13
**Research**: Unlikely (conditional rendering)

Requirements:
- Text: "Approaching usage limit" in red
- Position: Above the progress bars (below plan info)
- Only show when either limit is above threshold (e.g., 80%)

Plans:
- [ ] 14-01: Add conditional warning banner

### Phase 15: Remove Legacy Features
**Goal**: Clean up removed features from codebase
**Depends on**: Phase 14
**Research**: Unlikely (code removal)

Requirements:
- Remove model breakdown display
- Remove token counts display
- Remove API section (ApiCreditsSection, ApiTokenSection)
- Remove unused imports and helper functions
- Ensure no TypeScript errors after cleanup

Plans:
- [ ] 15-01: Remove legacy features and clean up

## Progress (Milestone 4)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Card Layout Foundation | 1/1 | Complete | 2025-01-24 |
| 11. Plan Info Section | N/A | Merged into 10 | - |
| 12. Five-Hour Limit Section | 0/1 | Planned | - |
| 13. Weekly Limit Section | N/A | Merged into 10 | - |
| 14. Warning Banner | N/A | Merged into 10 | - |
| 15. Remove Legacy Features | N/A | Merged into 10 | - |

## Summary (Milestone 4)

**Milestone Status: COMPLETE**

Completed: Rebuilt ClaudeUsageCard to match wireframe with:
- Clean "Claude" header
- Plan info (fake data)
- 5-hour limit with real JSONL data (percentage-based)
- Weekly limit at 40% (fake data)
- Warning banner when near limit
- Removed: model breakdown, token counts, API section

---

## Milestone 5: Claude Data Hydration (COMPLETE)

See [milestones/v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md) for full details.

### Summary

Replaced fake/hardcoded data in ClaudeUsageCard with real Console usage data via AppleScript-based scraping solution.

### Phases

- [x] **Phase 16: API Research & Strategy** (1/1 plan complete)
- [x] **Phase 17: API Infrastructure Setup** (1/1 plan complete)
- [x] **Phase 18: Current Session Data Integration** (1/1 plan complete)
- [x] **Phase 19: Weekly Limits Integration** (1/1 plan complete)
- [x] **Phase 20: Plan & Billing Info Integration** (1/1 plan complete)
- [x] **Phase 21: Cleanup & Testing** (1/1 plan complete)

### Result

ClaudeUsageCard now displays 100% real data from Claude Console with 5-minute auto-refresh and manual refresh option.

## Progress (Milestone 5)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 16. API Research & Strategy | 1/1 | Complete | 2025-01-24 |
| 17. API Infrastructure Setup | 1/1 | Complete | 2025-01-24 |
| 18. Current Session Data Integration | 1/1 | Complete | 2025-01-24 |
| 19. Weekly Limits Integration | 1/1 | Complete | 2025-01-24 |
| 20. Plan & Billing Info Integration | 1/1 | Complete | 2025-01-24 |
| 21. Cleanup & Testing | 1/1 | Complete | 2025-01-24 |

---

## Milestone 6: Claude Scraper Service (IN PROGRESS)

### Overview

Improve the reliability, error handling, and capabilities of the Claude Console scraper service. The current implementation uses Playwright to scrape usage data from console.anthropic.com, but needs enhancements for production robustness and expanded data collection.

### Domain Expertise

Playwright automation, error handling patterns, session management, production service reliability

### Milestone Goal

Build a production-ready scraper service that reliably extracts Claude Console data with comprehensive error handling, retry logic, monitoring, and expanded data capabilities.

### Phases

- [ ] **Phase 22: Session Management & Authentication** - Improve session persistence and auth reliability
- [ ] **Phase 23: Error Handling & Retry Logic** - Add comprehensive error handling with smart retries
- [ ] **Phase 24: Data Extraction Enhancement** - Extract additional usage metrics and billing data
- [ ] **Phase 25: Monitoring & Health Checks** - Add logging, metrics, and health monitoring
- [ ] **Phase 26: Rate Limiting & Throttling** - Implement intelligent rate limiting to avoid detection
- [ ] **Phase 27: Testing & Documentation** - Add tests, improve docs, production hardening

## Phase Details (Milestone 6)

### Phase 22: Session Management & Authentication

**Goal**: Improve session persistence and authentication reliability to reduce login failures
**Depends on**: Previous milestone complete
**Research**: Unlikely (Playwright session management patterns)

Current issues:
- Session expires unpredictably requiring manual re-login
- No automatic session refresh or validation
- No graceful handling of auth failures

Improvements needed:
- Detect session expiration before scraping attempts
- Implement automatic session validation on startup
- Add session refresh mechanism when possible
- Better error messages for auth-related failures

Plans:
- [x] 22-01: Implement session validation and health checking
- [x] 22-02: Session recovery and enhanced error handling

### Phase 23: Error Handling & Retry Logic

**Goal**: Add comprehensive error handling with intelligent retry logic
**Depends on**: Phase 22
**Research**: Unlikely (standard retry patterns)

Current issues:
- Simple error logging without recovery attempts
- No retry logic for transient failures
- Scraper stops completely after 3 consecutive errors
- No differentiation between fatal vs recoverable errors

Improvements needed:
- Exponential backoff retry strategy
- Distinguish between recoverable errors (network timeout) vs fatal (auth failure)
- Circuit breaker pattern for repeated failures
- Graceful degradation when partial data is available

Plans:
- [x] 23-01: Implement retry strategy with exponential backoff and circuit breaker
- [x] 23-02: Implement graceful degradation for partial data extraction

### Phase 24: Data Extraction Enhancement

**Goal**: Extract additional usage metrics and billing data from Console
**Depends on**: Phase 23
**Research**: Likely (Console DOM structure, available data fields)

Current data extracted:
- Current session usage percentage and reset time
- Weekly limits for all models and Sonnet-only
- Last updated timestamp

Additional data to extract:
- Plan tier details (Pro, Team, Enterprise)
- Billing cycle information
- Cost per token/request metrics
- Historical usage trends if available
- API key usage breakdown
- Organization-level usage (if applicable)

Plans:
- [ ] 24-01: TBD (run /gsd:plan-phase 24 to break down)

### Phase 25: Monitoring & Health Checks

**Goal**: Add comprehensive logging, metrics collection, and health monitoring
**Depends on**: Phase 24
**Research**: Unlikely (standard monitoring patterns)

Improvements needed:
- Structured logging with levels (info, warn, error)
- Scraper performance metrics (duration, success rate)
- Health check endpoint for service status
- Alert on consecutive failures or stale data
- Track scraper uptime and reliability statistics

Plans:
- [ ] 25-01: TBD (run /gsd:plan-phase 25 to break down)

### Phase 26: Rate Limiting & Throttling

**Goal**: Implement intelligent rate limiting to avoid detection and respect Console
**Depends on**: Phase 25
**Research**: Unlikely (rate limiting patterns)

Current behavior:
- Scrapes every 5 minutes unconditionally
- No jitter or randomization in timing
- Immediate consecutive requests on startup

Improvements needed:
- Add jitter to scrape intervals (4-6 minutes instead of exactly 5)
- Respect rate limiting signals from Console
- Implement request throttling during high-activity periods
- Add configurable scrape intervals
- Cache results to reduce unnecessary scrapes

Plans:
- [ ] 26-01: TBD (run /gsd:plan-phase 26 to break down)

### Phase 27: Testing & Documentation

**Goal**: Add comprehensive tests, improve documentation, and production hardening
**Depends on**: Phase 26
**Research**: Unlikely (standard testing practices)

Testing needed:
- Unit tests for data extraction logic
- Integration tests with mock Console pages
- Error scenario testing (auth failure, network issues)
- Session expiration handling tests

Documentation needed:
- Architecture overview and data flow
- Setup and configuration guide
- Troubleshooting common issues
- Environment variable reference
- Monitoring and alerting setup

Production hardening:
- Environment-based configuration
- Secrets management for credentials
- Docker containerization option
- Process manager integration (PM2, systemd)

Plans:
- [ ] 27-01: TBD (run /gsd:plan-phase 27 to break down)

## Progress (Milestone 6)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 22. Session Management & Authentication | 2/2 | Complete | 2026-01-25 |
| 23. Error Handling & Retry Logic | 2/2 | Complete | 2026-01-25 |
| 24. Data Extraction Enhancement | 0/? | Not started | - |
| 25. Monitoring & Health Checks | 0/? | Not started | - |
| 26. Rate Limiting & Throttling | 0/? | Not started | - |
| 27. Testing & Documentation | 0/? | Not started | - |

---

## Milestone 7: Voice UI Restoration (COMPLETE)

### Overview

Restore the voice input button that disappeared after the landing page redesign. The voice button should be a persistent floating element positioned above all other UI elements, visible on every page load.

### Domain Expertise

None - React component refactoring and CSS positioning

### Phases

- [x] **Phase 28: Voice UI Architecture** - Move voice button from conditional rendering to persistent floating element

## Phase Details (Milestone 7)

### Phase 28: Voice UI Architecture
**Goal**: Make voice button a persistent floating element visible on all views
**Depends on**: Nothing (can start immediately)
**Research**: Unlikely (standard React patterns and CSS positioning)

Requirements:
- Remove voice UI from DashboardCanvas component
- Add floating voice button to App.tsx positioned absolutely
- Position at bottom center (fixed position)
- High z-index to stay above all elements
- Show overlay when voice is active
- Visible on all views (landing, home, commands, loading)

Plans:
- [x] 28-01: Refactor voice UI to floating architecture

## Progress (Milestone 7)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 28. Voice UI Architecture | 1/1 | Complete | 2025-01-24 |

## Summary (Milestone 7)

**Milestone Status: COMPLETE**

Voice button is now a persistent floating element:
- Removed voice UI from DashboardCanvas props and rendering
- Added VoiceButton and VoiceOverlay as floating elements in App.tsx
- Positioned at bottom center with `fixed bottom-8 left-1/2 -translate-x-1/2`
- z-index: 50 to appear above all other content
- Voice overlay shows with backdrop blur when voice is active
- Works on all views: landing page, home, commands, and loading states
