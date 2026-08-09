import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InMemoryAiCopilotRateLimiter } from "./ai-copilot-rate-limit.service.js";

describe("InMemoryAiCopilotRateLimiter", () => {
  it("allows the configured request budget and then rejects with retry metadata", () => {
    const limiter = new InMemoryAiCopilotRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    assert.deepEqual(limiter.consume("user-1", "workspace-1", 1_000), {
      allowed: true,
      remaining: 2,
      resetAtMs: 61_000,
    });
    assert.equal(limiter.consume("user-1", "workspace-1", 2_000).allowed, true);
    assert.equal(limiter.consume("user-1", "workspace-1", 3_000).allowed, true);
    assert.deepEqual(limiter.consume("user-1", "workspace-1", 4_000), {
      allowed: false,
      remaining: 0,
      resetAtMs: 61_000,
      retryAfterSeconds: 57,
    });
  });

  it("keeps separate buckets for different users", () => {
    const limiter = new InMemoryAiCopilotRateLimiter({ maxRequests: 1 });
    assert.equal(limiter.consume("user-a", "workspace", 1_000).allowed, true);
    assert.equal(limiter.consume("user-a", "workspace", 1_001).allowed, false);
    assert.equal(limiter.consume("user-b", "workspace", 1_001).allowed, true);
  });

  it("keeps separate buckets for different workspaces", () => {
    const limiter = new InMemoryAiCopilotRateLimiter({ maxRequests: 1 });
    assert.equal(limiter.consume("user", "workspace-a", 1_000).allowed, true);
    assert.equal(limiter.consume("user", "workspace-a", 1_001).allowed, false);
    assert.equal(limiter.consume("user", "workspace-b", 1_001).allowed, true);
  });

  it("resets expired windows and eventually cleans stale entries", () => {
    const limiter = new InMemoryAiCopilotRateLimiter({
      maxRequests: 1,
      windowMs: 1_000,
      cleanupIntervalMs: 1_000,
    });
    assert.equal(limiter.consume("user-a", "workspace", 0).allowed, true);
    assert.equal(limiter.consume("user-a", "workspace", 999).allowed, false);
    assert.equal(limiter.consume("user-a", "workspace", 1_000).allowed, true);
    limiter.consume("user-b", "workspace", 1_500);
    assert.equal(limiter.entryCount, 2);
    limiter.cleanupExpired(3_000);
    assert.equal(limiter.entryCount, 0);
  });

  it("clear removes all buckets", () => {
    const limiter = new InMemoryAiCopilotRateLimiter();
    limiter.consume("user", "workspace", 1_000);
    assert.equal(limiter.entryCount, 1);
    limiter.clear();
    assert.equal(limiter.entryCount, 0);
  });
});
