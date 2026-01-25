/**
 * Retry Strategy Module
 * Implements exponential backoff with jitter and circuit breaker pattern
 *
 * Features:
 * - Exponential backoff with configurable base/max delays
 * - Jitter to prevent thundering herd
 * - Error classification (recoverable vs fatal)
 * - Circuit breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
 */

// Error categories from Phase 22
export enum ErrorCategory {
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  CONTEXT_CORRUPTED = 'CONTEXT_CORRUPTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Too many failures, blocking requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number; // Max jitter in seconds
  failureThreshold: number; // Circuit opens after this many failures
  successThreshold: number; // Circuit closes after this many successes in HALF_OPEN
  openDurationMs: number; // How long circuit stays OPEN before HALF_OPEN
}

export class RetryStrategy {
  private config: RetryConfig;
  private attemptCount: number = 0;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private circuitOpenedAt: number | null = null;

  constructor(config?: Partial<RetryConfig>) {
    // Default configuration
    this.config = {
      maxAttempts: 5,
      baseDelayMs: 30000, // 30 seconds
      maxDelayMs: 300000, // 5 minutes
      jitterFactor: 10, // 0-10 seconds
      failureThreshold: 3,
      successThreshold: 2,
      openDurationMs: 60000, // 60 seconds
      ...config,
    };
  }

  /**
   * Calculates exponential backoff delay with jitter
   * Formula: min(baseDelay * 2^attempt + random(0, jitter), maxDelay)
   */
  calculateDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attemptNumber - 1);
    const jitterMs = Math.random() * this.config.jitterFactor * 1000;
    const totalDelay = exponentialDelay + jitterMs;

    return Math.min(totalDelay, this.config.maxDelayMs);
  }

  /**
   * Determines if error is recoverable and retry should be attempted
   * Fatal errors: SESSION_EXPIRED, CONTEXT_CORRUPTED → immediate exit
   * Recoverable errors: NETWORK_ERROR → retry with backoff
   */
  shouldRetry(errorCategory: ErrorCategory, attemptNumber: number): boolean {
    // Fatal errors never retry
    if (errorCategory === ErrorCategory.SESSION_EXPIRED ||
        errorCategory === ErrorCategory.CONTEXT_CORRUPTED) {
      return false;
    }

    // Check if max attempts exceeded
    if (attemptNumber >= this.config.maxAttempts) {
      return false;
    }

    // Check if circuit is open and cool-down period not elapsed
    if (this.isCircuitOpen()) {
      return false;
    }

    // Network errors and unknown errors are recoverable
    return errorCategory === ErrorCategory.NETWORK_ERROR ||
           errorCategory === ErrorCategory.UNKNOWN;
  }

  /**
   * Records a retry attempt
   */
  recordAttempt(): void {
    this.attemptCount++;
  }

  /**
   * Records a successful operation
   * Handles circuit state transitions: OPEN → HALF_OPEN → CLOSED
   */
  recordSuccess(): void {
    this.attemptCount = 0;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        // Transition to CLOSED after threshold successes
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.circuitOpenedAt = null;
      }
    } else if (this.circuitState === CircuitState.OPEN) {
      // Transition from OPEN to HALF_OPEN on first success after cool-down
      this.circuitState = CircuitState.HALF_OPEN;
      this.successCount = 1;
      this.failureCount = 0;
    } else {
      // CLOSED state - reset failure count
      this.failureCount = 0;
    }
  }

  /**
   * Records a failed operation
   * Handles circuit state transitions: CLOSED → OPEN
   */
  recordFailure(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Failure in HALF_OPEN → back to OPEN
      this.circuitState = CircuitState.OPEN;
      this.circuitOpenedAt = Date.now();
      this.successCount = 0;
      this.failureCount++;
    } else if (this.circuitState === CircuitState.CLOSED) {
      this.failureCount++;

      if (this.failureCount >= this.config.failureThreshold) {
        // Transition to OPEN after threshold failures
        this.circuitState = CircuitState.OPEN;
        this.circuitOpenedAt = Date.now();
      }
    } else {
      // Already OPEN - increment failure count
      this.failureCount++;
    }
  }

  /**
   * Checks if circuit is open and blocks requests
   * Automatically transitions OPEN → HALF_OPEN after cool-down period
   */
  isCircuitOpen(): boolean {
    if (this.circuitState !== CircuitState.OPEN) {
      return false;
    }

    // Check if cool-down period elapsed
    if (this.circuitOpenedAt !== null) {
      const elapsed = Date.now() - this.circuitOpenedAt;

      if (elapsed >= this.config.openDurationMs) {
        // Transition to HALF_OPEN to test recovery
        this.circuitState = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return false;
      }
    }

    return true;
  }

  /**
   * Returns current circuit state for logging
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Returns current attempt count
   */
  getAttemptCount(): number {
    return this.attemptCount;
  }

  /**
   * Resets retry state (call after successful scrape)
   */
  reset(): void {
    this.attemptCount = 0;
  }

  /**
   * Returns max attempts configuration
   */
  getMaxAttempts(): number {
    return this.config.maxAttempts;
  }

  /**
   * Classifies error message into ErrorCategory
   */
  static classifyError(errorMessage: string): ErrorCategory {
    if (errorMessage.includes('SESSION_EXPIRED')) {
      return ErrorCategory.SESSION_EXPIRED;
    } else if (errorMessage.includes('NETWORK_ERROR')) {
      return ErrorCategory.NETWORK_ERROR;
    } else if (errorMessage.includes('CONTEXT_CORRUPTED')) {
      return ErrorCategory.CONTEXT_CORRUPTED;
    } else {
      return ErrorCategory.UNKNOWN;
    }
  }
}
