import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyIdempotentPin,
  applyIdempotentUnpin,
  applyPinEventToSidebarState,
  applyPinUpdateToPinnedList,
  buildChatPinUpdatedPayload,
  canPinChatMessage,
  CHAT_PINNED_MESSAGES_LIMIT,
  mapChatPinDto,
  pinsAfterMessageDeleted,
  resolveChatPinDisplayName,
  sortPinnedMessagesByPinnedAtDesc,
  wouldExceedPinnedMessagesLimit,
} from "./chat-pin-utils.js";

describe("chat-pin-utils pin / unpin", () => {
  it("pins a message", () => {
    const result = applyIdempotentPin([], {
      messageId: "m1",
      pinnedById: "u1",
      pinnedAt: "2026-07-22T10:00:00.000Z",
    });
    assert.equal(result.created, true);
    assert.deepEqual(result.pins, [
      {
        messageId: "m1",
        pinnedById: "u1",
        pinnedAt: "2026-07-22T10:00:00.000Z",
      },
    ]);
  });

  it("PUT pin is idempotent for the same message", () => {
    const first = applyIdempotentPin([], {
      messageId: "m1",
      pinnedById: "u1",
      pinnedAt: "2026-07-22T10:00:00.000Z",
    });
    const second = applyIdempotentPin(first.pins, {
      messageId: "m1",
      pinnedById: "u2",
      pinnedAt: "2026-07-22T11:00:00.000Z",
    });
    assert.equal(second.created, false);
    assert.deepEqual(second.pins, first.pins);
    assert.equal(second.pins.length, 1);
  });

  it("unpins a message", () => {
    const pins = [
      {
        messageId: "m1",
        pinnedById: "u1",
        pinnedAt: "2026-07-22T10:00:00.000Z",
      },
      {
        messageId: "m2",
        pinnedById: "u2",
        pinnedAt: "2026-07-22T11:00:00.000Z",
      },
    ];
    assert.deepEqual(applyIdempotentUnpin(pins, "m1"), [
      {
        messageId: "m2",
        pinnedById: "u2",
        pinnedAt: "2026-07-22T11:00:00.000Z",
      },
    ]);
  });

  it("DELETE unpin of a missing pin is a no-op", () => {
    const pins = [
      {
        messageId: "m2",
        pinnedById: "u2",
        pinnedAt: "2026-07-22T11:00:00.000Z",
      },
    ];
    assert.deepEqual(applyIdempotentUnpin(pins, "m1"), pins);
  });
});

describe("chat-pin-utils access control", () => {
  const baseOk = {
    isAuthenticated: true,
    isActiveWorkspaceMember: true,
    isConversationMember: true,
    conversationBelongsToWorkspace: true,
    messageBelongsToConversation: true,
    messageExists: true,
  };

  it("allows an authenticated conversation member", () => {
    assert.equal(canPinChatMessage(baseOk), "ok");
  });

  it("rejects unauthenticated users", () => {
    assert.equal(
      canPinChatMessage({ ...baseOk, isAuthenticated: false }),
      "unauthenticated",
    );
  });

  it("rejects inactive workspace members", () => {
    assert.equal(
      canPinChatMessage({ ...baseOk, isActiveWorkspaceMember: false }),
      "forbidden",
    );
  });

  it("hides cross-workspace conversations as not_found", () => {
    assert.equal(
      canPinChatMessage({ ...baseOk, conversationBelongsToWorkspace: false }),
      "not_found",
    );
  });

  it("rejects message/conversation mismatch", () => {
    assert.equal(
      canPinChatMessage({ ...baseOk, messageBelongsToConversation: false }),
      "not_found",
    );
  });

  it("rejects missing or deleted messages", () => {
    assert.equal(
      canPinChatMessage({ ...baseOk, messageExists: false }),
      "not_found",
    );
  });
});

