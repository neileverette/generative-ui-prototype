# Phase 34: Error Handling & Fallbacks - Executable Plan

## Objective

Add comprehensive error handling, retry logic, circuit breakers, and graceful degradation to make the scraper-to-EC2 sync production-ready. Improve resilience across three layers: scraper sync client, EC2 API endpoints, and widget frontend.

## Execution Context

**Current State:**
- Scraper sync client has basic 10s timeout and error logging (sync-client.ts)
- Scraper has retry strategy with exponential backoff and circuit breaker for scraping (retry-strategy.ts)
- EC2 endpoints have basic error handling (401, 400, 500 responses)
- Widget has minimal error handling (throws on non-ok response)
- No retry logic for failed sync POSTs
- No health check endpoints
- No graceful degradation when EC2 is unavailable

**Files to Modify:**
- `server/claude-scraper/sync-client.ts` - Add retry logic for sync failures
- `server/claude-scraper/auto-scraper.ts` - Integrate sync retry strategy
- `server/index.ts` - Add health check endpoint, improve error responses
- `src/services/mcp-client.ts` - Add retry logic and fallback states
- `server/console-storage.ts` - Add resilience to storage operations

**Architecture:**
```
Laptop Scraper → POST /api/claude/console-usage → EC2 Storage → GET /api/claude/console-usage → Widget
     ↓                      ↓                           ↓                     ↓                    ↓
  Retry logic      Circuit breaker              Health checks         Retry + fallback    Graceful UI
```

## Context

**Prior Work:**
- Phase 22-23: Built retry strategy with exponential backoff and circuit breaker for scraper
- Phase 29: Created EC2 POST endpoint with authentication and validation
- Phase 30: Built sync client with 10s timeout
- Phase 31: Implemented versioned storage with retention policies
- Phase 32: Created EC2 GET endpoint with version/timestamp queries
- Phase 33: Migrated widget to EC2 sync endpoint

**Current Gaps:**
1. Sync failures don't retry - scraper just logs warning and continues
2. No circuit breaker for sync operations (only for scraping)
3. Widget has no retry logic - single fetch failure breaks the widget
4. No health check endpoint for monitoring EC2 availability
5. No graceful degradation when data is unavailable
6. Storage errors aren't recoverable (no retry on write failures)

**Production Scenarios to Handle:**
- Network timeout during sync POST
- EC2 temporarily unavailable (502, 503, 504)
- EC2 storage disk full (500 on write)
- Widget fetch during EC2 restart
- Stale data older than 15 minutes
- Complete EC2 failure (no fallback)

## Tasks

### Task 1: Add Health Check Endpoint
**Goal:** Create GET /api/health endpoint for monitoring EC2 availability

**Steps:**
1. Add GET /api/health endpoint in server/index.ts
2. Check storage directory accessibility (can read/write)
3. Check latest data availability and age
4. Return health status: "healthy", "degraded", "unhealthy"
5. Include metadata: storage status, latest data age, version count
6. Add startup logging for health endpoint

**Success Criteria:**
- Endpoint returns 200 with "healthy" when storage works and data <10min old
- Returns 200 with "degraded" when data 10-30min old
- Returns 503 with "unhealthy" when storage inaccessible or data >30min old
- Response includes: `{ status, storage, latestDataAge, versionCount, timestamp }`

**Files:**
- server/index.ts (add endpoint before SPA fallback)

### Task 2: Add Sync Retry Logic to Scraper
**Goal:** Implement retry strategy for failed sync POSTs with exponential backoff

**Steps:**
1. Create SyncRetryStrategy class extending RetryStrategy in sync-client.ts
2. Configure for sync-specific retries: 3 max attempts, 10s/20s/40s backoff
3. Add syncWithRetry() function that wraps syncToEC2()
4. Classify sync errors: NETWORK (retry), AUTH (no retry), SERVER (retry)
5. Update auto-scraper.ts to use syncWithRetry() instead of syncToEC2()
6. Log retry attempts with attempt number and next retry delay
7. Continue scraper operation even after max sync retries exhausted

**Success Criteria:**
- Network timeouts retry up to 3 times with exponential backoff
- Auth errors (401) fail immediately without retry
- Validation errors (400) fail immediately without retry
- Server errors (500, 502, 503) retry with backoff
- Successful sync resets retry counter
- Scraper continues scraping even if all sync retries fail

**Files:**
- server/claude-scraper/sync-client.ts (add SyncRetryStrategy class)
- server/claude-scraper/auto-scraper.ts (use syncWithRetry)

### Task 3: Add Widget Retry Logic and Fallback States
**Goal:** Make widget resilient to EC2 failures with retry and graceful degradation

