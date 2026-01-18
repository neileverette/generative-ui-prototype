# Claude Usage Tracking Widget

## What This Is

A dashboard widget for the generative-ui-prototype that displays Claude-related usage metrics. It tracks Claude Code subscription usage from local data and API Credits usage from the Anthropic Admin API, providing at-a-glance visibility to prevent surprise limit hits.

## Core Value

Provide real-time visibility into Claude usage to prevent surprise limit hits during development sessions.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Display 5-hour window usage with progress bar and reset timer
- [ ] Show today/MTD estimated costs and session counts
- [ ] Display model breakdown (Opus/Sonnet/Haiku usage)
- [ ] Support warning (>70%) and critical (>90%) visual states
- [ ] Integrate with ccusage CLI for local data
- [ ] Parse JSONL files directly as fallback
- [ ] Support API Credits section with Admin API integration
- [ ] Manual balance entry for credit tracking
- [ ] Calculate burn rate and runway projections
- [ ] Register as A2UI component in the dashboard

### Out of Scope

- Historical trend charts — future enhancement after MVP
- Browser extension for Console scraping — too complex for initial version
- Team usage comparison — requires org account setup
- Webhook alerts — future enhancement

## Context

**Technical Environment:**
- React + TypeScript + Tailwind CSS frontend
- CopilotKit for AI interactions
- Express backend with existing deployment tracking
- A2UI component system for dashboard widgets

**Data Sources:**
- Claude Code: Local JSONL files at `~/.claude/projects/**/*.jsonl`
- Claude Code: ccusage CLI tool (`npm install -g ccusage`)
- API Credits: Anthropic Admin API (org accounts only)
- Manual entry for credit balance (not available via API)

**Known Limitations:**
- Claude Code limits are dynamic and not exposed via API
- Credit balance requires manual entry or Console scraping
- Admin API only available for organization accounts

## Constraints

- **Tech stack**: React + TypeScript + Tailwind (match existing codebase)
- **Component system**: Must integrate as A2UI component type
- **Backend**: Express.js for API endpoints
- **Dependencies**: Use existing lucide-react for icons

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use ccusage CLI | Existing maintained tool for parsing Claude usage | — Pending |
| Manual balance entry | Credit balance not available via API | — Pending |
| Split widget sections | Claude Code (local) vs API Credits (external) have different data sources | — Pending |

---
*Last updated: 2026-01-18 after project initialization*
