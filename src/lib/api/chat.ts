import type { QueryClient } from "@tanstack/react-query";

import { getSelectedWorkspaceId, apiRequest } from "./client";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_MESSAGES_PAGE_SIZE = 30;

/** Fallback polling while Socket.IO is disconnected. */
export const CHAT_MESSAGES_FALLBACK_POLL_MS = 20_000;
export const CHAT_CONVERSATIONS_FALLBACK_POLL_MS = 25_000;

/** @deprecated Prefer CHAT_MESSAGES_FALLBACK_POLL_MS with socket-aware intervals */
export const CHAT_MESSAGES_POLL_MS = CHAT_MESSAGES_FALLBACK_POLL_MS;
/** @deprecated Prefer CHAT_CONVERSATIONS_FALLBACK_POLL_MS with socket-aware intervals */
export const CHAT_CONVERSATIONS_POLL_MS = CHAT_CONVERSATIONS_FALLBACK_POLL_MS;

/** @deprecated Use CHAT_MESSAGES_FALLBACK_POLL_MS */
export const CHAT_POLL_MS = CHAT_MESSAGES_FALLBACK_POLL_MS;

export type ChatSender = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
};

export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sender: ChatSender;
};

export type ChatPageInfo = {
  hasMoreOlder: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  pageInfo: ChatPageInfo;
};

export type ChatConversationType = "WORKSPACE" | "DIRECT";

export type ChatConversation = {
  id: string;
  type: ChatConversationType;
  title: string | null;
  displayName: string;
  avatar: string | null;
  avatarUrl: string | null;
  otherParticipant: ChatSender | null;
  latestMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  latestMessageAt: string | null;
  unreadCount: number;
  isPinned: boolean;
  updatedAt: string;
};

export function chatConversationsQueryKey(workspaceId: string | null | undefined) {
  return ["chat-conversations", workspaceId ?? "none"] as const;
}

export function chatMessagesQueryKey(
  workspaceId: string | null | undefined,
  conversationId: string | null | undefined,
) {
  return ["chat-messages", workspaceId ?? "none", conversationId ?? "none"] as const;
}

export function chatUnreadCountQueryKey(workspaceId: string | null | undefined) {
  return ["chat-unread-count", workspaceId ?? "none"] as const;
}

export function getChatConversationsQueryKey() {
  return chatConversationsQueryKey(getSelectedWorkspaceId());
}

export function getChatMessagesQueryKey(conversationId: string | null | undefined) {
  return chatMessagesQueryKey(getSelectedWorkspaceId(), conversationId);
}

export function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
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

export function updateChatMessagesCache(
  queryClient: QueryClient,
  conversationId: string,
  updater: (data: ChatMessagesPage) => ChatMessagesPage,
) {
  const key = getChatMessagesQueryKey(conversationId);
  queryClient.setQueryData<ChatMessagesPage>(key, (old) => (old ? updater(old) : old));
}

export function updateChatConversationsCache(
  queryClient: QueryClient,
  updater: (data: ChatConversation[]) => ChatConversation[],
) {
  const key = getChatConversationsQueryKey();
  queryClient.setQueryData<ChatConversation[]>(key, (old) => (old ? updater(old) : old));
}

export async function fetchChatConversations() {
  const response = await apiRequest<{ data: ChatConversation[] }>("/api/chat/conversations");
  return response.data;
}

export async function fetchChatUnreadCount() {
  const response = await apiRequest<{ data: { unreadCount: number } }>("/api/chat/unread-count");
  return response.data.unreadCount;
}

export async function createDirectConversation(userId: string) {
  const response = await apiRequest<{ data: ChatConversation }>("/api/chat/conversations/direct", {
    method: "POST",
    body: { userId },
  });
  return response.data;
}

export async function setConversationPinned(conversationId: string, isPinned: boolean) {
  const response = await apiRequest<{ data: { id: string; isPinned: boolean } }>(
    `/api/chat/conversations/${conversationId}/pin`,
    {
      method: "PATCH",
      body: { isPinned },
    },
  );
  return response.data;
}

export async function markConversationRead(conversationId: string) {
  const response = await apiRequest<{
    data: { id: string; unreadCount: number; lastReadAt: string };
  }>(`/api/chat/conversations/${conversationId}/read`, {
    method: "POST",
  });
  return response.data;
}

export async function fetchChatMessages(
  conversationId: string,
  params?: {
    limit?: number;
    before?: string;
    after?: string;
  },
) {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  if (params?.before) {
    search.set("before", params.before);
  }
  if (params?.after) {
    search.set("after", params.after);
  }

  const query = search.toString();
  const path = query
    ? `/api/chat/conversations/${conversationId}/messages?${query}`
    : `/api/chat/conversations/${conversationId}/messages`;
  const response = await apiRequest<{ data: ChatMessagesPage }>(path);
  return response.data;
}

export async function sendChatMessage(conversationId: string, content: string) {
  const response = await apiRequest<{ data: ChatMessage }>(
    `/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: { content },
    },
  );
  return response.data;
}

export async function deleteChatMessage(conversationId: string, messageId: string) {
  const response = await apiRequest<{ data: { id: string } }>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}`,
    {
      method: "DELETE",
    },
  );
  return response.data;
}

export function validateChatDraft(
  raw: string,
): { ok: true; content: string } | { ok: false; reason: "empty" | "too_long" } {
  const content = raw.trim();
  if (!content) {
    return { ok: false, reason: "empty" };
  }
  if (content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, content };
}

/** Same opaque cursor format as the server (`iso|id` base64url). */
export function encodeChatCursor(createdAt: string, id: string): string {
  const bytes = new TextEncoder().encode(`${createdAt}|${id}`);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function resolveInitialConversationId(input: {
  requestedId: string | null | undefined;
  conversations: Array<{ id: string; type: ChatConversationType }>;
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

export function conversationDisplayName(
  conversation: Pick<ChatConversation, "type" | "displayName" | "otherParticipant" | "title">,
  generalLabel: string,
): string {
  if (conversation.type === "WORKSPACE") {
    return conversation.title?.trim() || generalLabel;
  }
  return conversation.otherParticipant?.name || conversation.displayName;
}
