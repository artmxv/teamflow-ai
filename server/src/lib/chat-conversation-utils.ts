export type ChatConversationTypeValue = "WORKSPACE" | "DIRECT";

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
    return a.type === "WORKSPACE" ? -1 : 1;
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
