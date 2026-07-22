/**
 * Shared whitelist, grouping, and access helpers for chat message reactions.
 */

/** Deterministic display order for supported reaction emoji. */
export const CHAT_REACTION_EMOJI = ["👍", "❤️", "😂", "🎉", "👀"] as const;

export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJI)[number];

export type ChatReactionUserDto = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ChatReactionDto = {
  emoji: string;
  count: number;
  userIds: string[];
  reactedBy: ChatReactionUserDto[];
};

export type ChatReactionRow = {
  emoji: string;
  userId: string;
};

export type ChatReactionEmojiValidation =
  | { ok: true; emoji: ChatReactionEmoji }
  | { ok: false; reason: "invalid_emoji" };

const emojiSet = new Set<string>(CHAT_REACTION_EMOJI);

export function isSupportedChatReactionEmoji(value: unknown): value is ChatReactionEmoji {
  return typeof value === "string" && emojiSet.has(value);
}

export function validateChatReactionEmoji(raw: unknown): ChatReactionEmojiValidation {
  if (!isSupportedChatReactionEmoji(raw)) {
    return { ok: false, reason: "invalid_emoji" };
  }
  return { ok: true, emoji: raw };
}

/** Prefer profile displayName when set; otherwise fall back to account name. */
export function resolveChatReactionDisplayName(user: {
  name: string;
  displayName?: string | null;
}): string {
  const displayName = user.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  return user.name;
}

/**
 * Group raw reaction rows into DTO aggregates.
 * - Only whitelist emoji are kept
 * - Order follows CHAT_REACTION_EMOJI
 * - userIds / reactedBy are unique per emoji and share the same order
 * - Empty groups are omitted (messages with no reactions → [])
 */
export function groupChatReactions(
  rows: ChatReactionRow[],
  usersById: ReadonlyMap<string, ChatReactionUserDto> = new Map(),
): ChatReactionDto[] {
  const byEmoji = new Map<ChatReactionEmoji, string[]>();

  for (const row of rows) {
    if (!isSupportedChatReactionEmoji(row.emoji)) {
      continue;
    }
    const existing = byEmoji.get(row.emoji);
    if (existing) {
      if (!existing.includes(row.userId)) {
        existing.push(row.userId);
      }
    } else {
      byEmoji.set(row.emoji, [row.userId]);
    }
  }

  const result: ChatReactionDto[] = [];
  for (const emoji of CHAT_REACTION_EMOJI) {
    const userIds = byEmoji.get(emoji);
    if (!userIds || userIds.length === 0) {
      continue;
    }
    const reactedBy: ChatReactionUserDto[] = [];
    for (const userId of userIds) {
      const user = usersById.get(userId);
      if (user) {
        reactedBy.push(user);
      }
    }
    result.push({
      emoji,
      count: userIds.length,
      userIds,
      reactedBy,
    });
  }
  return result;
}

/**
 * Pure simulation of idempotent add: if (messageId, userId, emoji) already
 * exists, rows are unchanged.
 */
export function applyIdempotentAddReaction(
  rows: ChatReactionRow[],
  input: { userId: string; emoji: ChatReactionEmoji },
): ChatReactionRow[] {
  const alreadyPresent = rows.some(
    (row) => row.userId === input.userId && row.emoji === input.emoji,
  );
  if (alreadyPresent) {
    return rows;
  }
  return [...rows, { userId: input.userId, emoji: input.emoji }];
}

/**
 * Pure simulation of remove: only the actor's own reaction for that emoji.
 */
export function applyRemoveOwnReaction(
  rows: ChatReactionRow[],
  input: { userId: string; emoji: ChatReactionEmoji },
): ChatReactionRow[] {
  return rows.filter(
    (row) => !(row.userId === input.userId && row.emoji === input.emoji),
  );
}

/**
 * Access gate for reacting to a message. Mirrors service checks without DB.
 */
export function canReactToChatMessage(input: {
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

/** Socket payload shape for chat:message-reaction-updated. */
export function buildChatReactionUpdatedPayload(input: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  reactions: ChatReactionDto[];
}) {
  return {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    reactions: input.reactions,
  };
}

/**
 * Reaction events must not bump unread or reorder conversations.
 * Returns a copy of sidebar state with those fields unchanged for the target.
 */
export function applyReactionEventToSidebarState<
  T extends {
    id: string;
    unreadCount: number;
    latestMessageAt: string | null;
    updatedAt: string;
  },
>(
  conversations: T[],
  conversationId: string,
): T[] {
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
 * Cascade semantics: deleting a message removes all of its reaction rows.
 */
export function reactionsAfterMessageDeleted(
  rows: Array<ChatReactionRow & { messageId: string }>,
  deletedMessageId: string,
): Array<ChatReactionRow & { messageId: string }> {
  return rows.filter((row) => row.messageId !== deletedMessageId);
}

export const CHAT_REACTION_TOOLTIP_NAME_LIMIT = 5;

/**
 * Build visible tooltip name lines for a reaction chip.
 * Current user is localized as "You" / "Вы"; remaining names keep reactedBy order.
 */
export function buildReactionAuthorTooltipLines(input: {
  reactedBy: ChatReactionUserDto[];
  currentUserId: string;
  youLabel: string;
  andMoreLabel: (count: number) => string;
  limit?: number;
}): string[] {
  const limit = input.limit ?? CHAT_REACTION_TOOLTIP_NAME_LIMIT;
  const uniqueById = new Map<string, ChatReactionUserDto>();
  for (const user of input.reactedBy) {
    if (!uniqueById.has(user.id)) {
      uniqueById.set(user.id, user);
    }
  }

  const names = Array.from(uniqueById.values()).map((user) =>
    user.id === input.currentUserId ? input.youLabel : user.name,
  );

  if (names.length <= limit) {
    return names;
  }

  const visible = names.slice(0, limit);
  const remaining = names.length - limit;
  return [...visible, input.andMoreLabel(remaining)];
}
