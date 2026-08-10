import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InMemoryAuthRateLimiter } from "./auth-rate-limit.service.js";

describe("InMemoryAuthRateLimiter", () => {
  it("allows the configured budget and then rejects until reset", () => {
    const limiter = new InMemoryAuthRateLimiter({ maxRequests: 2, windowMs: 60_000 });

    assert.equal(limiter.consume("203.0.113.10", 1_000).allowed, true);
    assert.equal(limiter.consume("203.0.113.10", 2_000).allowed, true);
    assert.deepEqual(limiter.consume("203.0.113.10", 3_000), {
      allowed: false,
      remaining: 0,
      resetAtMs: 61_000,
      retryAfterSeconds: 58,
    });
    assert.equal(limiter.consume("203.0.113.10", 61_000).allowed, true);
  });

  it("keeps separate buckets for separate server-derived client IPs", () => {
    const limiter = new InMemoryAuthRateLimiter({ maxRequests: 1 });

    assert.equal(limiter.consume("203.0.113.10", 1_000).allowed, true);
    assert.equal(limiter.consume("203.0.113.10", 1_001).allowed, false);
    assert.equal(limiter.consume("203.0.113.11", 1_001).allowed, true);
  });

  it("cleans expired buckets and bounds unique-client memory", () => {
    const limiter = new InMemoryAuthRateLimiter({
      maxRequests: 1,
      windowMs: 1_000,
      cleanupIntervalMs: 1_000,
      maxBuckets: 2,
    });

    limiter.consume("203.0.113.1", 0);
    limiter.consume("203.0.113.2", 0);
    limiter.consume("203.0.113.3", 0);
    limiter.consume("203.0.113.4", 0);
    assert.equal(limiter.entryCount, 3, "two client buckets plus one bounded overflow bucket");

    limiter.cleanupExpired(1_000);
    assert.equal(limiter.entryCount, 0);
  });
});
