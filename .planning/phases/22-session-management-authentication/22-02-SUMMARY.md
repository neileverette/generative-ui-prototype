---
phase: 22-session-management-authentication
plan: 02
subsystem: scraper
tags: [playwright, error-handling, session-management, recovery]
requires: [22-01]
provides: [session-recovery-mechanism, error-categorization, auto-recovery]
affects: [23, 24, 25]
tech-stack:
  added: []
  patterns: [automatic-recovery, categorized-errors, session-age-tracking]
key-files:
  created: []
  modified:
    - server/claude-scraper/session-validator.ts
    - server/claude-scraper/scrape.ts
    - server/claude-scraper/auto-scraper.ts
key-decisions:
  - Auto-recovery only for soft expirations (not default behavior)
  - Keep browser open when manual login required (user can complete it)
  - Close browser automatically when recovery succeeds
  - Exit immediately on session errors (no wasted retries)
issues-created: []
metrics:
  duration: 5 min
  completed: 2026-01-25
---

# Phase 22 Plan 2: Session Recovery Summary

**Implemented automatic session recovery for soft expirations and categorized error handling with specific troubleshooting guidance.**

## Accomplishments

The Claude Console scraper now attempts automatic recovery when sessions expire, minimizing manual intervention. Session recovery uses a non-headless browser to attempt auto-refresh, falling back to guided manual login when necessary. Error handling categorizes failures (expired, network, corrupted, unknown) and provides specific troubleshooting steps for each type.

Key improvements:
- Automatic session recovery mechanism with browser refresh attempts
- Categorized error types with specific action guidance
- Session age tracking for debugging
- Verbose logging option (--verbose flag)
- Intelligent retry logic that exits immediately on session/context errors

## Files Created/Modified

**Modified:**

- `server/claude-scraper/session-validator.ts` - Added recovery mechanism
  - New `attemptSessionRecovery()` function launches non-headless browser
  - Waits up to 30 seconds for auto-refresh or login redirect
  - Keeps browser open when manual login required (user can complete it)
  - Closes browser automatically when recovery succeeds
  - `validateSession()` accepts optional `attemptRecovery` parameter
  - Added `SessionRecoveryResult` interface with recovered/action/timestamp fields
  - Recovery only runs when explicitly requested (not default behavior)

- `server/claude-scraper/scrape.ts` - Enhanced error handling with recovery attempts
  - Categorizes validation failures: expired session, network issue, corrupted context
  - Attempts auto-recovery for likely expired sessions
  - Provides specific error messages with category prefix (SESSION_EXPIRED, NETWORK_ERROR, etc.)
  - Clear troubleshooting steps based on error category
  - Continues scraping if auto-recovery succeeds

- `server/claude-scraper/auto-scraper.ts` - Categorized errors and improved messaging
  - Error categorization: SESSION_EXPIRED, NETWORK_ERROR, CONTEXT_CORRUPTED, UNKNOWN
  - Session age tracking with `lastSuccessfulValidation` timestamp
  - Verbose logging option (--verbose flag) shows session age
  - Exits immediately on session/context errors (no wasted retry attempts)
  - Improved error messages showing category and specific action required
  - Preserves existing retry logic for transient errors

## Technical Details

**Session Recovery Flow:**
1. Validation fails with likely expired session
2. `attemptSessionRecovery()` launches browser in non-headless mode
3. Navigates to Console usage page
4. Waits for either:
   - Success: "Current session" appears → auto-refreshed, close browser
   - Failure: Redirect to login → manual login needed, keep browser open
   - Timeout/Error: Network issue, close browser

**Error Categories:**
- SESSION_EXPIRED: Cookie stale or missing → Run login.ts
- NETWORK_ERROR: Connection timeout → Wait and retry
- CONTEXT_CORRUPTED: Browser data invalid → Delete .session/ and re-login
- UNKNOWN: Unexpected failure → Check logs and retry manually

**Session Age Tracking:**
Tracks `lastSuccessfulValidation` timestamp to help debug session lifetime issues when running with --verbose flag.

## Commits

- `24f0a01` - feat(22-02): add session recovery with browser refresh attempt
- `03d4cf6` - feat(22-02): enhance error handling with categorization and troubleshooting

## Decisions Made

1. **Auto-recovery only for soft expirations** - Recovery is opt-in (not default) to prevent unexpected browser windows during normal operation. Only scrape.ts attempts recovery when it detects likely expired sessions.

2. **Keep browser open for manual login** - When auto-refresh fails and login is required, the browser stays open so users can complete authentication without re-running login.ts.

3. **Close browser on successful auto-recovery** - If the session refreshes automatically, the browser closes immediately and scraping continues.

4. **Exit immediately on session errors** - No retry attempts for SESSION_EXPIRED or CONTEXT_CORRUPTED errors since they require manual intervention. Saves resources and provides faster feedback.

## Issues Encountered

None

## Next Step

Phase 22 complete (2/2 plans finished). Ready for Phase 23: Error Handling & Retry Logic
