import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { userRoom, workspaceRoom } from "../realtime/rooms.js";
import {
  parseSocketCredentials,
  readCookieValue,
  authenticateSocketToken,
} from "../realtime/socket-auth.js";
import {
  applyIncomingMessageToConversations,
  conversationMemberRooms,
  shouldIncrementUnreadOnIncomingMessage,
  sumConversationUnread,
} from "./chat-realtime-cache-utils.js";
import { AuthError, signAuthToken } from "../services/auth.service.js";

describe("realtime room names", () => {
  it("builds stable user and workspace rooms", () => {
    assert.equal(userRoom("u1"), "user:u1");
    assert.equal(workspaceRoom("w1"), "workspace:w1");
  });

  it("maps conversation members to user rooms only", () => {
    assert.deepEqual(conversationMemberRooms(["a", "b"]), ["user:a", "user:b"]);
  });
});

describe("socket credential parsing", () => {
  it("reads token and workspaceId from handshake.auth", () => {
    const result = parseSocketCredentials({
      auth: { token: " jwt-token ", workspaceId: " ws-1 " },
    });
    assert.deepEqual(result, { token: "jwt-token", workspaceId: "ws-1" });
  });

  it("falls back to Authorization Bearer header", () => {
    const result = parseSocketCredentials({
      auth: {},
      headers: { authorization: "Bearer header-token" },
    });
    assert.equal(result.token, "header-token");
  });

  it("falls back to cookie when auth token is missing", () => {
    const result = parseSocketCredentials({
      auth: { workspaceId: "ws" },
      headers: { cookie: "other=1; teamflow_auth_token=cookie%2Dtoken; x=y" },
    });
    assert.equal(result.token, "cookie-token");
    assert.equal(result.workspaceId, "ws");
  });

  it("returns null token when nothing is present", () => {
    const result = parseSocketCredentials({ auth: {}, headers: {} });
    assert.equal(result.token, null);
  });

  it("readCookieValue finds named cookie", () => {
    assert.equal(readCookieValue("a=1; b=two", "b"), "two");
    assert.equal(readCookieValue("a=1", "missing"), null);
  });
});

describe("socket token authentication", () => {
  it("rejects missing authentication", () => {
    assert.throws(() => authenticateSocketToken(null), AuthError);
    assert.throws(() => authenticateSocketToken(""), AuthError);
  });

  it("rejects invalid authentication", () => {
    assert.throws(() => authenticateSocketToken("not-a-jwt"), AuthError);
  });

  it("accepts a valid signed token", () => {
    const token = signAuthToken("user-abc");
    assert.equal(authenticateSocketToken(token), "user-abc");
  });
});

describe("realtime unread and conversation merge", () => {
  const baseConversations = [
    {
      id: "c1",
      unreadCount: 2,
      latestMessage: null,
      latestMessageAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "c2",
      unreadCount: 0,
      latestMessage: null,
      latestMessageAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("does not increment unread for the current user's own message", () => {
    assert.equal(
      shouldIncrementUnreadOnIncomingMessage({
        senderId: "me",
        currentUserId: "me",
        conversationId: "c1",
        openConversationId: null,
      }),
      false,
    );

    const next = applyIncomingMessageToConversations(baseConversations, {
      conversationId: "c1",
      currentUserId: "me",
      openConversationId: null,
      message: {
        id: "m1",
        content: "hello",
        createdAt: "2026-07-21T12:00:00.000Z",
        sender: { id: "me" },
      },
    });

    assert.equal(next[0]!.unreadCount, 2);
    assert.equal(next[0]!.latestMessage?.id, "m1");
  });

  it("does not increment unread when the conversation is open", () => {
    assert.equal(
      shouldIncrementUnreadOnIncomingMessage({
        senderId: "other",
        currentUserId: "me",
        conversationId: "c1",
        openConversationId: "c1",
      }),
      false,
    );
  });

  it("increments unread for another user's message in a closed conversation", () => {
    const next = applyIncomingMessageToConversations(baseConversations, {
      conversationId: "c2",
      currentUserId: "me",
      openConversationId: "c1",
      message: {
        id: "m2",
        content: "ping",
        createdAt: "2026-07-21T12:01:00.000Z",
        sender: { id: "other" },
      },
    });

    assert.equal(next[1]!.unreadCount, 1);
    assert.equal(sumConversationUnread(next), 3);
  });

  it("deduplicates optimistic REST and socket payloads by message id", () => {
    const first = applyIncomingMessageToConversations(baseConversations, {
      conversationId: "c1",
      currentUserId: "me",
      openConversationId: "c1",
      message: {
        id: "same-id",
        content: "hello",
        createdAt: "2026-07-21T12:00:00.000Z",
        sender: { id: "me" },
      },
    });
    const second = applyIncomingMessageToConversations(first, {
      conversationId: "c1",
      currentUserId: "me",
      openConversationId: "c1",
      message: {
        id: "same-id",
        content: "hello",
        createdAt: "2026-07-21T12:00:00.000Z",
        sender: { id: "me" },
      },
    });

    assert.equal(second[0]!.latestMessage?.id, "same-id");
    assert.equal(second[0]!.unreadCount, first[0]!.unreadCount);
  });
});
