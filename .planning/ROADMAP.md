# Roadmap: Claude Usage Tracking Widget

## Overview

Build a dashboard widget that displays Claude usage metrics in two sections: Claude Code subscription usage from local data, and API Credits from the Anthropic Admin API. The widget progresses from static MVP to full integration with real-time data, manual entry, and polish.

## Domain Expertise

None — internal frontend/backend development using established patterns.

## Milestones

- ✅ **v1.0 Claude Usage Widget** - Phases 1-4 (COMPLETE)

## Phases

- [x] **Phase 1: Core Widget (MVP)** - TypeScript interfaces, component shell, progress bar, skeleton states
- [x] **Phase 2: Local Data Integration** - ccusage backend, JSONL parsing, 5-hour window calculation
- [x] **Phase 3: API Credits Section** - Manual entry, burn rate calculation, runway projection
- [x] **Phase 4: Polish & UX** - Refresh button, plan selector, animations

## Phase Details

### ✅ v1.0 Claude Usage Widget (COMPLETE)

**Milestone Goal:** Deliver a functional usage tracking widget that provides visibility into both Claude Code subscription usage and API credits.

#### Phase 1: Core Widget (MVP)

**Goal**: Create the widget component structure with TypeScript interfaces and static layout
**Depends on**: Nothing (first phase)

Plans:
- [x] 01-01: Core Widget MVP (types, config, component, registry) - COMPLETE

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

Plans:
- [x] 02-01: Local JSONL parsing & backend endpoint - COMPLETE

**Deliverables:**
- `server/claude-usage.ts` - JSONL parsing, 5-hour window calculation
- Backend endpoint `/api/claude-usage/code`
- MCP client method `getClaudeCodeUsage()`
- Widget connected to real data with auto-refresh

#### Phase 3: API Credits Section

**Goal**: Add API Credits tracking with manual entry and burn rate calculation
**Depends on**: Phase 2

Plans:
- [x] 03-01: API Credits storage, endpoints, inline entry - COMPLETE

**Deliverables:**
- `server/api-credits-storage.ts` - Storage utilities, burn rate calculation
- Backend endpoints GET/POST `/api/claude-usage/api-credits`
- MCP client methods `getApiCredits()`, `updateApiCredits()`
- Inline balance entry form in widget
- Burn rate calculation from history
- Runway projection (days until depletion)
- JSON file storage at `.config/api-credits.json`

#### Phase 4: Polish & UX

**Goal**: Add refresh, animations, and plan selection
**Depends on**: Phase 3

Plans:
- [x] 04-01: Refresh button, plan selector, animations - COMPLETE

**Deliverables:**
- Manual refresh button with spinning animation
- Plan selector dropdown (Free, Pro, Max 5x, Max 20x)
- Plan selection persisted in localStorage
- Auto-refresh intervals (5min Claude Code, 1hr API Credits)
- Critical state pulse animation

## Progress

**Execution Order:**
Phases executed in numeric order: 1 → 2 → 3 → 4

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Widget (MVP) | v1.0 | 1/1 | **COMPLETE** | 2026-01-18 |
| 2. Local Data Integration | v1.0 | 1/1 | **COMPLETE** | 2026-01-18 |
| 3. API Credits Section | v1.0 | 1/1 | **COMPLETE** | 2026-01-18 |
| 4. Polish & UX | v1.0 | 1/1 | **COMPLETE** | 2026-01-18 |

## Future Enhancements

- Admin API integration (requires org account)
- Full settings modal
- Responsive layout for mobile
- More detailed model breakdown
