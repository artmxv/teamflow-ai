/** Supported chat reaction emoji in display order (mirrors server whitelist). */
export const CHAT_REACTION_EMOJI = ["👍", "❤️", "😂", "🎉", "👀"] as const;

export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJI)[number];

export const CHAT_REACTION_TOOLTIP_NAME_LIMIT = 5;

export function isSupportedChatReactionEmoji(value: string): value is ChatReactionEmoji {
  return (CHAT_REACTION_EMOJI as readonly string[]).includes(value);
}

export type ReactionAuthorLike = {
  id: string;
  name: string;
};

/**
 * Visible tooltip lines for a reaction chip.
 * Current user becomes localized "You" / "Вы"; order stays stable; duplicates skipped.
 */
export function buildReactionAuthorTooltipLines(input: {
  reactedBy: ReactionAuthorLike[];
  currentUserId: string;
  youLabel: string;
  andMoreLabel: (count: number) => string;
  limit?: number;
}): string[] {
  const limit = input.limit ?? CHAT_REACTION_TOOLTIP_NAME_LIMIT;
  const uniqueById = new Map<string, ReactionAuthorLike>();
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
