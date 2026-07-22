import path from "node:path";

import {
  buildObjectKey,
  buildStoredObjectFilename,
  sanitizeFilename,
} from "./file-storage/types.js";
import {
  decodeMulterOriginalName,
  isAllowedTaskAttachment,
  MAX_TASK_ATTACHMENT_BYTES,
} from "./task-upload.js";

export const CHAT_MAX_FILE_ATTACHMENTS = 5;
export const CHAT_MAX_FILE_BYTES = MAX_TASK_ATTACHMENT_BYTES;

export type ChatAttachmentTypeValue = "FILE" | "TASK" | "PROJECT";

export type ChatAttachmentFieldInput = {
  type: ChatAttachmentTypeValue;
  originalName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
  taskId?: string | null;
  projectId?: string | null;
};

export type ChatAttachmentFieldValidation =
  | { ok: true }
  | { ok: false; reason: "invalid_combination" };

export type ChatMessagePayloadValidation =
  | { ok: true; content: string }
  | {
      ok: false;
      reason: "empty" | "too_long" | "too_many_files" | "invalid_file" | "duplicate_entity";
    };

export type ChatFileValidation =
  | { ok: true; originalName: string; mimeType: string; sizeBytes: number }
  | {
      ok: false;
      reason: "empty_file" | "too_large" | "unsupported_type" | "invalid_name";
    };

export type ConversationPreviewAttachmentSummary = {
  fileCount: number;
  taskCount: number;
  projectCount: number;
};

/**
 * Enforces allowed field combinations for FILE / TASK / PROJECT attachments.
 */
export function validateChatAttachmentFields(
  input: ChatAttachmentFieldInput,
): ChatAttachmentFieldValidation {
  const originalName = emptyToNull(input.originalName);
  const mimeType = emptyToNull(input.mimeType);
  const storageKey = emptyToNull(input.storageKey);
  const taskId = emptyToNull(input.taskId);
  const projectId = emptyToNull(input.projectId);
  const sizeBytes = input.sizeBytes ?? null;

  switch (input.type) {
    case "FILE": {
      if (!storageKey || !originalName) {
        return { ok: false, reason: "invalid_combination" };
      }
      if (taskId || projectId) {
        return { ok: false, reason: "invalid_combination" };
      }
      if (sizeBytes != null && (!Number.isFinite(sizeBytes) || sizeBytes <= 0)) {
        return { ok: false, reason: "invalid_combination" };
      }
      return { ok: true };
    }
    case "TASK": {
      if (!taskId) {
        return { ok: false, reason: "invalid_combination" };
      }
      if (storageKey || originalName || mimeType || projectId || sizeBytes != null) {
        return { ok: false, reason: "invalid_combination" };
      }
      return { ok: true };
    }
    case "PROJECT": {
      if (!projectId) {
        return { ok: false, reason: "invalid_combination" };
      }
      if (storageKey || originalName || mimeType || taskId || sizeBytes != null) {
        return { ok: false, reason: "invalid_combination" };
      }
      return { ok: true };
    }
    default: {
      const exhaustive: never = input.type;
      return exhaustive;
    }
  }
}

export function validateChatUploadedFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
}): ChatFileValidation {
  const originalName = decodeMulterOriginalName(file.originalname).trim();
  if (!originalName) {
    return { ok: false, reason: "invalid_name" };
  }

  if (!file.size || file.size <= 0) {
    return { ok: false, reason: "empty_file" };
  }

  if (file.size > CHAT_MAX_FILE_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  if (!isAllowedTaskAttachment(file.mimetype, originalName)) {
    return { ok: false, reason: "unsupported_type" };
  }

  return {
    ok: true,
    originalName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

export function validateChatMessagePayload(input: {
  rawContent: unknown;
  maxLength: number;
  fileCount: number;
  taskIds: string[];
  projectIds: string[];
}): ChatMessagePayloadValidation {
  if (input.fileCount > CHAT_MAX_FILE_ATTACHMENTS) {
    return { ok: false, reason: "too_many_files" };
  }

  const uniqueTasks = dedupeIds(input.taskIds);
  const uniqueProjects = dedupeIds(input.projectIds);
  if (
    uniqueTasks.length !== input.taskIds.length ||
    uniqueProjects.length !== input.projectIds.length
  ) {
    return { ok: false, reason: "duplicate_entity" };
  }

  const content =
    typeof input.rawContent === "string" ? input.rawContent.trim() : "";

  if (content.length > input.maxLength) {
    return { ok: false, reason: "too_long" };
  }

  const hasAttachments =
    input.fileCount > 0 || uniqueTasks.length > 0 || uniqueProjects.length > 0;

  if (!content && !hasAttachments) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, content };
}

export function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }
  return result;
}

function normalizeIdListItem(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : String(raw).trim();
}

/**
 * Parse taskIds / projectIds from multipart or JSON body without deduplicating.
 * Accepts JSON array string, repeated fields, or already-parsed arrays.
 */
export function parseRawIdListField(raw: unknown): string[] {
  if (raw == null) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeIdListItem(item)).filter((id) => id.length > 0);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => normalizeIdListItem(item))
            .filter((id) => id.length > 0);
        }
      } catch {
        // Fall through to comma-separated / single value.
      }
    }

    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((item) => normalizeIdListItem(item))
        .filter((id) => id.length > 0);
    }

    return [trimmed];
  }

  return [];
}

