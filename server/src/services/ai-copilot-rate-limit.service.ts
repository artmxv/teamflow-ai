export const AI_COPILOT_RATE_LIMIT_MAX_REQUESTS = 10;
export const AI_COPILOT_RATE_LIMIT_WINDOW_MS = 60_000;

type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

export type AiCopilotRateLimitDecision =
  | { allowed: true; remaining: number; resetAtMs: number }
  | { allowed: false; remaining: 0; resetAtMs: number; retryAfterSeconds: number };

export type InMemoryAiCopilotRateLimiterOptions = {
  maxRequests?: number;
  windowMs?: number;
  cleanupIntervalMs?: number;
};

/**
 * Process-local MVP limiter. Multi-instance deployments must replace this with a shared store
 * such as Redis so all instances enforce one user+workspace budget.
 */
export class InMemoryAiCopilotRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly cleanupIntervalMs: number;
  private nextCleanupAtMs = 0;

  constructor(options: InMemoryAiCopilotRateLimiterOptions = {}) {
    this.maxRequests = Math.max(
      1,
      Math.floor(options.maxRequests ?? AI_COPILOT_RATE_LIMIT_MAX_REQUESTS),
    );
    this.windowMs = Math.max(
      1_000,
      Math.floor(options.windowMs ?? AI_COPILOT_RATE_LIMIT_WINDOW_MS),
    );
    this.cleanupIntervalMs = Math.max(
      1_000,
      Math.floor(options.cleanupIntervalMs ?? this.windowMs),
    );
  }

  consume(
    userId: string,
    workspaceId: string,
    nowMs: number = Date.now(),
  ): AiCopilotRateLimitDecision {
    this.cleanupExpired(nowMs);
    const key = `${userId.length}:${userId}${workspaceId}`;
    const existing = this.buckets.get(key);
    const bucket =
      !existing || existing.resetAtMs <= nowMs
        ? { count: 0, resetAtMs: nowMs + this.windowMs }
        : existing;

    if (bucket.count >= this.maxRequests) {
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        remaining: 0,
        resetAtMs: bucket.resetAtMs,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1_000)),
      };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: this.maxRequests - bucket.count,
      resetAtMs: bucket.resetAtMs,
    };
  }

  cleanupExpired(nowMs: number = Date.now()): void {
    if (nowMs < this.nextCleanupAtMs) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAtMs <= nowMs) this.buckets.delete(key);
    }
    this.nextCleanupAtMs = nowMs + this.cleanupIntervalMs;
  }

  clear(): void {
    this.buckets.clear();
    this.nextCleanupAtMs = 0;
  }

  get entryCount(): number {
    return this.buckets.size;
  }
}

export const aiCopilotRateLimiter = new InMemoryAiCopilotRateLimiter();
