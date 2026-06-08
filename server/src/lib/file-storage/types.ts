import { randomUUID } from "node:crypto";
import path from "node:path";

export type FileStorageCategory = "avatar" | "task" | "project";

export type StoredFilePayload = {
  objectKey: string;
  mimeType: string;
  buffer: Buffer;
};

export type ResolvedStoredFile = {
  mimeType: string;
  originalName: string;
} & (
  | { kind: "local"; filePath: string }
  | { kind: "supabase"; objectKey: string }
);

/** Full Supabase object key stored in DB (contains `/`). */
export function isFullStorageObjectKey(filename: string): boolean {
  return filename.includes("/");
}

export function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName);
  const withoutExt = path.basename(base, path.extname(base));
  const safe = withoutExt
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
  return safe || "file";
}

export function buildStoredObjectFilename(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  const safe = sanitizeFilename(originalName);
  return `${randomUUID()}-${safe}${extension}`;
}

export function buildObjectKey(input: {
  category: FileStorageCategory;
  workspaceId: string;
  entityId: string;
  storedFilename: string;
}): string {
  switch (input.category) {
    case "avatar":
      return `avatars/${input.storedFilename}`;
    case "task":
      return `workspaces/${input.workspaceId}/tasks/${input.entityId}/${input.storedFilename}`;
    case "project":
      return `workspaces/${input.workspaceId}/projects/${input.entityId}/${input.storedFilename}`;
    default: {
      const exhaustive: never = input.category;
      return exhaustive;
    }
  }
}

/** Resolve DB filename to a Supabase object key (supports legacy short names). */
export function resolveStorageObjectKey(input: {
  category: FileStorageCategory;
  entityId: string;
  filename: string;
}): string {
  if (isFullStorageObjectKey(input.filename)) {
    return input.filename;
  }

  switch (input.category) {
    case "avatar":
      return `avatars/${input.filename}`;
    case "task":
      // Legacy path before workspace prefix was introduced.
      return `tasks/${input.entityId}/${input.filename}`;
    case "project":
      return `projects/${input.entityId}/${input.filename}`;
    default: {
      const exhaustive: never = input.category;
      return exhaustive;
    }
  }
}