/**
 * Parse taskIds / projectIds from multipart or JSON body.
 * Accepts JSON array string, repeated fields, or already-parsed arrays.
 */
export function parseIdListField(raw: unknown): string[] {
  return dedupeIds(parseRawIdListField(raw));
}

export function filterSafeChatStorageKeys(input: {
  storageKeys: string[];
  workspaceId: string;
  conversationId: string;
  messageId: string;
}): string[] {
  return input.storageKeys.filter((storageKey) =>
    isSafeChatStorageKey({
      storageKey,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    }),
  );
}

export function buildChatStorageKey(input: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  originalName: string;
}): string {
  const storedFilename = buildStoredObjectFilename(input.originalName);
  return buildObjectKey({
    category: "chat",
    workspaceId: input.workspaceId,
    entityId: input.conversationId,
    messageId: input.messageId,
    storedFilename,
  });
}

export function sanitizeChatStoragePathSegment(value: string): string {
  return sanitizeFilename(value);
}

export function isSafeChatStorageKey(input: {
  storageKey: string;
  workspaceId: string;
  conversationId: string;
  messageId: string;
}): boolean {
  const expectedPrefix = `workspaces/${input.workspaceId}/chat/${input.conversationId}/${input.messageId}/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    return false;
  }

  const remainder = input.storageKey.slice(expectedPrefix.length);
  if (!remainder || remainder.includes("..") || remainder.includes("/") || path.isAbsolute(remainder)) {
    return false;
  }

  return true;
}

/**
 * Deterministic sidebar preview for attachment-only (or mixed) messages.
 * Locale keys are resolved by the caller; this helper returns structured counts.
 */
export function summarizeAttachmentsForPreview(
  attachments: Array<{ type: ChatAttachmentTypeValue }>,
): ConversationPreviewAttachmentSummary {
  let fileCount = 0;
  let taskCount = 0;
  let projectCount = 0;

  for (const attachment of attachments) {
    if (attachment.type === "FILE") {
      fileCount += 1;
    } else if (attachment.type === "TASK") {
      taskCount += 1;
    } else if (attachment.type === "PROJECT") {
      projectCount += 1;
    }
  }

  return { fileCount, taskCount, projectCount };
}

/**
 * Build a stable English preview token used by API and tests.
 * Frontend may localize using the same counts/token.
 */
export function buildAttachmentPreviewText(
  content: string,
  attachments: Array<{ type: ChatAttachmentTypeValue }>,
): string {
  const trimmed = content.trim();
  if (trimmed) {
    return trimmed;
  }

  const summary = summarizeAttachmentsForPreview(attachments);
  const parts: string[] = [];

  if (summary.fileCount === 1) {
    parts.push("File");
  } else if (summary.fileCount > 1) {
    parts.push("Files");
  }

  if (summary.taskCount === 1) {
    parts.push("Task");
  } else if (summary.taskCount > 1) {
    parts.push("Tasks");
  }

  if (summary.projectCount === 1) {
    parts.push("Project");
  } else if (summary.projectCount > 1) {
    parts.push("Projects");
  }

  return parts.join(", ") || "";
}

export function canAccessChatAttachmentDownload(input: {
  isAuthenticated: boolean;
  isActiveWorkspaceMember: boolean;
  isConversationMember: boolean;
  attachmentBelongsToConversation: boolean;
  attachmentType: ChatAttachmentTypeValue | null;
  attachmentWorkspaceId: string | null;
  activeWorkspaceId: string;
}): "ok" | "unauthenticated" | "forbidden" | "not_found" {
  if (!input.isAuthenticated) {
    return "unauthenticated";
  }
  if (!input.isActiveWorkspaceMember) {
    return "forbidden";
  }
  if (
    !input.attachmentWorkspaceId ||
    input.attachmentWorkspaceId !== input.activeWorkspaceId
  ) {
    return "forbidden";
  }
  if (!input.isConversationMember || !input.attachmentBelongsToConversation) {
    return "forbidden";
  }
  if (input.attachmentType !== "FILE") {
    return "not_found";
  }
  return "ok";
}

export function assertTasksBelongToWorkspace(input: {
  requestedTaskIds: string[];
  foundTasks: Array<{ id: string; workspaceId: string }>;
  workspaceId: string;
}): "ok" | "missing" | "cross_workspace" {
  const byId = new Map(input.foundTasks.map((task) => [task.id, task]));
  for (const taskId of input.requestedTaskIds) {
    const task = byId.get(taskId);
    if (!task) {
      return "missing";
    }
    if (task.workspaceId !== input.workspaceId) {
      return "cross_workspace";
    }
  }
  return "ok";
}

export function assertProjectsBelongToWorkspace(input: {
  requestedProjectIds: string[];
  foundProjects: Array<{ id: string; workspaceId: string }>;
  workspaceId: string;
}): "ok" | "missing" | "cross_workspace" {
  const byId = new Map(input.foundProjects.map((project) => [project.id, project]));
  for (const projectId of input.requestedProjectIds) {
    const project = byId.get(projectId);
    if (!project) {
      return "missing";
    }
    if (project.workspaceId !== input.workspaceId) {
      return "cross_workspace";
    }
  }
  return "ok";
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
