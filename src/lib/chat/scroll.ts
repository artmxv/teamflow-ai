/**
 * Client-side scroll helpers for chat open behavior.
 * Keep in sync with server/src/lib/chat-conversation-utils.ts
 * (findOldestUnreadMessageId / resolveInitialScrollTarget).
 */

export type UnreadScrollMessageLike = {
  id: string;
  senderId: string;
  createdAt: string;
};

export function isMessageUnreadForMember(input: {
  senderId: string;
  createdAt: string;
  currentUserId: string;
  lastReadAt: string | null | undefined;
}): boolean {
  if (input.senderId === input.currentUserId) {
    return false;
  }
  if (input.lastReadAt == null) {
    return true;
  }
  return new Date(input.createdAt).getTime() > new Date(input.lastReadAt).getTime();
}

/** Oldest other-user message after lastReadAt. Messages must be chronological. */
export function findOldestUnreadMessageId(
  messages: UnreadScrollMessageLike[],
  currentUserId: string,
  lastReadAt: string | null | undefined,
): string | null {
  for (const message of messages) {
    if (
      isMessageUnreadForMember({
        senderId: message.senderId,
        createdAt: message.createdAt,
        currentUserId,
        lastReadAt,
      })
    ) {
      return message.id;
    }
  }
  return null;
}

export type InitialScrollTarget =
  | { type: "bottom" }
  | { type: "message"; messageId: string };

export function resolveInitialScrollTarget(input: {
  messages: UnreadScrollMessageLike[];
  currentUserId: string;
  lastReadAt: string | null | undefined;
}): InitialScrollTarget {
  if (input.messages.length === 0) {
    return { type: "bottom" };
  }

  const oldestUnreadId = findOldestUnreadMessageId(
    input.messages,
    input.currentUserId,
    input.lastReadAt,
  );

  if (oldestUnreadId) {
    return { type: "message", messageId: oldestUnreadId };
  }

  return { type: "bottom" };
}
