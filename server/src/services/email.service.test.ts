import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sendWorkspaceInviteEmail } from "./email.service.js";

describe("production invitation logging", () => {
  it("does not log recipient, invitation URL, token, or email content", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const originalInfo = console.info;
    const captured: unknown[][] = [];
    process.env.NODE_ENV = "production";
    console.info = (...args: unknown[]) => {
      captured.push(args);
    };

    try {
      await sendWorkspaceInviteEmail({
        to: "private-recipient@example.com",
        workspaceName: "Sensitive workspace",
        role: "MEMBER",
        acceptUrl: "https://teamflow.example/invitations/accept?token=secret-invite-token",
        expiresAt: new Date("2026-08-11T12:00:00.000Z"),
        inviterName: "Private Inviter",
        inviterEmail: "private-inviter@example.com",
      });
    } finally {
      console.info = originalInfo;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }

    const output = JSON.stringify(captured);
    assert.doesNotMatch(output, /secret-invite-token/);
    assert.doesNotMatch(output, /private-recipient@example\.com/);
    assert.doesNotMatch(output, /private-inviter@example\.com/);
    assert.doesNotMatch(output, /Sensitive workspace/);
    assert.match(output, /EMAIL_PROVIDER_CONSOLE/);
  });
});
