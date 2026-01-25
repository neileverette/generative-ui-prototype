---
phase: 23-error-handling
plan: 01
subsystem: scraper
tags: [error-handling, retry-logic, circuit-breaker, resilience]
requires: [22-01, 22-02]
provides: [exponential-backoff, circuit-breaker, intelligent-retry]
affects: [24, 25, 26]
tech-stack:
  added: []
  patterns: [exponential-backoff, circuit-breaker, retry-with-jitter]
key-files:
  created:
    - server/claude-scraper/retry-strategy.ts
  modified:
    - server/claude-scraper/auto-scraper.ts
key-decisions:
  - Implemented circuit breaker in Task 1 alongside retry strategy for cohesive error handling
  - Circuit opens after 3 failures, waits 60s, transitions to HALF_OPEN to test recovery
  - Network errors retry with exponential backoff (30s → 5min max) plus 0-10s jitter
  - Fatal errors (SESSION_EXPIRED, CONTEXT_CORRUPTED) exit immediately with no retry
  - Retry attempts scheduled immediately via setTimeout, not next 5-minute interval
  - Successful scrapes reset retry state and circuit breaker, continue normal 5-min interval
issues-created: []
metrics:
  duration: 15 minutes
  completed: 2026-01-24
---

# Phase 23 Plan 1: Retry Strategy & Circuit Breaker Summary

Transformed auto-scraper from simple error counter to intelligent retry system with exponential backoff, jitter, and circuit breaker pattern for production-grade resilience against transient failures.

## Accomplishments

Implemented comprehensive error handling that distinguishes between recoverable transient failures (network timeouts, DNS issues) requiring smart backoff vs fatal errors (expired sessions, corrupted browser contexts) requiring immediate exit. The retry strategy uses exponential backoff with jitter to prevent thundering herd, while the circuit breaker prevents hammering the Console during extended outages by opening after 3 failures, waiting 60 seconds, testing recovery in HALF_OPEN state, and closing after 2 successful attempts.

### Retry Strategy Module (224 lines)

Created `retry-strategy.ts` with:
- **Exponential backoff formula**: `min(baseDelay * 2^(attempt-1) + random(0, jitter), maxDelay)`
  - Default: 30s base delay → 5min max delay
  - Jitter: 0-10 seconds to prevent synchronized retries
  - Attempts: 1→30s, 2→60s, 3→120s, 4→240s, 5→300s (capped)
- **Error classification**: SESSION_EXPIRED and CONTEXT_CORRUPTED are fatal (no retry), NETWORK_ERROR and UNKNOWN are recoverable
- **Circuit breaker states**: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED
- **Circuit thresholds**: Opens after 3 consecutive failures, closes after 2 consecutive successes in HALF_OPEN
- **No external dependencies**: Pure TypeScript implementation for full control

### Auto-Scraper Integration (173 lines, +65 lines modified)

Replaced simple `consecutiveErrors` counter with RetryStrategy:
- Checks circuit state before attempting scrape (skips if OPEN)
- Fatal errors still exit immediately (preserves Phase 22 behavior)
- Network errors trigger exponential backoff via `setTimeout` (immediate retry, not next 5-min interval)
- Successful scrapes call `recordSuccess()` to update circuit breaker and reset retry state
- Failed scrapes call `recordFailure()` before checking `shouldRetry()`
- Verbose logging shows retry attempt numbers, backoff delays, and circuit state transitions
- Circuit breaker prevents exit on OPEN state, allows auto-recovery after cool-down

### Key Behaviors

1. **First network error**: Retry in 30s (+ jitter)
2. **Second network error**: Retry in 60s (+ jitter)
3. **Third network error**: Circuit opens, retry in 120s (+ jitter)
4. **Circuit OPEN**: Skips scrape attempts for 60s cool-down period
5. **Circuit HALF_OPEN**: Tests recovery with next attempt
6. **Two successes in HALF_OPEN**: Circuit closes, normal operation resumes
7. **Failure in HALF_OPEN**: Circuit reopens, another 60s cool-down

## Files Created/Modified

### Created
- `server/claude-scraper/retry-strategy.ts` (224 lines)
  - RetryStrategy class with exponential backoff
  - Circuit breaker state machine
  - Error classification helper

### Modified
- `server/claude-scraper/auto-scraper.ts` (173 lines, +65 added/-28 removed)
  - Replaced consecutiveErrors counter with RetryStrategy instance
  - Added circuit state checks before scraping
  - Immediate retry scheduling with exponential backoff
  - Circuit breaker state transition logging

## Technical Details

### Exponential Backoff Formula
```typescript
delay = min(baseDelay * 2^(attempt-1) + random(0, jitter * 1000), maxDelay)
```

**Example delays (base: 30s, max: 5min, jitter: 0-10s):**
- Attempt 1: 30s + jitter
- Attempt 2: 60s + jitter
- Attempt 3: 120s + jitter
- Attempt 4: 240s + jitter
- Attempt 5: 300s + jitter (capped at max)

### Circuit Breaker State Machine
```
CLOSED (normal)
  └─[3 failures]→ OPEN (blocking)
                    └─[60s elapsed]→ HALF_OPEN (testing)
                                       ├─[2 successes]→ CLOSED
                                       └─[1 failure]→ OPEN
```

### Error Classification
- **Fatal (no retry)**: SESSION_EXPIRED, CONTEXT_CORRUPTED
- **Recoverable (retry)**: NETWORK_ERROR, UNKNOWN

## Commits

1. `3498cf0` - feat(23-error-handling-23-01): create retry strategy module with exponential backoff
2. `f84e56b` - feat(23-error-handling-23-01): integrate retry strategy into auto-scraper

## Decisions Made

1. **Implemented circuit breaker in Task 1**: Combined retry strategy and circuit breaker in single module for cohesive error handling, rather than adding circuit breaker later in Task 3. This provides better encapsulation and cleaner API.

2. **Immediate retry scheduling**: Network errors trigger immediate retry via `setTimeout(runScraper, delayMs)` rather than waiting for next 5-minute interval. This allows faster recovery from transient issues.

3. **Circuit OPEN doesn't exit**: When circuit opens, auto-scraper pauses attempts but doesn't exit the process. This allows automatic recovery after the 60s cool-down period without requiring manual restart.

4. **No external retry libraries**: Implemented retry logic natively to avoid dependencies and maintain full control over error classification and circuit breaker integration.

## Issues Encountered

None. Implementation proceeded smoothly with all verification checks passing on first build.

## Next Steps

Ready for Phase 23 Plan 2 or Phase 24 (Data Extraction Enhancement).

**Verification status:**
- ✅ TypeScript builds without errors
- ✅ retry-strategy.ts exports RetryStrategy class with exponential backoff
- ✅ Auto-scraper uses RetryStrategy for error handling
- ✅ Fatal errors (SESSION_EXPIRED, CONTEXT_CORRUPTED) exit immediately
- ✅ Recoverable errors (NETWORK_ERROR) retry with exponential backoff
- ✅ Circuit breaker opens after 3 failures, closes after recovery
- ✅ Successful scrapes reset retry state and continue 5-minute interval
- ✅ Verbose logging shows retry attempts, delays, and circuit state
