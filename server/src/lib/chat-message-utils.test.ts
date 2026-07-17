import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canDeleteChatMessage,
  clampChatMessageLimit,
  decodeChatCursor,
  encodeChatCursor,
  isNewerThanCursor,
  isOlderThanCursor,
  mergeChatMessagesById,
  validateChatMessageContent,
  CHAT_MESSAGE_MAX_LENGTH,
} from "./chat-message-utils.js";

describe("chat-message-utils validation", () => {
  it("rejects empty and whitespace-only content", () => {
    assert.deepEqual(validateChatMessageContent(""), { ok: false, reason: "empty" });
    assert.deepEqual(validateChatMessageContent("   \n\t  "), { ok: false, reason: "empty" });
    assert.deepEqual(validateChatMessageContent(null), { ok: false, reason: "empty" });
  });

  it("rejects oversized messages", () => {
    const tooLong = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1);
    assert.deepEqual(validateChatMessageContent(tooLong), { ok: false, reason: "too_long" });
  });

  it("accepts trimmed content within limit", () => {
    const result = validateChatMessageContent("  hello team  ");
    assert.deepEqual(result, { ok: true, content: "hello team" });
  });

  it("accepts content at max length", () => {
    const content = "b".repeat(CHAT_MESSAGE_MAX_LENGTH);
    assert.deepEqual(validateChatMessageContent(content), { ok: true, content });
  });
});

describe("chat-message-utils delete permissions", () => {
  it("allows sender to delete own message", () => {
    assert.equal(canDeleteChatMessage("user-1", "user-1"), true);
  });

  it("forbids deleting another user's message", () => {
    assert.equal(canDeleteChatMessage("user-1", "user-2"), false);
  });
});

describe("chat-message-utils cursors and merge", () => {
  it("round-trips cursor encoding", () => {
    const createdAt = new Date("2026-07-17T12:00:00.000Z");
    const encoded = encodeChatCursor(createdAt, "msg_abc");
    assert.deepEqual(decodeChatCursor(encoded), { createdAt, id: "msg_abc" });
  });

  it("rejects invalid cursors", () => {
    assert.equal(decodeChatCursor("not-a-cursor"), null);
    assert.equal(decodeChatCursor(""), null);
  });

  it("compares older/newer relative to cursor", () => {
    const cursor = { createdAt: new Date("2026-07-17T12:00:00.000Z"), id: "m2" };
    assert.equal(
      isOlderThanCursor({ createdAt: new Date("2026-07-17T11:00:00.000Z"), id: "m1" }, cursor),
      true,
    );
    assert.equal(
      isNewerThanCursor({ createdAt: new Date("2026-07-17T13:00:00.000Z"), id: "m3" }, cursor),
      true,
    );
    assert.equal(
      isOlderThanCursor({ createdAt: new Date("2026-07-17T12:00:00.000Z"), id: "m1" }, cursor),
      true,
    );
    assert.equal(
      isNewerThanCursor({ createdAt: new Date("2026-07-17T12:00:00.000Z"), id: "m3" }, cursor),
      true,
    );
  });

  it("merges messages without duplicates and sorts ascending", () => {
    const merged = mergeChatMessagesById(
      [
        { id: "b", createdAt: "2026-07-17T12:01:00.000Z" },
        { id: "a", createdAt: "2026-07-17T12:00:00.000Z" },
      ],
      [
        { id: "c", createdAt: "2026-07-17T12:02:00.000Z" },
        { id: "b", createdAt: "2026-07-17T12:01:00.000Z" },
      ],
    );

    assert.deepEqual(
      merged.map((message) => message.id),
      ["a", "b", "c"],
    );
  });

  it("clamps page limits", () => {
    assert.equal(clampChatMessageLimit(undefined), 30);
    assert.equal(clampChatMessageLimit("5"), 5);
    assert.equal(clampChatMessageLimit(100), 50);
    assert.equal(clampChatMessageLimit(0), 1);
  });
});
