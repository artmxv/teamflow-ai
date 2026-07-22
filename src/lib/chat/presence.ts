import type { ChatConversation } from "@/lib/api/chat";

/**
 * Other participant id for a direct conversation, or null when presence
 * must not be shown (workspace general, missing participant, self).
 */
export function resolveDirectPresenceUserId(
  conversation: Pick<ChatConversation, "type" | "otherParticipant">,
  currentUserId?: string | null,
): string | null {
  if (conversation.type !== "DIRECT") {
    return null;
  }

  const otherId = conversation.otherParticipant?.id ?? null;
  if (!otherId) {
    return null;
  }

  if (currentUserId && otherId === currentUserId) {
    return null;
  }

  return otherId;
}

export function shouldShowDirectPresence(
  conversation: Pick<ChatConversation, "type" | "otherParticipant">,
  currentUserId: string | null | undefined,
  isOnline: boolean,
): boolean {
  if (!isOnline) {
    return false;
  }
  return resolveDirectPresenceUserId(conversation, currentUserId) !== null;
}
