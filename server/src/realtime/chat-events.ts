import type { ChatMessagePinDto } from "../lib/chat-pin-utils.js";
import type { ChatReactionDto } from "../lib/chat-reaction-utils.js";
import type { ChatMessageDto } from "../services/chat.service.js";

export const CHAT_MESSAGE_CREATED = "chat:message-created" as const;
export const CHAT_MESSAGE_DELETED = "chat:message-deleted" as const;
export const CHAT_MESSAGE_REACTION_UPDATED = "chat:message-reaction-updated" as const;
export const CHAT_MESSAGE_PIN_UPDATED = "chat:message-pin-updated" as const;
export const CHAT_CONVERSATION_UPDATED = "chat:conversation-updated" as const;
export const CHAT_PRESENCE_SNAPSHOT = "chat:presence-snapshot" as const;
export const CHAT_PRESENCE_UPDATED = "chat:presence-updated" as const;

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

export type ChatMessageReactionUpdatedPayload = {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  reactions: ChatReactionDto[];
};

export type ChatMessagePinUpdatedPayload = {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  pin: ChatMessagePinDto | null;
};

export type ChatConversationUpdatedPayload = {
  conversationId: string;
  workspaceId: string;
  latestMessage?: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  latestMessageAt?: string | null;
  /** Present when the workspace general conversation was renamed. */
  title?: string | null;
  displayName?: string;
};

/** Full online set for one workspace (sent on connect / reconnect). */
export type ChatPresenceSnapshotPayload = {
  workspaceId: string;
  onlineUserIds: string[];
};

/** Single-user online/offline transition within one workspace. */
export type ChatPresenceUpdatedPayload = {
  workspaceId: string;
  userId: string;
  isOnline: boolean;
};
