# Console Landing Page

## What This Is

A modern console dashboard application with landing page, chat interface, and real-time Claude usage monitoring. Features automated data collection from Claude Console and comprehensive usage tracking.

## Core Value

Real-time visibility into Claude usage with automated data collection that doesn't interrupt the user's workflow.

## Requirements

### Validated

**v1.0 Landing Page Redesign:**
- ✓ Landing page redesign with navigation cards — v1.0
- ✓ Visual polish to match mockup design — v1.0
- ✓ API data flows and navigation working — v1.0

**v2.0 Bug Fixes:**
- ✓ Shortcut card click handlers fixed — v2.0
- ✓ Chat widget results displaying correctly — v2.0
- ✓ All 6 common query types functional — v2.0

**v3.0 Chat Panel Enhancements:**
- ✓ Welcome header styling improvements — v3.0
- ✓ Input box polish and send icon rotation — v3.0
- ✓ Instruction message cleanup — v3.0

**v4.0 Claude Widget Rebuild:**
- ✓ ClaudeUsageCard rebuilt to wireframe — v4.0
- ✓ Plan info section with configuration — v4.0
- ✓ 5-hour and weekly limit progress bars — v4.0
- ✓ Warning banner for approaching limits — v4.0

**v5.0 Claude Data Hydration:**
- ✓ AppleScript-based Console scraper — v5.0
- ✓ Real Console usage data integration — v5.0
- ✓ Auto-refresh every 5 minutes — v5.0
- ✓ Manual refresh trigger — v5.0
- ✓ Stale data warnings — v5.0

### Active

(No active requirements - ready for next milestone planning)

### Out of Scope

- New API integrations — focus on wiring existing data
- Mobile-first redesign — desktop priority for this iteration

## Context

**Current State:** v5.0 shipped with real Claude Console data integration

Shipped 5 milestones across 21 phases:
- v1.0: Landing page redesign (3 phases)
- v2.0: Bug fixes for navigation and chat (2 phases)
- v3.0: Chat panel visual enhancements (4 phases)
- v4.0: Claude widget rebuild (6 phases merged to 1)
- v5.0: Claude data hydration via scraping (6 phases)

**Tech Stack:**
- React + TypeScript + Tailwind CSS
- Node.js backend with Express
- AppleScript-based scraping for Console data
- MCP client for API integration

**Codebase:**
- ~3,000 LOC TypeScript (src/)
- ~2,000 LOC server code (server/)
- ~20 scraper files (server/claude-scraper/)

**Key Features:**
- Landing page with navigation cards
- Chat interface with CopilotKit integration
- Real-time Claude usage monitoring
- Auto-refresh every 5 minutes (silent scraper)
- Manual refresh on demand
- Stale data warnings

Key files:
- `src/components/LandingPage.tsx`
- `src/components/a2ui/ClaudeUsageCard.tsx`
- `src/services/mcp-client.ts`
- `server/index.ts`
- `server/claude-scraper/` (scraping infrastructure)

## Constraints

- **Tech stack**: React + TypeScript + Tailwind CSS
- **Design**: Must match provided mockup design
- **Timeline**: Quick iteration — ship fast

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Landing as default view | Provides better user entry experience | ✅ v1.0 |
| Card-based navigation | Matches mockup, intuitive UX | ✅ v1.0 |
| CopilotKit for chat widgets | Existing integration, good patterns | ✅ v2.0 |
| Rebuild ClaudeUsageCard | Cleaner codebase (927 → 250 lines) | ✅ v4.0 |
| AppleScript scraping | No public API for Console data | ✅ v5.0 |
| Silent scraper variant | Avoid interrupting user workflow | ✅ v5.0 |
| 5-minute auto-refresh | Balance freshness vs. performance | ✅ v5.0 |
| Config file for plan info | Plan changes infrequently | ✅ v5.0 |

---
*Last updated: 2025-01-24 after v5.0 milestone*
