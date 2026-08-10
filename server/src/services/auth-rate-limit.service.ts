export const AUTH_RATE_LIMIT_MAX_REQUESTS = 10;
export const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_BUCKETS = 10_000;
const OVERFLOW_BUCKET_KEY = "__overflow__";

type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

export type AuthRateLimitDecision =
  | { allowed: true; remaining: number; resetAtMs: number }
  | { allowed: false; remaining: 0; resetAtMs: number; retryAfterSeconds: number };

export type InMemoryAuthRateLimiterOptions = {
  maxRequests?: number;
  windowMs?: number;
  cleanupIntervalMs?: number;
  maxBuckets?: number;
};

/**
 * Process-local limiter for the current single-instance MVP. A multi-instance deployment must
 * replace this with a shared store so every instance enforces the same authentication budget.
 */
export class InMemoryAuthRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly maxBuckets: number;
  private nextCleanupAtMs = 0;

  constructor(options: InMemoryAuthRateLimiterOptions = {}) {
    this.maxRequests = Math.max(1, Math.floor(options.maxRequests ?? AUTH_RATE_LIMIT_MAX_REQUESTS));
    this.windowMs = Math.max(1_000, Math.floor(options.windowMs ?? AUTH_RATE_LIMIT_WINDOW_MS));
    this.cleanupIntervalMs = Math.max(
      1_000,
      Math.floor(options.cleanupIntervalMs ?? this.windowMs),
    );
    this.maxBuckets = Math.max(1, Math.floor(options.maxBuckets ?? AUTH_RATE_LIMIT_MAX_BUCKETS));
  }

  consume(clientIp: string, nowMs: number = Date.now()): AuthRateLimitDecision {
    this.cleanupExpired(nowMs);

    const normalizedIp = clientIp.trim() || "unknown";
    const requestedKey = `ip:${normalizedIp}`;
    const key =
      this.buckets.has(requestedKey) || this.buckets.size < this.maxBuckets
        ? requestedKey
        : OVERFLOW_BUCKET_KEY;
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

export const authRateLimiter = new InMemoryAuthRateLimiter();
