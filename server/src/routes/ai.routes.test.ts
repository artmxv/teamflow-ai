import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getWorkspaceAiSummaryController,
  postAiCopilotChatController,
} from "../controllers/ai.controller.js";
import { aiRouter } from "./ai.routes.js";

type RouteLayer = {
  route?: {
    path: string;
    stack: { handle: unknown }[];
  };
};

function handlersFor(path: string): unknown[] {
  const layer = (aiRouter.stack as RouteLayer[]).find((item) => item.route?.path === path);
  return layer?.route?.stack.map((item) => item.handle) ?? [];
}

describe("AI route hardening scope", () => {
  it("keeps workspace-summary on its existing controller without the Copilot limiter", () => {
    assert.deepEqual(handlersFor("/workspace-summary"), [getWorkspaceAiSummaryController]);
  });

  it("wires the hardened handler only to Copilot chat", () => {
    assert.deepEqual(handlersFor("/copilot/chat"), [postAiCopilotChatController]);
  });
});