describe("chat-pin-utils limit and sorting", () => {
  it("enforces the pinned messages limit for new pins only", () => {
    assert.equal(CHAT_PINNED_MESSAGES_LIMIT, 50);
    assert.equal(
      wouldExceedPinnedMessagesLimit({
        currentPinnedCount: 50,
        alreadyPinned: false,
      }),
      true,
    );
    assert.equal(
      wouldExceedPinnedMessagesLimit({
        currentPinnedCount: 50,
        alreadyPinned: true,
      }),
      false,
    );
    assert.equal(
      wouldExceedPinnedMessagesLimit({
        currentPinnedCount: 49,
        alreadyPinned: false,
      }),
      false,
    );
  });

  it("sorts pinned messages newest first with deterministic ties", () => {
    const sorted = sortPinnedMessagesByPinnedAtDesc([
      { messageId: "b", pinnedAt: "2026-07-22T10:00:00.000Z" },
      { messageId: "a", pinnedAt: "2026-07-22T12:00:00.000Z" },
      { messageId: "c", pinnedAt: "2026-07-22T10:00:00.000Z" },
    ]);
    assert.deepEqual(
      sorted.map((item) => item.messageId),
      ["a", "b", "c"],
    );
  });
});

describe("chat-pin-utils cascade and realtime", () => {
  it("clears the pin when the parent message is deleted", () => {
    const pins = [
      { messageId: "m1", pinnedById: "u1" },
      { messageId: "m2", pinnedById: "u1" },
    ];
    assert.deepEqual(pinsAfterMessageDeleted(pins, "m1"), [
      { messageId: "m2", pinnedById: "u1" },
    ]);
  });

  it("builds a typed realtime payload without private user fields", () => {
    const pin = mapChatPinDto({
      pinnedAt: new Date("2026-07-22T10:00:00.000Z"),
      pinnedBy: {
        id: "u1",
        name: "artem",
        displayName: "Alice",
        avatarUrl: null,
      },
    });
    const payload = buildChatPinUpdatedPayload({
      workspaceId: "ws1",
      conversationId: "c1",
      messageId: "m1",
      pin,
    });
    assert.deepEqual(payload, {
      workspaceId: "ws1",
      conversationId: "c1",
      messageId: "m1",
      pin: {
        pinnedAt: "2026-07-22T10:00:00.000Z",
        pinnedBy: { id: "u1", name: "Alice", avatarUrl: null },
      },
    });
    assert.equal("email" in payload, false);
    assert.equal("email" in payload.pin!.pinnedBy, false);
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
    const after = applyPinEventToSidebarState(before, "c1");
    assert.deepEqual(after, before);
    assert.equal(after[0]?.unreadCount, 4);
    assert.equal(after[0]?.latestMessageAt, before[0]?.latestMessageAt);
  });

  it("updates the pinned list cache without private fields", () => {
    const pinA = mapChatPinDto({
      pinnedAt: "2026-07-22T10:00:00.000Z",
      pinnedBy: { id: "u1", name: "Alice", avatarUrl: null },
    });
    const pinB = mapChatPinDto({
      pinnedAt: "2026-07-22T12:00:00.000Z",
      pinnedBy: { id: "u2", name: "Bob", avatarUrl: null },
    });
    const list = applyPinUpdateToPinnedList(
      [{ id: "m1", pin: pinA, content: "one" }],
      {
        messageId: "m2",
        pin: pinB,
        message: { id: "m2", pin: null, content: "two" },
      },
    );
    assert.deepEqual(
      list.map((item) => item.id),
      ["m2", "m1"],
    );
    assert.equal("email" in (list[0]?.pin?.pinnedBy ?? {}), false);

    const unpinned = applyPinUpdateToPinnedList(list, {
      messageId: "m2",
      pin: null,
    });
    assert.deepEqual(
      unpinned.map((item) => item.id),
      ["m1"],
    );
  });
});

describe("chat-pin-utils display names", () => {
  it("prefers displayName over account name", () => {
    assert.equal(
      resolveChatPinDisplayName({ name: "artem", displayName: "Артём Максимов" }),
      "Артём Максимов",
    );
    assert.equal(
      resolveChatPinDisplayName({ name: "artem", displayName: "  " }),
      "artem",
    );
  });
});
