import type { ChatMessageDto } from "../services/chat.service.js";

export const CHAT_MESSAGE_CREATED = "chat:message-created" as const;
export const CHAT_MESSAGE_DELETED = "chat:message-deleted" as const;
export const CHAT_CONVERSATION_UPDATED = "chat:conversation-updated" as const;

export type ChatMessageCreatedPayload = {
  conversationId: string;
  workspaceId: string;
  message: ChatMessageDto;
  createdAt: string;
};

export type ChatMessageDeletedPayload = {
  conversationId: string;
  workspaceId: string;
  messageId: string;
};

export type ChatConversationUpdatedPayload = {
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
