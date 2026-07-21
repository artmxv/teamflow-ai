import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDistinctDirectParticipants,
  buildDirectIdentityKey,
  buildWorkspaceGeneralIdentityKey,
  compareConversationsForSidebar,
  countUnreadMessages,
  isMessageUnreadForMember,
  resolveInitialConversationId,
} from "./chat-conversation-utils.js";

describe("chat-conversation-utils identity keys", () => {
  it("builds a stable workspace general identity key", () => {
    assert.equal(
      buildWorkspaceGeneralIdentityKey("ws_1"),
      "workspace:ws_1:general",
    );
  });

  it("builds the same direct key regardless of participant order", () => {
    const left = buildDirectIdentityKey("ws_1", "user_b", "user_a");
    const right = buildDirectIdentityKey("ws_1", "user_a", "user_b");
    assert.equal(left, right);
    assert.equal(left, "workspace:ws_1:direct:user_a:user_b");
  });

  it("rejects self direct conversations", () => {
    assert.equal(assertDistinctDirectParticipants("user_1", "user_1"), "self");
    assert.equal(assertDistinctDirectParticipants("user_1", "user_2"), "ok");
  });
});

describe("chat-conversation-utils unread counting", () => {
  const messages = [
    { senderId: "me", createdAt: "2026-07-17T10:00:00.000Z" },
    { senderId: "other", createdAt: "2026-07-17T11:00:00.000Z" },
    { senderId: "other", createdAt: "2026-07-17T12:00:00.000Z" },
    { senderId: "me", createdAt: "2026-07-17T13:00:00.000Z" },
  ];

  it("ignores the current user's own messages", () => {
    assert.equal(countUnreadMessages(messages, "me", null), 2);
    assert.equal(
      countUnreadMessages(messages, "me", "2026-07-17T10:30:00.000Z"),
      2,
    );
  });

  it("resets unread after lastReadAt catches up", () => {
    assert.equal(
      countUnreadMessages(messages, "me", "2026-07-17T12:00:00.000Z"),
      0,
    );
    assert.equal(
      isMessageUnreadForMember({
        senderId: "other",
        createdAt: "2026-07-17T12:00:00.000Z",
        currentUserId: "me",
        lastReadAt: "2026-07-17T12:00:00.000Z",
      }),
      false,
    );
    assert.equal(
      isMessageUnreadForMember({
        senderId: "other",
        createdAt: "2026-07-17T12:00:01.000Z",
        currentUserId: "me",
        lastReadAt: "2026-07-17T12:00:00.000Z",
      }),
      true,
    );
  });

  it("never marks own messages as unread", () => {
    assert.equal(
      isMessageUnreadForMember({
        senderId: "me",
        createdAt: "2026-07-17T15:00:00.000Z",
        currentUserId: "me",
        lastReadAt: null,
      }),
      false,
    );
  });
});

describe("chat-conversation-utils sidebar sorting and selection", () => {
  it("keeps pinned conversations first, then latest activity", () => {
    const sorted = [
      {
        id: "c1",
        isPinned: false,
        latestMessageAt: "2026-07-17T12:00:00.000Z",
        updatedAt: "2026-07-17T12:00:00.000Z",
        type: "DIRECT" as const,
        title: null,
      },
      {
        id: "c2",
        isPinned: true,
        latestMessageAt: "2026-07-17T10:00:00.000Z",
        updatedAt: "2026-07-17T10:00:00.000Z",
        type: "DIRECT" as const,
        title: null,
      },
      {
        id: "c3",
        isPinned: false,
        latestMessageAt: "2026-07-17T13:00:00.000Z",
        updatedAt: "2026-07-17T13:00:00.000Z",
        type: "WORKSPACE" as const,
        title: null,
      },
    ].sort(compareConversationsForSidebar);

    assert.deepEqual(
      sorted.map((item) => item.id),
      ["c2", "c3", "c1"],
    );
  });

  it("prefers URL conversation, then workspace general, then first available", () => {
    const conversations = [
      { id: "dm_1", type: "DIRECT" as const },
      { id: "gen_1", type: "WORKSPACE" as const },
      { id: "dm_2", type: "DIRECT" as const },
    ];

    assert.equal(
      resolveInitialConversationId({
        requestedId: "dm_2",
        conversations,
      }),
      "dm_2",
    );
    assert.equal(
      resolveInitialConversationId({
        requestedId: "missing",
        conversations,
      }),
      "gen_1",
    );
    assert.equal(
      resolveInitialConversationId({
        requestedId: null,
        conversations: [{ id: "dm_only", type: "DIRECT" }],
      }),
      "dm_only",
    );
  });
});
