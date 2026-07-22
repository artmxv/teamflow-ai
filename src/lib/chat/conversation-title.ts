/** Keep in sync with server CHAT_CONVERSATION_TITLE_MAX_LENGTH. */
export const CHAT_CONVERSATION_TITLE_MAX_LENGTH = 80;

export type ChatConversationTitleValidation =
  | { ok: true; title: string }
  | { ok: false; reason: "empty" | "too_long" };

export function validateChatConversationTitle(
  raw: unknown,
): ChatConversationTitleValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "empty" };
  }
  const title = raw.trim();
  if (!title) {
    return { ok: false, reason: "empty" };
  }
  if (title.length > CHAT_CONVERSATION_TITLE_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, title };
}
