import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPresenceSnapshot,
  applyPresenceUpdate,
  clearChatPresence,
  getOnlineUserIds,
  getPresenceWorkspaceId,
  isUserOnline,
  resetChatPresenceForTests,
} from "../realtime/chat-presence-state.js";
import {
  resolveDirectPresenceUserId,
  shouldShowDirectPresence,
} from "../chat/presence.js";

describe("chat presence client state", () => {
  it("snapshot replaces the current online set", () => {
    resetChatPresenceForTests();
    applyPresenceSnapshot({ workspaceId: "w1", onlineUserIds: ["u1", "u2"] });
    applyPresenceSnapshot({ workspaceId: "w1", onlineUserIds: ["u3"] });

    assert.equal(getPresenceWorkspaceId(), "w1");
    assert.deepEqual(Array.from(getOnlineUserIds()).sort(), ["u3"]);
    assert.equal(isUserOnline("u1"), false);
    assert.equal(isUserOnline("u3"), true);
  });

  it("update adds and removes a user", () => {
    resetChatPresenceForTests();
    applyPresenceSnapshot({ workspaceId: "w1", onlineUserIds: ["u1"] });

    applyPresenceUpdate({ workspaceId: "w1", userId: "u2", isOnline: true });
    assert.equal(isUserOnline("u2"), true);

    applyPresenceUpdate({ workspaceId: "w1", userId: "u1", isOnline: false });
    assert.equal(isUserOnline("u1"), false);
    assert.deepEqual(Array.from(getOnlineUserIds()), ["u2"]);
  });

  it("ignores updates for a different workspace once scoped", () => {
    resetChatPresenceForTests();
    applyPresenceSnapshot({ workspaceId: "w1", onlineUserIds: ["u1"] });
    applyPresenceUpdate({ workspaceId: "w2", userId: "u2", isOnline: true });

    assert.equal(isUserOnline("u2"), false);
    assert.deepEqual(Array.from(getOnlineUserIds()), ["u1"]);
  });

  it("disconnect / clear removes stale presence", () => {
    resetChatPresenceForTests();
    applyPresenceSnapshot({ workspaceId: "w1", onlineUserIds: ["u1", "u2"] });
    clearChatPresence();

    assert.equal(getPresenceWorkspaceId(), null);
    assert.equal(getOnlineUserIds().size, 0);
    assert.equal(isUserOnline("u1"), false);
  });

  it("workspace change clears the previous workspace state", () => {
    resetChatPresenceForTests();
    applyPresenceSnapshot({ workspaceId: "w1", onlineUserIds: ["u1"] });
    clearChatPresence();
    applyPresenceSnapshot({ workspaceId: "w2", onlineUserIds: ["u9"] });

    assert.equal(getPresenceWorkspaceId(), "w2");
    assert.equal(isUserOnline("u1"), false);
    assert.equal(isUserOnline("u9"), true);
  });
});

describe("direct presence helpers", () => {
  it("resolves the other participant for a direct conversation", () => {
    assert.equal(
      resolveDirectPresenceUserId(
        {
          type: "DIRECT",
          otherParticipant: {
            id: "u-other",
            name: "Other",
            email: "other@example.com",
            avatar: "O",
            avatarUrl: null,
          },
        },
        "u-me",
      ),
      "u-other",
    );
  });

  it("never shows presence for the workspace general conversation", () => {
    assert.equal(
      resolveDirectPresenceUserId(
        {
          type: "WORKSPACE",
          otherParticipant: null,
        },
        "u-me",
      ),
      null,
    );
    assert.equal(
      shouldShowDirectPresence(
        {
          type: "WORKSPACE",
          otherParticipant: null,
        },
        "u-me",
        true,
      ),
      false,
    );
  });

  it("does not show presence for the current user", () => {
    assert.equal(
      resolveDirectPresenceUserId(
        {
          type: "DIRECT",
          otherParticipant: {
            id: "u-me",
            name: "Me",
            email: "me@example.com",
            avatar: "M",
            avatarUrl: null,
          },
        },
        "u-me",
      ),
      null,
    );
  });

  it("hides the indicator when the participant is offline", () => {
    assert.equal(
      shouldShowDirectPresence(
        {
          type: "DIRECT",
          otherParticipant: {
            id: "u-other",
            name: "Other",
            email: "other@example.com",
            avatar: "O",
            avatarUrl: null,
          },
        },
        "u-me",
        false,
      ),
      false,
    );
  });
});
