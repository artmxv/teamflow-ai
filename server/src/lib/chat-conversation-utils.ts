export type ChatConversationTypeValue = "WORKSPACE" | "DIRECT" | "CHANNEL";

export function buildWorkspaceGeneralIdentityKey(workspaceId: string): string {
  return `workspace:${workspaceId}:general`;
}

export function buildDirectIdentityKey(
  workspaceId: string,
  userIdA: string,
  userIdB: string,
): string {
  const [left, right] = [userIdA, userIdB].sort((a, b) => a.localeCompare(b));
  return `workspace:${workspaceId}:direct:${left}:${right}`;
}

export function assertDistinctDirectParticipants(
  currentUserId: string,
  targetUserId: string,
): "ok" | "self" {
  if (currentUserId === targetUserId) {
    return "self";
  }
  return "ok";
}

export type UnreadMessageLike = {
  senderId: string;
  createdAt: Date | string;
};

/**
 * Count unread messages for a member.
 * Own messages never count as unread.
 * When lastReadAt is null, every other user's message counts.
 */
export function countUnreadMessages(
  messages: UnreadMessageLike[],
  currentUserId: string,
  lastReadAt: Date | string | null | undefined,
): number {
  const lastReadMs =
    lastReadAt == null ? null : new Date(lastReadAt).getTime();

  let unread = 0;
  for (const message of messages) {
    if (message.senderId === currentUserId) {
      continue;
    }
    const createdMs = new Date(message.createdAt).getTime();
    if (lastReadMs == null || createdMs > lastReadMs) {
      unread += 1;
    }
  }
  return unread;
}

export function isMessageUnreadForMember(input: {
  senderId: string;
  createdAt: Date | string;
  currentUserId: string;
  lastReadAt: Date | string | null | undefined;
}): boolean {
  if (input.senderId === input.currentUserId) {
    return false;
  }
  if (input.lastReadAt == null) {
    return true;
  }
  return new Date(input.createdAt).getTime() > new Date(input.lastReadAt).getTime();
}

export type ConversationSortItem = {
  id: string;
  isPinned: boolean;
  latestMessageAt: string | null;
  updatedAt: string;
  type: ChatConversationTypeValue;
  title: string | null;
};

export function compareConversationsForSidebar(
  a: ConversationSortItem,
  b: ConversationSortItem,
): number {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  const aActivity = a.latestMessageAt ?? a.updatedAt;
  const bActivity = b.latestMessageAt ?? b.updatedAt;
  const timeDiff = new Date(bActivity).getTime() - new Date(aActivity).getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }

  if (a.type !== b.type) {
    const typeRank: Record<ChatConversationTypeValue, number> = {
      WORKSPACE: 0,
      CHANNEL: 1,
      DIRECT: 2,
    };
    return typeRank[a.type] - typeRank[b.type];
  }

  return a.id.localeCompare(b.id);
}

export function resolveInitialConversationId(input: {
  requestedId: string | null | undefined;
  conversations: Array<{ id: string; type: ChatConversationTypeValue }>;
}): string | null {
  const { requestedId, conversations } = input;
  if (conversations.length === 0) {
    return null;
  }

  if (requestedId && conversations.some((item) => item.id === requestedId)) {
    return requestedId;
  }

  const general = conversations.find((item) => item.type === "WORKSPACE");
  if (general) {
    return general.id;
  }

  return conversations[0]!.id;
}

export type UnreadScrollMessageLike = UnreadMessageLike & {
  id: string;
};

/**
 * Oldest message that counts as unread for the member.
 * Own messages are never treated as unread.
 * Messages must already be in chronological (oldest → newest) order.
 */
export function findOldestUnreadMessageId(
  messages: UnreadScrollMessageLike[],
  currentUserId: string,
  lastReadAt: Date | string | null | undefined,
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

/**
 * Where to place the viewport after the first history render.
 * Uses the unread boundary captured before mark-as-read.
 */
export function resolveInitialScrollTarget(input: {
  messages: UnreadScrollMessageLike[];
  currentUserId: string;
  lastReadAt: Date | string | null | undefined;
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

/** Single unified sidebar: pinned first, then activity (server sort order). */
export function partitionUnifiedConversationList<T extends { isPinned: boolean }>(
  conversations: T[],
): { pinned: T[]; rest: T[]; ordered: T[] } {
  const pinned = conversations.filter((item) => item.isPinned);
  const rest = conversations.filter((item) => !item.isPinned);
  return {
    pinned,
    rest,
    ordered: [...pinned, ...rest],
  };
}

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

export type WorkspaceRoleValue = "OWNER" | "ADMIN" | "MEMBER";

export function canRenameWorkspaceConversation(
  role: WorkspaceRoleValue,
  conversationType: ChatConversationTypeValue,
): boolean {
  if (conversationType !== "WORKSPACE") {
    return false;
  }
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Authorization gate for renaming a conversation (no DB).
 * Cross-workspace / missing rows surface as not_found.
 */
export function resolveChatConversationRenameAccess(input: {
  role: WorkspaceRoleValue;
  conversationType: ChatConversationTypeValue | null | undefined;
  conversationExistsInWorkspace: boolean;
}): "ok" | "not_found" | "forbidden" | "invalid_type" {
  if (!input.conversationExistsInWorkspace || !input.conversationType) {
    return "not_found";
  }
  if (input.conversationType === "DIRECT") {
    return "invalid_type";
  }
  if (!canRenameWorkspaceConversation(input.role, input.conversationType)) {
    return "forbidden";
  }
  return "ok";
}
