import type { QueryClient } from "@tanstack/react-query";

import { isPreviewableImageMimeType } from "@/lib/files/image-preview";

import { downloadBlobAsFile, fetchAuthenticatedBlob } from "./authenticated-blob";
import { getSelectedWorkspaceId, apiRequest, buildAuthHeaders, ApiError, API_BASE_URL } from "./client";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_MESSAGES_PAGE_SIZE = 30;
export const CHAT_MAX_FILE_ATTACHMENTS = 5;

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

export type ChatFileAttachment = {
  id: string;
  type: "FILE";
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadUrl: string;
};

export type ChatTaskAttachment = {
  id: string;
  type: "TASK";
  taskId: string | null;
  title: string | null;
  status: string | null;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  unavailable?: boolean;
};

export type ChatProjectAttachment = {
  id: string;
  type: "PROJECT";
  projectId: string | null;
  name: string | null;
  status: string | null;
  unavailable?: boolean;
};

export type ChatAttachment = ChatFileAttachment | ChatTaskAttachment | ChatProjectAttachment;

export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sender: ChatSender;
  attachments: ChatAttachment[];
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
  /** Member read cursor; capture before mark-as-read for unread scroll. */
  lastReadAt: string | null;
  isPinned: boolean;
  updatedAt: string;
};

export type PendingChatFile = {
  key: string;
  file: File;
};

export type PendingChatTask = {
  id: string;
  title: string;
  status: string;
  projectName?: string | null;
};

export type PendingChatProject = {
  id: string;
  name: string;
  status?: string | null;
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

export function normalizeChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
  };
}

export function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of existing) {
    byId.set(message.id, normalizeChatMessage(message));
  }
  for (const message of incoming) {
    byId.set(message.id, normalizeChatMessage(message));
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

export async function renameChatConversation(conversationId: string, title: string) {
  const response = await apiRequest<{
    data: {
      id: string;
      title: string;
      displayName: string;
      type: "WORKSPACE";
      updatedAt: string;
    };
  }>(`/api/chat/conversations/${conversationId}`, {
    method: "PATCH",
    body: { title },
  });
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
  return {
    ...response.data,
    messages: response.data.messages.map(normalizeChatMessage),
  };
}

export type SendChatMessageInput = {
  content: string;
  files?: File[];
  taskIds?: string[];
  projectIds?: string[];
};

export async function sendChatMessage(
  conversationId: string,
  input: string | SendChatMessageInput,
) {
  const payload: SendChatMessageInput =
    typeof input === "string" ? { content: input } : input;

  const files = payload.files ?? [];
  const taskIds = payload.taskIds ?? [];
  const projectIds = payload.projectIds ?? [];
  const hasAttachments = files.length > 0 || taskIds.length > 0 || projectIds.length > 0;

  if (!hasAttachments) {
    const response = await apiRequest<{ data: ChatMessage }>(
      `/api/chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: { content: payload.content },
      },
    );
    return normalizeChatMessage(response.data);
  }

  const formData = new FormData();
  formData.append("content", payload.content);
  for (const taskId of taskIds) {
    formData.append("taskIds", taskId);
  }
  for (const projectId of projectIds) {
    formData.append("projectIds", projectId);
  }
  for (const file of files) {
    formData.append("files", file, file.name);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      credentials: "include",
      body: formData,
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    throw new ApiError(
      body?.message ?? `Upload failed with status ${response.status}`,
      response.status,
      body?.code,
    );
  }

  const json = (await response.json()) as { data: ChatMessage };
  return normalizeChatMessage(json.data);
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

export function isChatImagePreviewAttachment(
  attachment: Pick<ChatFileAttachment, "mimeType">,
): boolean {
  return isPreviewableImageMimeType(attachment.mimeType);
}

export async function fetchChatAttachmentBlob(downloadUrl: string): Promise<Blob> {
  return fetchAuthenticatedBlob(downloadUrl);
}

export async function openChatAttachmentFile(downloadUrl: string) {
  const blob = await fetchChatAttachmentBlob(downloadUrl);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadChatAttachmentFile(downloadUrl: string, originalName: string) {
  const blob = await fetchChatAttachmentBlob(downloadUrl);
  downloadBlobAsFile(blob, originalName);
}

export function validateChatDraft(
  raw: string,
  options?: { allowEmpty?: boolean },
): { ok: true; content: string } | { ok: false; reason: "empty" | "too_long" } {
  const content = raw.trim();
  if (!content && !options?.allowEmpty) {
    return { ok: false, reason: "empty" };
  }
  if (content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, content };
}

export function buildChatAttachmentPreviewLabel(
  content: string,
  attachments: Array<{ type: ChatAttachment["type"] }>,
  labels: {
    file: string;
    files: string;
    task: string;
    tasks: string;
    project: string;
    projects: string;
  },
): string {
  const trimmed = content.trim();
  if (trimmed) {
    return trimmed;
  }

  let fileCount = 0;
  let taskCount = 0;
  let projectCount = 0;
  for (const attachment of attachments) {
    if (attachment.type === "FILE") fileCount += 1;
    if (attachment.type === "TASK") taskCount += 1;
    if (attachment.type === "PROJECT") projectCount += 1;
  }

  const parts: string[] = [];
  if (fileCount === 1) parts.push(labels.file);
  else if (fileCount > 1) parts.push(labels.files);
  if (taskCount === 1) parts.push(labels.task);
  else if (taskCount > 1) parts.push(labels.tasks);
  if (projectCount === 1) parts.push(labels.project);
  else if (projectCount > 1) parts.push(labels.projects);
  return parts.join(", ");
}

export function localizeChatPreviewContent(
  content: string | null | undefined,
  labels: {
    file: string;
    files: string;
    task: string;
    tasks: string;
    project: string;
    projects: string;
  },
): string {
  if (!content) {
    return "";
  }

  const tokenMap: Record<string, string> = {
    File: labels.file,
    Files: labels.files,
    Task: labels.task,
    Tasks: labels.tasks,
    Project: labels.project,
    Projects: labels.projects,
  };

  const segments = content.split(", ");
  const allKnown = segments.every((part) => part in tokenMap);
  if (!allKnown) {
    return content;
  }

  return segments.map((part) => tokenMap[part]!).join(", ");
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
