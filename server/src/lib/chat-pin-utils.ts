/**
 * Pure helpers for chat message pins (access, limits, sorting, realtime).
 */

export const CHAT_PINNED_MESSAGES_LIMIT = 50;

export type ChatPinUserDto = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ChatMessagePinDto = {
  pinnedAt: string;
  pinnedBy: ChatPinUserDto;
};

/** Prefer profile displayName when set; otherwise fall back to account name. */
export function resolveChatPinDisplayName(user: {
  name: string;
  displayName?: string | null;
}): string {
  const displayName = user.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  return user.name;
}

export function mapChatPinDto(input: {
  pinnedAt: Date | string;
  pinnedBy: {
    id: string;
    name: string;
    displayName?: string | null;
    avatarUrl: string | null;
  };
}): ChatMessagePinDto {
  const pinnedAt =
    typeof input.pinnedAt === "string"
      ? input.pinnedAt
      : input.pinnedAt.toISOString();

  return {
    pinnedAt,
    pinnedBy: {
      id: input.pinnedBy.id,
      name: resolveChatPinDisplayName(input.pinnedBy),
      avatarUrl: input.pinnedBy.avatarUrl,
    },
  };
}

/**
 * Access gate for pinning / unpinning a message. Mirrors service checks without DB.
 */
export function canPinChatMessage(input: {
  isAuthenticated: boolean;
  isActiveWorkspaceMember: boolean;
  isConversationMember: boolean;
  conversationBelongsToWorkspace: boolean;
  messageBelongsToConversation: boolean;
  messageExists: boolean;
}): "ok" | "unauthenticated" | "forbidden" | "not_found" {
  if (!input.isAuthenticated) {
    return "unauthenticated";
  }
  if (!input.isActiveWorkspaceMember) {
    return "forbidden";
  }
  if (!input.conversationBelongsToWorkspace || !input.isConversationMember) {
    return "not_found";
  }
  if (!input.messageExists || !input.messageBelongsToConversation) {
    return "not_found";
  }
  return "ok";
}

/**
 * Pure simulation of idempotent pin: one pin row per messageId.
 * Re-pinning an already pinned message keeps the existing row.
 */
export function applyIdempotentPin(
  pins: Array<{ messageId: string; pinnedById: string; pinnedAt: string }>,
  input: { messageId: string; pinnedById: string; pinnedAt: string },
): {
  pins: Array<{ messageId: string; pinnedById: string; pinnedAt: string }>;
  created: boolean;
} {
  const existing = pins.find((pin) => pin.messageId === input.messageId);
  if (existing) {
    return { pins, created: false };
  }
  return {
    pins: [...pins, { ...input }],
    created: true,
  };
}

/**
 * Pure simulation of idempotent unpin: missing pin is a no-op.
 */
export function applyIdempotentUnpin(
  pins: Array<{ messageId: string; pinnedById: string; pinnedAt: string }>,
  messageId: string,
): Array<{ messageId: string; pinnedById: string; pinnedAt: string }> {
  return pins.filter((pin) => pin.messageId !== messageId);
}

/**
 * Whether a new pin would exceed the per-conversation limit.
 * Re-pinning an already pinned message never exceeds the limit.
 */
export function wouldExceedPinnedMessagesLimit(input: {
  currentPinnedCount: number;
  alreadyPinned: boolean;
  limit?: number;
}): boolean {
  if (input.alreadyPinned) {
    return false;
  }
  const limit = input.limit ?? CHAT_PINNED_MESSAGES_LIMIT;
  return input.currentPinnedCount >= limit;
}

/**
 * Sort pinned rows: newest pins first, then older.
 * Tie-breaker: messageId ascending for deterministic order.
 */
export function sortPinnedMessagesByPinnedAtDesc<
  T extends { pinnedAt: string; messageId?: string; id?: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const timeDiff =
      new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const aKey = a.messageId ?? a.id ?? "";
    const bKey = b.messageId ?? b.id ?? "";
    return aKey.localeCompare(bKey);
  });
}

/** Socket payload shape for chat:message-pin-updated. */
export function buildChatPinUpdatedPayload(input: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  pin: ChatMessagePinDto | null;
}) {
  return {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    pin: input.pin,
  };
}

/**
 * Pin events must not bump unread or reorder conversations.
 */
export function applyPinEventToSidebarState<
  T extends {
    id: string;
    unreadCount: number;
    latestMessageAt: string | null;
    updatedAt: string;
  },
>(conversations: T[], conversationId: string): T[] {
  return conversations.map((item) => {
    if (item.id !== conversationId) {
      return item;
    }
    return {
      ...item,
      unreadCount: item.unreadCount,
      latestMessageAt: item.latestMessageAt,
      updatedAt: item.updatedAt,
    };
  });
}

/**
 * Cascade semantics: deleting a message removes its pin row.
 */
export function pinsAfterMessageDeleted<
  T extends { messageId: string },
>(pins: T[], deletedMessageId: string): T[] {
  return pins.filter((pin) => pin.messageId !== deletedMessageId);
}

/**
 * Apply a pin update to an in-memory pinned list (newest first).
 */
export function applyPinUpdateToPinnedList<
  T extends { id: string; pin: ChatMessagePinDto | null },
>(
  messages: T[],
  input: {
    messageId: string;
    pin: ChatMessagePinDto | null;
    message?: T | null;
  },
): T[] {
  if (input.pin === null) {
    return messages.filter((message) => message.id !== input.messageId);
  }

  const existing = messages.find((message) => message.id === input.messageId);
  const nextMessage = existing
    ? { ...existing, pin: input.pin }
    : input.message
      ? { ...input.message, pin: input.pin }
      : null;

  if (!nextMessage) {
    return messages;
  }

  const without = messages.filter((message) => message.id !== input.messageId);
  return sortPinnedMessagesByPinnedAtDesc(
    [...without, nextMessage].map((message) => ({
      item: message,
      pinnedAt: message.pin?.pinnedAt ?? "",
      messageId: message.id,
    })),
  ).map((entry) => entry.item);
}
