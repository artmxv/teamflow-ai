import type { QueryClient } from "@tanstack/react-query";

import {
  buildChatAttachmentPreviewLabel,
  chatConversationsQueryKey,
  chatMessagesQueryKey,
  chatUnreadCountQueryKey,
  encodeChatCursor,
  mergeChatMessages,
  type ChatConversation,
  type ChatMessage,
  type ChatMessagesPage,
} from "@/lib/api/chat";

export type ChatMessageCreatedEvent = {
  conversationId: string;
  workspaceId: string;
  message: ChatMessage;
  createdAt: string;
};

export type ChatMessageDeletedEvent = {
  conversationId: string;
  workspaceId: string;
  messageId: string;
};

export type ChatConversationUpdatedEvent = {
  conversationId: string;
  workspaceId: string;
  latestMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  latestMessageAt: string | null;
};

function previewForMessage(message: ChatMessage): string {
  // Server already sends English preview in conversation-updated; for message-created
  // we derive a stable English fallback matching backend tokens.
  return (
    buildChatAttachmentPreviewLabel(message.content, message.attachments ?? [], {
      file: "File",
      files: "Files",
      task: "Task",
      tasks: "Tasks",
      project: "Project",
      projects: "Projects",
    }) || message.content
  );
}

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

export function applyIncomingMessageToConversations(
  conversations: ChatConversation[],
  input: {
    conversationId: string;
    message: ChatMessage;
    currentUserId: string;
    openConversationId: string | null | undefined;
  },
): ChatConversation[] {
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
        content: previewForMessage(input.message),
        createdAt: input.message.createdAt,
        senderId: input.message.sender.id,
      },
      latestMessageAt: input.message.createdAt,
      updatedAt: input.message.createdAt,
      unreadCount: increment ? item.unreadCount + 1 : item.unreadCount,
    };
  });
}

function sumUnread(conversations: ChatConversation[]): number {
  return conversations.reduce((sum, item) => sum + item.unreadCount, 0);
}

export function applyChatMessageCreatedToCache(input: {
  queryClient: QueryClient;
  workspaceId: string;
  currentUserId: string;
  openConversationId: string | null;
  event: ChatMessageCreatedEvent;
  onRemoteMessageWhileScrolledUp?: (conversationId: string) => void;
}) {
  const { queryClient, workspaceId, currentUserId, openConversationId, event } = input;
  if (event.workspaceId !== workspaceId) {
    return;
  }

  const messagesKey = chatMessagesQueryKey(workspaceId, event.conversationId);
  const existingPage = queryClient.getQueryData<ChatMessagesPage>(messagesKey);

  if (existingPage) {
    const alreadyPresent = existingPage.messages.some((message) => message.id === event.message.id);
    queryClient.setQueryData<ChatMessagesPage>(messagesKey, (old) => {
      if (!old) {
        return {
          messages: [event.message],
          pageInfo: {
            hasMoreOlder: false,
            oldestCursor: encodeChatCursor(event.message.createdAt, event.message.id),
            newestCursor: encodeChatCursor(event.message.createdAt, event.message.id),
          },
        };
      }

      const merged = mergeChatMessages(old.messages, [event.message]);
      return {
        messages: merged,
        pageInfo: {
          hasMoreOlder: old.pageInfo.hasMoreOlder,
          oldestCursor:
            old.pageInfo.oldestCursor ??
            encodeChatCursor(event.message.createdAt, event.message.id),
          newestCursor: encodeChatCursor(event.message.createdAt, event.message.id),
        },
      };
    });

    if (
      !alreadyPresent &&
      event.message.sender.id !== currentUserId &&
      openConversationId === event.conversationId
    ) {
      input.onRemoteMessageWhileScrolledUp?.(event.conversationId);
    }
  }

  const conversationsKey = chatConversationsQueryKey(workspaceId);
  queryClient.setQueryData<ChatConversation[]>(conversationsKey, (old) => {
    if (!old) {
      return old;
    }
    return applyIncomingMessageToConversations(old, {
      conversationId: event.conversationId,
      message: event.message,
      currentUserId,
      openConversationId,
    });
  });

  const conversations = queryClient.getQueryData<ChatConversation[]>(conversationsKey);
  if (conversations) {
    queryClient.setQueryData(chatUnreadCountQueryKey(workspaceId), sumUnread(conversations));
  }
}

export function applyChatMessageDeletedToCache(input: {
  queryClient: QueryClient;
  workspaceId: string;
  event: ChatMessageDeletedEvent;
}) {
  const { queryClient, workspaceId, event } = input;
  if (event.workspaceId !== workspaceId) {
    return;
  }

  const messagesKey = chatMessagesQueryKey(workspaceId, event.conversationId);
  queryClient.setQueryData<ChatMessagesPage>(messagesKey, (old) => {
    if (!old) {
      return old;
    }
    return {
      ...old,
      messages: old.messages.filter((message) => message.id !== event.messageId),
    };
  });

  void queryClient.invalidateQueries({
    queryKey: chatConversationsQueryKey(workspaceId),
  });
  void queryClient.invalidateQueries({
    queryKey: chatUnreadCountQueryKey(workspaceId),
  });
}

export function applyChatConversationUpdatedToCache(input: {
  queryClient: QueryClient;
  workspaceId: string;
  event: ChatConversationUpdatedEvent;
}) {
  const { queryClient, workspaceId, event } = input;
  if (event.workspaceId !== workspaceId) {
    return;
  }

  queryClient.setQueryData<ChatConversation[]>(
    chatConversationsQueryKey(workspaceId),
    (old) => {
      if (!old) {
        return old;
      }
      return old.map((item) =>
        item.id === event.conversationId
          ? {
              ...item,
              latestMessage: event.latestMessage,
              latestMessageAt: event.latestMessageAt,
              updatedAt: event.latestMessageAt ?? item.updatedAt,
            }
          : item,
      );
    },
  );
}
