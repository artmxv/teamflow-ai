const RECENT_EMOJI_STORAGE_KEY = "teamflow.chat.recent-emoji";
export const RECENT_EMOJI_LIMIT = 24;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Reads recently used emoji from localStorage (newest first). */
export function getRecentEmojis(limit = RECENT_EMOJI_LIMIT): string[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_EMOJI_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** Moves an emoji to the front of the recent list and persists it. */
export function pushRecentEmoji(emoji: string, limit = RECENT_EMOJI_LIMIT): string[] {
  const next = [emoji, ...getRecentEmojis(limit).filter((item) => item !== emoji)].slice(0, limit);

  if (!canUseLocalStorage()) {
    return next;
  }

  try {
    window.localStorage.setItem(RECENT_EMOJI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures; in-memory list still updates.
  }

  return next;
}
