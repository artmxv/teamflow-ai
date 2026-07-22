import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDistinctDirectParticipants,
  buildDirectIdentityKey,
  buildWorkspaceGeneralIdentityKey,
  canRenameWorkspaceConversation,
  CHAT_CONVERSATION_TITLE_MAX_LENGTH,
  compareConversationsForSidebar,
  countUnreadMessages,
  findOldestUnreadMessageId,
  isMessageUnreadForMember,
  partitionUnifiedConversationList,
  resolveChatConversationRenameAccess,
  resolveInitialConversationId,
  resolveInitialScrollTarget,
  validateChatConversationTitle,
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

  it("keeps a single pinned-first unified list without type sections", () => {
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
      {
        id: "c4",
        isPinned: false,
        latestMessageAt: "2026-07-17T11:00:00.000Z",
        updatedAt: "2026-07-17T11:00:00.000Z",
        type: "DIRECT" as const,
        title: null,
      },
    ].sort(compareConversationsForSidebar);

    const unified = partitionUnifiedConversationList(sorted);
    assert.deepEqual(
      unified.ordered.map((item) => item.id),
      ["c2", "c3", "c1", "c4"],
    );
    assert.equal(unified.pinned.length, 1);
    assert.equal(unified.rest.length, 3);
  });
});

describe("chat-conversation-utils initial scroll target", () => {
  const chronological = [
    {
      id: "m1",
      senderId: "other",
      createdAt: "2026-07-17T10:00:00.000Z",
    },
    {
      id: "m2",
      senderId: "me",
      createdAt: "2026-07-17T11:00:00.000Z",
    },
    {
      id: "m3",
      senderId: "other",
      createdAt: "2026-07-17T12:00:00.000Z",
    },
    {
      id: "m4",
      senderId: "other",
      createdAt: "2026-07-17T13:00:00.000Z",
    },
    {
      id: "m5",
      senderId: "other",
      createdAt: "2026-07-17T14:00:00.000Z",
    },
  ];

  it("selects the newest/bottom when there are no unread messages", () => {
    assert.deepEqual(
      resolveInitialScrollTarget({
        messages: chronological,
        currentUserId: "me",
        lastReadAt: "2026-07-17T14:00:00.000Z",
      }),
      { type: "bottom" },
    );
    assert.equal(
      findOldestUnreadMessageId(chronological, "me", "2026-07-17T14:00:00.000Z"),
      null,
    );
  });

  it("selects the single unread message", () => {
    assert.deepEqual(
      resolveInitialScrollTarget({
        messages: chronological,
        currentUserId: "me",
        lastReadAt: "2026-07-17T13:00:00.000Z",
      }),
      { type: "message", messageId: "m5" },
    );
  });

  it("selects the oldest unread when several arrived", () => {
    assert.deepEqual(
      resolveInitialScrollTarget({
        messages: chronological,
        currentUserId: "me",
        lastReadAt: "2026-07-17T11:30:00.000Z",
      }),
      { type: "message", messageId: "m3" },
    );
  });

  it("does not treat the current user's own messages as unread", () => {
    assert.equal(
      findOldestUnreadMessageId(chronological, "me", "2026-07-17T10:30:00.000Z"),
      "m3",
    );
    assert.deepEqual(
      resolveInitialScrollTarget({
        messages: chronological,
        currentUserId: "me",
        lastReadAt: "2026-07-17T10:30:00.000Z",
      }),
      { type: "message", messageId: "m3" },
    );
  });

  it("keeps the unread boundary from the captured lastReadAt before mark-as-read", () => {
    const capturedLastReadAt = "2026-07-17T11:30:00.000Z";
    const beforeMark = resolveInitialScrollTarget({
      messages: chronological,
      currentUserId: "me",
      lastReadAt: capturedLastReadAt,
    });
    assert.deepEqual(beforeMark, { type: "message", messageId: "m3" });

    // Mark-as-read would move lastReadAt to the newest message. Scroll target
    // must keep using the captured boundary, not the updated value.
    const afterMarkWouldBe = "2026-07-17T14:00:00.000Z";
    assert.deepEqual(
      resolveInitialScrollTarget({
        messages: chronological,
        currentUserId: "me",
        lastReadAt: afterMarkWouldBe,
      }),
      { type: "bottom" },
    );
    assert.deepEqual(
      resolveInitialScrollTarget({
        messages: chronological,
        currentUserId: "me",
        lastReadAt: capturedLastReadAt,
      }),
      beforeMark,
    );
  });
});

describe("chat-conversation-utils rename authorization", () => {
  it("allows OWNER and ADMIN to rename workspace general conversations", () => {
    assert.equal(canRenameWorkspaceConversation("OWNER", "WORKSPACE"), true);
    assert.equal(canRenameWorkspaceConversation("ADMIN", "WORKSPACE"), true);
    assert.equal(canRenameWorkspaceConversation("MEMBER", "WORKSPACE"), false);
  });

  it("rejects renaming direct conversations", () => {
    assert.equal(canRenameWorkspaceConversation("OWNER", "DIRECT"), false);
    assert.equal(
      resolveChatConversationRenameAccess({
        role: "OWNER",
        conversationType: "DIRECT",
        conversationExistsInWorkspace: true,
      }),
      "invalid_type",
    );
  });

  it("rejects empty and oversized names", () => {
    assert.deepEqual(validateChatConversationTitle(""), {
      ok: false,
      reason: "empty",
    });
    assert.deepEqual(validateChatConversationTitle("   "), {
      ok: false,
      reason: "empty",
    });
    assert.deepEqual(validateChatConversationTitle(null), {
      ok: false,
      reason: "empty",
    });
    assert.deepEqual(
      validateChatConversationTitle("a".repeat(CHAT_CONVERSATION_TITLE_MAX_LENGTH + 1)),
      { ok: false, reason: "too_long" },
    );
    assert.deepEqual(validateChatConversationTitle("  Team chat  "), {
      ok: true,
      title: "Team chat",
    });
  });

  it("rejects cross-workspace / missing conversations as not_found", () => {
    assert.equal(
      resolveChatConversationRenameAccess({
        role: "OWNER",
        conversationType: "WORKSPACE",
        conversationExistsInWorkspace: false,
      }),
      "not_found",
    );
  });

  it("rejects members even when the workspace conversation exists", () => {
    assert.equal(
      resolveChatConversationRenameAccess({
        role: "MEMBER",
        conversationType: "WORKSPACE",
        conversationExistsInWorkspace: true,
      }),
      "forbidden",
    );
  });
});