**Steps:**
1. Add fetchWithRetry() helper to mcp-client.ts
2. Configure: 2 retries, 2s delay between attempts
3. Update getConsoleUsage() to use fetchWithRetry()
4. Add error categorization: NETWORK (retry), NOT_FOUND (show empty state), SERVER (retry)
5. Return structured error with category and retry flag
6. Widget should display appropriate message based on error category
7. Widget continues auto-refresh even after errors (circuit breaker in widget)

**Success Criteria:**
- Network errors retry 2 times before failing
- 404 errors (no data) fail immediately with clear message
- 500/502/503 errors retry before failing
- Widget displays: "Loading...", "No data available", "Connection error - retrying", "Data unavailable"
- Auto-refresh continues after errors (doesn't crash widget)
- Error messages are user-friendly and actionable

**Files:**
- src/services/mcp-client.ts (add fetchWithRetry, error handling)

### Task 4: Improve EC2 Endpoint Error Responses
**Goal:** Return detailed, actionable error messages for all failure scenarios

**Steps:**
1. Add error classification to POST endpoint: AUTH, VALIDATION, STORAGE, UNKNOWN
2. Include error codes in responses for programmatic handling
3. Add suggested actions in error messages
4. Improve 500 error responses with categorization
5. Add request ID to all error responses for debugging
6. Log error details with stack traces for investigation
7. Add rate limiting info to 429 responses (future-proof)

**Success Criteria:**
- POST 401: Clear auth failure message with API key setup instructions
- POST 400: Specific validation failure (which field, why invalid)
- POST 500: Categorized error (storage, unknown) with request ID
- GET 404: Clear "no data" message with scraper status hint
- GET 500: Detailed error with recovery suggestions
- All errors include: errorCode, message, suggestion, requestId, timestamp

**Files:**
- server/index.ts (update POST and GET endpoints)

### Task 5: Add Storage Operation Resilience
**Goal:** Make storage layer resilient to transient filesystem errors

**Steps:**
1. Add retry logic to saveVersion() in console-storage.ts
2. Retry filesystem writes up to 3 times on ENOSPC, EACCES, EBUSY errors
3. Add exponential backoff: 100ms, 200ms, 400ms
4. Improve error messages with disk space and permission checks
5. Add storage health check function: canWriteToStorage()
6. Call health check before saveVersion() attempts
7. Return detailed error with recovery steps

**Success Criteria:**
- Transient write errors retry automatically
- ENOSPC (disk full) returns clear error without retry
- EACCES (permission) returns clear error without retry
- Write operations succeed after transient failures
- Error messages include: error type, disk space available, directory permissions
- Health check validates storage accessibility on startup

**Files:**
- server/console-storage.ts (add retry logic, health check)

### Task 6: Add Circuit Breaker for Widget Fetch
**Goal:** Prevent widget from hammering EC2 when it's consistently failing

**Steps:**
1. Create simple circuit breaker in mcp-client.ts for getConsoleUsage()
2. States: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing)
3. Open circuit after 3 consecutive failures
4. Block requests for 60s when open
5. Transition to HALF_OPEN after 60s, allow 1 test request
6. Close circuit after successful request in HALF_OPEN state
7. Show "Service temporarily unavailable" message when circuit is open

**Success Criteria:**
- Circuit opens after 3 consecutive fetch failures
- Widget shows "Service temporarily unavailable - retrying in 60s" when open
- Circuit transitions to HALF_OPEN after 60s cooldown
- Successful request closes circuit and resumes normal operation
- Circuit state persists across auto-refresh cycles
- Circuit doesn't prevent manual refresh attempts

**Files:**
- src/services/mcp-client.ts (add CircuitBreaker class)

### Task 7: Add Comprehensive Logging and Monitoring Hooks
**Goal:** Instrument all error paths for monitoring and debugging

**Steps:**
1. Add structured logging to sync-client.ts: [Sync Retry] prefix with attempt numbers
2. Add sync metrics to auto-scraper.ts: success rate, retry rate, average duration
3. Add request IDs to all EC2 endpoint logs for correlation
4. Log circuit breaker state transitions in scraper and widget
5. Add performance metrics: sync duration, storage write duration, fetch duration
6. Create log aggregation helper for monitoring dashboards (future use)
7. Add environment variable SYNC_VERBOSE for detailed debugging

**Success Criteria:**
- All sync attempts logged with: timestamp, duration, status, retry attempt
- Circuit breaker transitions logged with: state change, failure count, timestamp
- Error logs include: error category, request ID, stack trace (verbose mode)
- Performance metrics logged: min/max/avg sync duration over last 10 attempts
- SYNC_VERBOSE enables detailed request/response logging
- Logs are structured (JSON-parseable) for monitoring tools

