# Project State

## Current Focus

**Milestone**: 4 - Claude Code Widget Enhancements
**Phase**: 10 - Card Layout Foundation
**Plan**: Not started
**Status**: Ready to begin

## Quick Context

Milestone 4 created. Goal is to rebuild the ClaudeUsageCard component to match the new wireframe design (`~/Desktop/claude.png`). The new design is cleaner with:
- "Claude" header
- Plan info section (fake data)
- 5-hour limit with percentage display (real JSONL data)
- Weekly limit at 40% (fake data)
- Warning banner when near limit

Key removals: model breakdown, token counts, API section.

## Milestone Progress

| Milestone | Status | Phases |
|-----------|--------|--------|
| 1. Landing Page Redesign | Complete | 1-3 |
| 2. Bug Fixes - Navigation & Chat | Complete | 4-5 |
| 3. Chat Panel Visual Enhancements | Complete | 6-9 |
| 4. Claude Code Widget Enhancements | In Progress | 10-15 |

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 10 | Card Layout Foundation | Pending |
| 11 | Plan Info Section | Pending |
| 12 | Five-Hour Limit Section | Pending |
| 13 | Weekly Limit Section | Pending |
| 14 | Warning Banner | Pending |
| 15 | Remove Legacy Features | Pending |

## Recent Commits

| Commit | Type | Description |
|--------|------|-------------|
| `a6e86a1` | style | Rotate send icon 90 degrees clockwise |
| `1d5e3cc` | style | Add input box polish CSS overrides |
| `be45eef` | style | Hide feedback controls on initial instruction message |
| `0637cf3` | style | Improve welcome header visual hierarchy |

## Next Actions

1. Begin Phase 10: Card Layout Foundation
2. Run `/gsd:plan` to create plan 10-01
3. Execute the plan to restructure card layout

## Key Files

- `src/components/a2ui/ClaudeUsageCard.tsx` - Main component to rebuild (927 lines currently)
- `server/claude-usage.ts` - Server-side JSONL parsing (keep for 5-hour data)
- `src/config/claude-usage.config.ts` - Configuration constants
- `~/Desktop/claude.png` - Wireframe reference

## Wireframe Requirements

Based on `~/Desktop/claude.png`:

**Layout (top to bottom):**
1. Header: "Claude" (bold)
2. Plan info:
   - Plan: Claude Code Max (5x tier, based on $100/month)
   - Cost: $100/m
   - Next bill: [mo]/[day]
3. Warning: "Approaching usage limit" (red, only when near limit)
4. 5-hour limit section:
   - "5-hour limit" left, "Resets in Xh Xm" right
   - Progress bar (red when high)
   - "X% used / Y% remain" below
5. Weekly limit section:
   - "Weekly limit" left, "Resets in X days" right
   - Progress bar at 40% (gray)
   - "40% used / 60% remain" below

**Data Sources:**
- 5-hour limit: REAL data from JSONL files
- Everything else: FAKE/hardcoded data

## Session Log

### 2025-01-24 - Milestone 4 Creation
- Created Milestone 4: Claude Code Widget Enhancements
- Defined 6 phases (10-15) covering complete card rebuild
- Created phase directories
- Ready to begin Phase 10

---
*Last updated: 2025-01-24*
