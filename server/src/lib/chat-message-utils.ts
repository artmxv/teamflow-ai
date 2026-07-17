export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_MESSAGE_DEFAULT_LIMIT = 30;
export const CHAT_MESSAGE_MAX_LIMIT = 50;

export type ChatMessageContentValidation =
  | { ok: true; content: string }
  | { ok: false; reason: "empty" | "too_long" };

export type ChatCursor = {
  createdAt: Date;
  id: string;
};

export function normalizeChatMessageContent(raw: string): string {
  return raw.trim();
}

export function validateChatMessageContent(raw: unknown): ChatMessageContentValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "empty" };
  }

  const content = normalizeChatMessageContent(raw);
  if (!content) {
    return { ok: false, reason: "empty" };
  }

  if (content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  return { ok: true, content };
}

export function canDeleteChatMessage(senderId: string, actorId: string): boolean {
  return senderId === actorId;
}

export function encodeChatCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

export function decodeChatCursor(raw: string): ChatCursor | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf("|");
    if (separator <= 0 || separator === decoded.length - 1) {
      return null;
    }

    const iso = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    const createdAt = new Date(iso);
    if (!id || Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return { createdAt, id };
  } catch {
    return null;
  }
}

export function clampChatMessageLimit(raw: unknown): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(parsed)) {
    return CHAT_MESSAGE_DEFAULT_LIMIT;
  }
  return Math.min(CHAT_MESSAGE_MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

/** True when message A is strictly older than cursor (createdAt, id). */
export function isOlderThanCursor(
  message: { createdAt: Date; id: string },
  cursor: ChatCursor,
): boolean {
  if (message.createdAt.getTime() < cursor.createdAt.getTime()) {
    return true;
  }
  if (message.createdAt.getTime() > cursor.createdAt.getTime()) {
    return false;
  }
  return message.id < cursor.id;
}

/** True when message A is strictly newer than cursor (createdAt, id). */
export function isNewerThanCursor(
  message: { createdAt: Date; id: string },
  cursor: ChatCursor,
): boolean {
  if (message.createdAt.getTime() > cursor.createdAt.getTime()) {
    return true;
  }
  if (message.createdAt.getTime() < cursor.createdAt.getTime()) {
    return false;
  }
  return message.id > cursor.id;
}

/**
 * Merge message pages without duplicates. Keeps chronological ascending order.
 */
export function mergeChatMessagesById<T extends { id: string; createdAt: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const message of existing) {
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });
}
