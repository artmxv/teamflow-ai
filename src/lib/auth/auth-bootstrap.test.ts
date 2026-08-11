import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldIdentifyUserBeforeWorkspaceRestore } from "./auth-bootstrap.js";

describe("shouldIdentifyUserBeforeWorkspaceRestore", () => {
  it("is true for OAuth fast-path with cleared active workspace and no known user", () => {
    assert.equal(
      shouldIdentifyUserBeforeWorkspaceRestore({
        hasRestoreUser: false,
        hasActiveWorkspaceId: false,
      }),
      true,
    );
  });

  it("is false when login/cached user identity is already known", () => {
    assert.equal(
      shouldIdentifyUserBeforeWorkspaceRestore({
        hasRestoreUser: true,
        hasActiveWorkspaceId: false,
      }),
      false,
    );
  });

  it("is false on cold reload when an active workspace id is already set", () => {
    assert.equal(
      shouldIdentifyUserBeforeWorkspaceRestore({
        hasRestoreUser: false,
        hasActiveWorkspaceId: true,
      }),
      false,
    );
  });
});
