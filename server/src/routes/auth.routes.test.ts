import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loginController, registerController } from "../controllers/auth.controller.js";
import {
  googleAuthCallbackController,
  googleAuthStartController,
} from "../controllers/google-auth.controller.js";
import { authRateLimitMiddleware } from "../middleware/auth-rate-limit.middleware.js";
import { authRouter } from "./auth.routes.js";

type RouteLayer = {
  route?: {
    path: string;
    stack: { handle: unknown }[];
  };
};

function handlersFor(path: string): unknown[] {
  const layer = (authRouter.stack as RouteLayer[]).find((item) => item.route?.path === path);
  return layer?.route?.stack.map((item) => item.handle) ?? [];
}

describe("auth route rate-limit scope", () => {
  it("limits only password login and registration", () => {
    assert.deepEqual(handlersFor("/login"), [authRateLimitMiddleware, loginController]);
    assert.deepEqual(handlersFor("/register"), [authRateLimitMiddleware, registerController]);
    assert.deepEqual(handlersFor("/google"), [googleAuthStartController]);
    assert.deepEqual(handlersFor("/google/callback"), [googleAuthCallbackController]);
  });
});
