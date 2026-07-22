import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyIdempotentAddReaction,
  applyReactionEventToSidebarState,
  applyRemoveOwnReaction,
  buildChatReactionUpdatedPayload,
  buildReactionAuthorTooltipLines,
  canReactToChatMessage,
  CHAT_REACTION_EMOJI,
  groupChatReactions,
  isSupportedChatReactionEmoji,
  reactionsAfterMessageDeleted,
  resolveChatReactionDisplayName,
  validateChatReactionEmoji,
} from "./chat-reaction-utils.js";

describe("chat-reaction-utils emoji whitelist", () => {
  it("accepts only the five supported emoji in order", () => {
    assert.deepEqual([...CHAT_REACTION_EMOJI], ["👍", "❤️", "😂", "🎉", "👀"]);
    for (const emoji of CHAT_REACTION_EMOJI) {
      assert.equal(isSupportedChatReactionEmoji(emoji), true);
      assert.deepEqual(validateChatReactionEmoji(emoji), { ok: true, emoji });
    }
  });

  it("rejects unsupported emoji", () => {
    assert.equal(isSupportedChatReactionEmoji("🔥"), false);
    assert.equal(isSupportedChatReactionEmoji(""), false);
    assert.equal(isSupportedChatReactionEmoji(null), false);
    assert.equal(isSupportedChatReactionEmoji(1), false);
    assert.deepEqual(validateChatReactionEmoji("🔥"), {
      ok: false,
      reason: "invalid_emoji",
    });
    assert.deepEqual(validateChatReactionEmoji("👍 "), {
      ok: false,
      reason: "invalid_emoji",
    });
  });
});

describe("chat-reaction-utils grouping", () => {
  const usersById = new Map([
    ["u1", { id: "u1", name: "Alice", avatarUrl: null }],
    ["u2", { id: "u2", name: "Bob", avatarUrl: "https://example.com/b.png" }],
    ["u3", { id: "u3", name: "Cara", avatarUrl: null }],
    ["a", { id: "a", name: "Ann", avatarUrl: null }],
    ["b", { id: "b", name: "Ben", avatarUrl: null }],
    ["c", { id: "c", name: "Cy", avatarUrl: null }],
  ]);

  it("groups by emoji with deterministic order and unique userIds", () => {
    const grouped = groupChatReactions(
      [
        { emoji: "👀", userId: "u2" },
        { emoji: "👍", userId: "u1" },
        { emoji: "😂", userId: "u1" },
        { emoji: "👍", userId: "u2" },
        { emoji: "👍", userId: "u1" },
        { emoji: "❤️", userId: "u3" },
        { emoji: "🔥", userId: "u1" },
      ],
      usersById,
    );

    assert.deepEqual(grouped, [
      {
        emoji: "👍",
        count: 2,
        userIds: ["u1", "u2"],
        reactedBy: [
          { id: "u1", name: "Alice", avatarUrl: null },
          { id: "u2", name: "Bob", avatarUrl: "https://example.com/b.png" },
        ],
      },
      {
        emoji: "❤️",
        count: 1,
        userIds: ["u3"],
        reactedBy: [{ id: "u3", name: "Cara", avatarUrl: null }],
      },
      {
        emoji: "😂",
        count: 1,
        userIds: ["u1"],
        reactedBy: [{ id: "u1", name: "Alice", avatarUrl: null }],
      },
      {
        emoji: "👀",
        count: 1,
        userIds: ["u2"],
        reactedBy: [
          { id: "u2", name: "Bob", avatarUrl: "https://example.com/b.png" },
        ],
      },
    ]);
  });

  it("returns empty array when there are no reactions", () => {
    assert.deepEqual(groupChatReactions([], usersById), []);
  });

  it("supports multiple different reactions from one user", () => {
    const grouped = groupChatReactions(
      [
        { emoji: "👍", userId: "u1" },
        { emoji: "🎉", userId: "u1" },
        { emoji: "👀", userId: "u1" },
      ],
      usersById,
    );
    assert.deepEqual(grouped, [
      {
        emoji: "👍",
        count: 1,
        userIds: ["u1"],
        reactedBy: [{ id: "u1", name: "Alice", avatarUrl: null }],
      },
      {
        emoji: "🎉",
        count: 1,
        userIds: ["u1"],
        reactedBy: [{ id: "u1", name: "Alice", avatarUrl: null }],
      },
      {
        emoji: "👀",
        count: 1,
        userIds: ["u1"],
        reactedBy: [{ id: "u1", name: "Alice", avatarUrl: null }],
      },
    ]);
  });

  it("keeps the same emoji from different users", () => {
    const grouped = groupChatReactions(
      [
        { emoji: "❤️", userId: "a" },
        { emoji: "❤️", userId: "b" },
        { emoji: "❤️", userId: "c" },
      ],
      usersById,
    );
    assert.deepEqual(grouped, [
      {
        emoji: "❤️",
        count: 3,
        userIds: ["a", "b", "c"],
        reactedBy: [
          { id: "a", name: "Ann", avatarUrl: null },
          { id: "b", name: "Ben", avatarUrl: null },
          { id: "c", name: "Cy", avatarUrl: null },
        ],
      },
    ]);
  });
});

