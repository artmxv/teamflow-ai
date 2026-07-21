/**
 * Pure helpers for applying realtime chat events to conversation sidebar state.
 * Mirrored on the frontend for React Query cache updates.
 */

export type SidebarConversationLike = {
  id: string;
  unreadCount: number;
  latestMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  latestMessageAt: string | null;
  updatedAt: string;
};

export type IncomingChatMessageLike = {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string };
};

/**
 * Own messages must never bump unread for the current user.
 * Open conversations should not accumulate unread while the user is viewing them.
 */
export function shouldIncrementUnreadOnIncomingMessage(input: {
  senderId: string;
  currentUserId: string;
  conversationId: string;
  openConversationId: string | null | undefined;
}): boolean {
  if (input.senderId === input.currentUserId) {
    return false;
  }
  if (input.openConversationId && input.openConversationId === input.conversationId) {
    return false;
  }
  return true;
}

export function applyIncomingMessageToConversations<T extends SidebarConversationLike>(
  conversations: T[],
  input: {
    conversationId: string;
    message: IncomingChatMessageLike;
    currentUserId: string;
    openConversationId: string | null | undefined;
  },
): T[] {
  const increment = shouldIncrementUnreadOnIncomingMessage({
    senderId: input.message.sender.id,
    currentUserId: input.currentUserId,
    conversationId: input.conversationId,
    openConversationId: input.openConversationId,
  });

  return conversations.map((item) => {
    if (item.id !== input.conversationId) {
      return item;
    }

    return {
      ...item,
      latestMessage: {
        id: input.message.id,
        content: input.message.content,
        createdAt: input.message.createdAt,
        senderId: input.message.sender.id,
      },
      latestMessageAt: input.message.createdAt,
      updatedAt: input.message.createdAt,
      unreadCount: increment ? item.unreadCount + 1 : item.unreadCount,
    };
  });
}

export function sumConversationUnread(conversations: Array<{ unreadCount: number }>): number {
  return conversations.reduce((sum, item) => sum + item.unreadCount, 0);
}

/** Target rooms for a private conversation event (never the whole workspace). */
export function conversationMemberRooms(userIds: string[]): string[] {
  return userIds.map((userId) => `user:${userId}`);
}
