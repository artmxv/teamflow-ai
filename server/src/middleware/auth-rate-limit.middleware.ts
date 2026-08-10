import type { NextFunction, Request, RequestHandler, Response } from "express";

import {
  authRateLimiter,
  type InMemoryAuthRateLimiter,
} from "../services/auth-rate-limit.service.js";

export function createAuthRateLimitMiddleware(
  limiter: InMemoryAuthRateLimiter = authRateLimiter,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const decision = limiter.consume(req.ip || req.socket.remoteAddress || "unknown");
    if (decision.allowed) {
      next();
      return;
    }

    res.setHeader("Retry-After", String(decision.retryAfterSeconds));
    res.status(429).json({
      code: "AUTH_RATE_LIMITED",
      message: "Too many authentication attempts. Please try again later.",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  };
}

export const authRateLimitMiddleware = createAuthRateLimitMiddleware();
