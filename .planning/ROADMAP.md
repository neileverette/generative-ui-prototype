# Roadmap: Claude Usage Tracking Widget

## Overview

Build a dashboard widget that displays Claude usage metrics in two sections: Claude Code subscription usage from local data, and API Credits from the Anthropic Admin API. The widget progresses from static MVP to full integration with real-time data, manual entry, and polish.

## Domain Expertise

None — internal frontend/backend development using established patterns.

## Milestones

- 🚧 **v1.0 Claude Usage Widget** - Phases 1-4 (in progress)

## Phases

- [ ] **Phase 1: Core Widget (MVP)** - TypeScript interfaces, component shell, progress bar, skeleton states
- [ ] **Phase 2: Local Data Integration** - ccusage backend, JSONL parsing, 5-hour window calculation
- [ ] **Phase 3: API Credits Section** - Admin API integration, manual entry modal, burn rate calculation
- [ ] **Phase 4: Polish & UX** - Refresh, auto-refresh, animations, settings modal

## Phase Details

### 🚧 v1.0 Claude Usage Widget (In Progress)

**Milestone Goal:** Deliver a functional usage tracking widget that provides visibility into both Claude Code subscription usage and API credits.

#### Phase 1: Core Widget (MVP)

**Goal**: Create the widget component structure with TypeScript interfaces and static layout
**Depends on**: Nothing (first phase)
**Research**: Unlikely (established React/TypeScript patterns)
**Plans**: TBD

Plans:
- [ ] 01-01: TBD (run /gsd:plan-phase 1 to break down)

**Deliverables:**
- `src/types/claude-usage.ts` - TypeScript interfaces for ClaudeCodeUsage, ApiCreditsUsage
- `src/config/claude-usage.config.ts` - Configuration constants (plan limits, thresholds, pricing)
- `src/components/a2ui/ClaudeUsageCard.tsx` - Main widget component with static layout
- Progress bar with status colors (normal/warning/critical)
- Skeleton loading states
- A2UI component registration

#### Phase 2: Local Data Integration

**Goal**: Connect widget to real Claude Code usage data via backend
**Depends on**: Phase 1
**Research**: Likely (ccusage CLI output format, JSONL file structure)
**Research topics**: ccusage --json output format, ~/.claude/projects JSONL schema, 5-hour window calculation
**Plans**: TBD

Plans:
- [ ] 02-01: TBD (run /gsd:plan-phase 2 to break down)

**Deliverables:**
- Backend endpoint `/api/claude-usage/code` calling ccusage CLI
- JSONL file parsing as fallback
- 5-hour window calculation from timestamps
- Transform ccusage data to widget format
- Display real metrics in Claude Code section

#### Phase 3: API Credits Section

**Goal**: Add API Credits tracking with Admin API and manual entry
**Depends on**: Phase 2
**Research**: Likely (Anthropic Admin API endpoints, authentication)
**Research topics**: Anthropic Usage/Cost API endpoints, Admin API key format, rate limits
**Plans**: TBD

Plans:
- [ ] 03-01: TBD (run /gsd:plan-phase 3 to break down)

**Deliverables:**
- Backend endpoint `/api/claude-usage/api-credits` for Admin API
- Manual entry modal for credit balance
- Burn rate calculation (daily/monthly)
- Runway projection (days until depletion)
- Config storage in local JSON file
- Graceful fallback when no Admin API key

#### Phase 4: Polish & UX

**Goal**: Add refresh, auto-refresh, animations, and configuration
**Depends on**: Phase 3
**Research**: Unlikely (internal React patterns)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD (run /gsd:plan-phase 4 to break down)

**Deliverables:**
- Manual refresh button with loading state
- Auto-refresh intervals (5min Claude Code, 1hr API Credits)
- Warning/critical state animations (pulse on border)
- Settings modal for plan selection and preferences
- Responsive layout for mobile

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Widget (MVP) | v1.0 | 0/? | Not started | - |
| 2. Local Data Integration | v1.0 | 0/? | Not started | - |
| 3. API Credits Section | v1.0 | 0/? | Not started | - |
| 4. Polish & UX | v1.0 | 0/? | Not started | - |
