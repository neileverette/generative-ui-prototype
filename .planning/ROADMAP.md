# Roadmap: Console Landing Page

## Milestones

- [x] **Milestone 1: Landing Page Redesign** - Complete the landing page redesign (Phases 1-3)
- [x] **Milestone 2: Bug Fixes - Navigation & Chat** - Fix shortcut card clicks and chat widget results (Phases 4-5)
- [x] **Milestone 3: Chat Panel Visual Enhancements** - Visual polish for the right-side chat panel (Phases 6-9)
- [x] **Milestone 4: Claude Code Widget Enhancements** - Rebuild ClaudeUsageCard to match wireframe design (Phases 10-15)

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

- [ ] **Phase 10: Card Layout Foundation** - Restructure card with new header and clean layout
- [ ] **Phase 11: Plan Info Section** - Add plan name, cost, next bill date (fake data)
- [ ] **Phase 12: Five-Hour Limit Section** - Refactor to percentage-based display with real JSONL data
- [ ] **Phase 13: Weekly Limit Section** - Add weekly limit progress bar (fake data at 40%)
- [ ] **Phase 14: Warning Banner** - Add conditional "Approaching usage limit" warning
- [ ] **Phase 15: Remove Legacy Features** - Remove model breakdown, token counts, API section

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
| 10. Card Layout Foundation | 0/1 | Pending | - |
| 11. Plan Info Section | 0/1 | Pending | - |
| 12. Five-Hour Limit Section | 0/1 | Pending | - |
| 13. Weekly Limit Section | 0/1 | Pending | - |
| 14. Warning Banner | 0/1 | Pending | - |
| 15. Remove Legacy Features | 0/1 | Pending | - |

## Summary (Milestone 4)

**Milestone Status: IN PROGRESS**

Target: Rebuild ClaudeUsageCard to match wireframe with:
- Clean "Claude" header
- Plan info (fake data)
- 5-hour limit with real JSONL data (percentage-based)
- Weekly limit at 40% (fake data)
- Warning banner when near limit
- Removed: model breakdown, token counts, API section
