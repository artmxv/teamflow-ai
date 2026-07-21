import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateActiveWorkspaceMembership } from "./socket-membership-utils.js";

describe("socket workspace membership validation", () => {
  const memberships = [
    { userId: "u1", workspaceId: "w1", status: "ACTIVE" },
    { userId: "u1", workspaceId: "w2", status: "REMOVED" },
    { userId: "u2", workspaceId: "w1", status: "INVITED" },
  ];

  it("rejects missing workspace id", () => {
    assert.equal(
      validateActiveWorkspaceMembership({
        userId: "u1",
        workspaceId: null,
        memberships,
      }),
      "missing_workspace",
    );
  });

  it("rejects inactive membership", () => {
    assert.equal(
      validateActiveWorkspaceMembership({
        userId: "u1",
        workspaceId: "w2",
        memberships,
      }),
      "forbidden",
    );
  });

  it("rejects cross-workspace / non-member access", () => {
    assert.equal(
      validateActiveWorkspaceMembership({
        userId: "u2",
        workspaceId: "w1",
        memberships,
      }),
      "forbidden",
    );
    assert.equal(
      validateActiveWorkspaceMembership({
        userId: "u1",
        workspaceId: "w-other",
        memberships,
      }),
      "forbidden",
    );
  });

  it("accepts active membership in the requested workspace", () => {
    assert.equal(
      validateActiveWorkspaceMembership({
        userId: "u1",
        workspaceId: "w1",
        memberships,
      }),
      "ok",
    );
  });
});
