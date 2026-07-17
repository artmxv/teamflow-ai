import type { QueryClient } from "@tanstack/react-query";

import { getSelectedWorkspaceId, apiRequest } from "./client";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_MESSAGES_PAGE_SIZE = 30;
export const CHAT_POLL_MS = 7_000;

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

export function chatMessagesQueryKey(workspaceId: string | null | undefined) {
  return ["chat-messages", workspaceId ?? "none"] as const;
}

export function getChatMessagesQueryKey() {
  return chatMessagesQueryKey(getSelectedWorkspaceId());
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
  updater: (data: ChatMessagesPage) => ChatMessagesPage,
) {
  const key = getChatMessagesQueryKey();
  queryClient.setQueryData<ChatMessagesPage>(key, (old) => (old ? updater(old) : old));
}

export async function fetchChatMessages(params?: {
  limit?: number;
  before?: string;
  after?: string;
}) {
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
  const path = query ? `/api/chat/messages?${query}` : "/api/chat/messages";
  const response = await apiRequest<{ data: ChatMessagesPage }>(path);
  return response.data;
}

export async function sendChatMessage(content: string) {
  const response = await apiRequest<{ data: ChatMessage }>("/api/chat/messages", {
    method: "POST",
    body: { content },
  });
  return response.data;
}

export async function deleteChatMessage(id: string) {
  const response = await apiRequest<{ data: { id: string } }>(`/api/chat/messages/${id}`, {
    method: "DELETE",
  });
  return response.data;
}

export function validateChatDraft(raw: string): { ok: true; content: string } | { ok: false; reason: "empty" | "too_long" } {
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