describe("chat-reaction-utils idempotent add/remove", () => {
  it("PUT add is idempotent for the same user+emoji", () => {
    const first = applyIdempotentAddReaction([], { userId: "u1", emoji: "👍" });
    const second = applyIdempotentAddReaction(first, { userId: "u1", emoji: "👍" });
    assert.deepEqual(first, [{ userId: "u1", emoji: "👍" }]);
    assert.deepEqual(second, first);
    assert.equal(groupChatReactions(second)[0]?.count, 1);
  });

  it("DELETE removes only the actor's own reaction", () => {
    const rows = [
      { userId: "u1", emoji: "👍" },
      { userId: "u2", emoji: "👍" },
      { userId: "u1", emoji: "😂" },
    ];
    const after = applyRemoveOwnReaction(rows, { userId: "u1", emoji: "👍" });
    assert.deepEqual(after, [
      { userId: "u2", emoji: "👍" },
      { userId: "u1", emoji: "😂" },
    ]);
  });

  it("DELETE of a missing reaction is a no-op", () => {
    const rows = [{ userId: "u2", emoji: "👍" }];
    assert.deepEqual(applyRemoveOwnReaction(rows, { userId: "u1", emoji: "👍" }), rows);
  });
});

describe("chat-reaction-utils access control", () => {
  const baseOk = {
    isAuthenticated: true,
    isActiveWorkspaceMember: true,
    isConversationMember: true,
    conversationBelongsToWorkspace: true,
    messageBelongsToConversation: true,
    messageExists: true,
  };

  it("allows an authenticated conversation member", () => {
    assert.equal(canReactToChatMessage(baseOk), "ok");
  });

  it("rejects unauthenticated users", () => {
    assert.equal(
      canReactToChatMessage({ ...baseOk, isAuthenticated: false }),
      "unauthenticated",
    );
  });

  it("rejects inactive workspace members", () => {
    assert.equal(
      canReactToChatMessage({ ...baseOk, isActiveWorkspaceMember: false }),
      "forbidden",
    );
  });

  it("hides cross-workspace conversations as not_found", () => {
    assert.equal(
      canReactToChatMessage({ ...baseOk, conversationBelongsToWorkspace: false }),
      "not_found",
    );
  });

  it("hides non-members as not_found", () => {
    assert.equal(
      canReactToChatMessage({ ...baseOk, isConversationMember: false }),
      "not_found",
    );
  });

  it("rejects message/conversation mismatch", () => {
    assert.equal(
      canReactToChatMessage({ ...baseOk, messageBelongsToConversation: false }),
      "not_found",
    );
  });

  it("rejects missing or deleted messages", () => {
    assert.equal(
      canReactToChatMessage({ ...baseOk, messageExists: false }),
      "not_found",
    );
  });
});

describe("chat-reaction-utils cascade and realtime", () => {
  it("clears reactions when the parent message is deleted", () => {
    const rows = [
      { messageId: "m1", userId: "u1", emoji: "👍" },
      { messageId: "m2", userId: "u1", emoji: "❤️" },
    ];
    assert.deepEqual(reactionsAfterMessageDeleted(rows, "m1"), [
      { messageId: "m2", userId: "u1", emoji: "❤️" },
    ]);
  });

  it("builds a typed realtime payload without private user fields", () => {
    const payload = buildChatReactionUpdatedPayload({
      workspaceId: "ws1",
      conversationId: "c1",
      messageId: "m1",
      reactions: [
        {
          emoji: "👍",
          count: 1,
          userIds: ["u1"],
          reactedBy: [{ id: "u1", name: "Alice", avatarUrl: null }],
        },
      ],
    });
    assert.deepEqual(payload, {
      workspaceId: "ws1",
      conversationId: "c1",
      messageId: "m1",
      reactions: [
        {
          emoji: "👍",
          count: 1,
          userIds: ["u1"],
          reactedBy: [{ id: "u1", name: "Alice", avatarUrl: null }],
        },
      ],
    });
    assert.equal("email" in payload, false);
    assert.equal("email" in payload.reactions[0]!.reactedBy[0]!, false);
  });

  it("does not change unread or conversation sort fields", () => {
    const before = [
      {
        id: "c1",
        unreadCount: 4,
        latestMessageAt: "2026-07-22T10:00:00.000Z",
        updatedAt: "2026-07-22T10:00:00.000Z",
      },
      {
        id: "c2",
        unreadCount: 1,
        latestMessageAt: "2026-07-22T11:00:00.000Z",
        updatedAt: "2026-07-22T11:00:00.000Z",
      },
    ];
    const after = applyReactionEventToSidebarState(before, "c1");
    assert.deepEqual(after, before);
    assert.equal(after[0]?.unreadCount, 4);
    assert.equal(after[0]?.latestMessageAt, before[0]?.latestMessageAt);
    assert.equal(after[1]?.latestMessageAt, before[1]?.latestMessageAt);
  });
});

describe("chat-reaction-utils display names and tooltip lines", () => {
  it("prefers displayName over account name", () => {
    assert.equal(
      resolveChatReactionDisplayName({ name: "artem", displayName: "Артём Максимов" }),
      "Артём Максимов",
    );
    assert.equal(
      resolveChatReactionDisplayName({ name: "artem", displayName: "  " }),
      "artem",
    );
  });

  it("builds tooltip lines with You label and and-N-more truncation", () => {
    const lines = buildReactionAuthorTooltipLines({
      currentUserId: "u1",
      youLabel: "You",
      andMoreLabel: (count) => `and ${count} more`,
      reactedBy: [
        { id: "u1", name: "Alice", avatarUrl: null },
        { id: "u2", name: "Bob", avatarUrl: null },
        { id: "u3", name: "Cara", avatarUrl: null },
        { id: "u4", name: "Dan", avatarUrl: null },
        { id: "u5", name: "Eve", avatarUrl: null },
        { id: "u6", name: "Fay", avatarUrl: null },
        { id: "u1", name: "Alice", avatarUrl: null },
      ],
    });
    assert.deepEqual(lines, ["You", "Bob", "Cara", "Dan", "Eve", "and 1 more"]);
  });
});
