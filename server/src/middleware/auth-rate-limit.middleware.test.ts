import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";

import { InMemoryAuthRateLimiter } from "../services/auth-rate-limit.service.js";
import { createAuthRateLimitMiddleware } from "./auth-rate-limit.middleware.js";

describe("auth rate-limit middleware", () => {
  it("returns 429 with Retry-After after the client budget is consumed", () => {
    const middleware = createAuthRateLimitMiddleware(
      new InMemoryAuthRateLimiter({ maxRequests: 1, windowMs: 60_000 }),
    );
    const headers = new Map<string, string>();
    let statusCode = 200;
    let payload: unknown;
    let nextCalls = 0;
    const req = {
      ip: "203.0.113.10",
      socket: { remoteAddress: "10.0.0.1" },
    } as Request;
    const res = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
        return this;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(value: unknown) {
        payload = value;
        return this;
      },
    } as unknown as Response;
    const next = (() => {
      nextCalls += 1;
    }) as NextFunction;

    middleware(req, res, next);
    middleware(req, res, next);

    assert.equal(nextCalls, 1);
    assert.equal(statusCode, 429);
    assert.equal(headers.get("Retry-After"), "60");
    assert.deepEqual(payload, {
      code: "AUTH_RATE_LIMITED",
      message: "Too many authentication attempts. Please try again later.",
      retryAfterSeconds: 60,
    });
  });
});