**Files:**
- server/claude-scraper/sync-client.ts (structured logging)
- server/claude-scraper/auto-scraper.ts (metrics logging)
- server/index.ts (request ID middleware)
- src/services/mcp-client.ts (client-side logging)

## Verification

### Unit Testing
1. Test SyncRetryStrategy with mock fetch failures
2. Test Widget CircuitBreaker state transitions
3. Test Storage retry logic with mock filesystem errors
4. Test Health endpoint with various storage/data states

### Integration Testing
1. Kill EC2 server during sync - verify scraper retries and continues
2. Restart EC2 server during widget fetch - verify widget retries and recovers
3. Fill EC2 disk during sync - verify clear error message
4. Corrupt storage directory - verify health endpoint reports unhealthy
5. Simulate network timeout - verify exponential backoff works
6. Trigger circuit breaker - verify widget shows appropriate message

### Error Scenario Testing
| Scenario | Expected Behavior |
|----------|------------------|
| Network timeout during sync | Retry 3x with backoff, log warning, continue scraping |
| EC2 returns 503 | Retry sync 3x, then fail gracefully |
| Widget fetch during EC2 restart | Retry 2x, show "Connection error", resume on recovery |
| Invalid API key | Fail immediately with auth error, no retry |
| Storage disk full | Fail immediately with clear error, no retry |
| 3 consecutive widget failures | Open circuit, block 60s, retry after cooldown |
| Stale data (20min old) | Show staleness warning, fetch continues |
| No data available | Show "Waiting for data" message |

### Production Readiness Checks
- [ ] Health endpoint returns correct status for all scenarios
- [ ] Sync failures don't crash scraper (logs continue)
- [ ] Widget failures don't crash UI (shows error state)
- [ ] Circuit breaker prevents thundering herd
- [ ] Retry logic uses exponential backoff
- [ ] Error messages are actionable for users
- [ ] Logs are structured for monitoring
- [ ] No infinite retry loops

## Success Criteria

**Functional Requirements:**
- Sync failures retry automatically with exponential backoff
- Widget fetch failures retry before showing error
- Circuit breakers prevent repeated failed requests
- Health endpoint accurately reports system status
- Storage operations retry transient errors
- All error messages are clear and actionable

**Non-Functional Requirements:**
- Max sync retry delay: 40 seconds (10s + 20s + 40s)
- Max widget retry delay: 4 seconds (2s x 2)
- Circuit breaker cooldown: 60 seconds
- Health check response time: <100ms
- No memory leaks from retry timers
- No infinite loops or unbounded retries

**User Experience:**
- Widget shows loading state during retries
- Widget shows clear error messages on failure
- Widget shows staleness warnings for old data
- Widget shows "service unavailable" when circuit is open
- Widget auto-recovers when service returns
- Widget doesn't crash or freeze on errors

## Output

**New Code:**
- `server/claude-scraper/sync-client.ts`: +150 lines (SyncRetryStrategy, syncWithRetry)
- `src/services/mcp-client.ts`: +180 lines (CircuitBreaker, fetchWithRetry)
- `server/console-storage.ts`: +60 lines (retry logic, health check)
- `server/index.ts`: +80 lines (health endpoint, better errors)

**Modified Code:**
- `server/claude-scraper/auto-scraper.ts`: Use syncWithRetry instead of syncToEC2

**Logging Improvements:**
- Structured logs for all sync operations
- Request IDs for correlation
- Performance metrics
- Circuit breaker state transitions

**Documentation:**
- Error codes and meanings
- Retry strategies and delays
- Circuit breaker behavior
- Health endpoint response format

## Notes

**Design Decisions:**
1. Separate retry strategies for sync vs widget (different failure modes)
2. Circuit breaker only for widget (scraper doesn't need it - already has retry logic)
3. Conservative retry counts (3 for sync, 2 for widget) to avoid long delays
4. Fast exponential backoff (10s/20s/40s) for responsive recovery
5. Health endpoint includes data age for alerting

**Future Enhancements:**
- Metrics export for Datadog/Prometheus
- Alerting on circuit breaker open events
- Adaptive retry delays based on error types
- Fallback to cached data when EC2 unavailable
- Rate limiting on sync endpoint

**Testing Strategy:**
- Use chaos engineering approach (kill processes, simulate errors)
- Test all error paths with deliberate failures
- Verify no resource leaks (timers, file handles)
- Load test retry logic under concurrent failures
