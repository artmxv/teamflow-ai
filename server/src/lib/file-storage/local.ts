import fs from "node:fs";

import {
  projectDocumentDiskPath,
  removeStoredProjectDocument,
} from "../project-upload.js";
import {
  removeStoredTaskAttachment,
  taskAttachmentDiskPath,
} from "../task-upload.js";
import {
  deleteLocalAvatarFile,
  resolveAvatarFilePathFromUrl,
} from "../avatar-upload.js";
import type { FileStorageCategory } from "./types.js";

export function localDiskPath(input: {
  category: FileStorageCategory;
  entityId?: string;
  filename: string;
}) {
  switch (input.category) {
    case "avatar":
      return resolveAvatarFilePathFromUrl(`/uploads/avatars/${input.filename}`);
    case "task":
      if (!input.entityId) {
        throw new Error("Task id is required for task file storage");
      }
      return taskAttachmentDiskPath(input.entityId, input.filename);
    case "project":
      if (!input.entityId) {
        throw new Error("Project id is required for project file storage");
      }
      return projectDocumentDiskPath(input.entityId, input.filename);
    default: {
      const exhaustive: never = input.category;
      return exhaustive;
    }
  }
}

export function deleteLocalStoredFile(input: {
  category: FileStorageCategory;
  entityId?: string;
  filename: string;
}) {
  switch (input.category) {
    case "avatar":
      deleteLocalAvatarFile(`/uploads/avatars/${input.filename}`);
      return;
    case "task":
      if (!input.entityId) {
        return;
      }
      removeStoredTaskAttachment(input.entityId, input.filename);
      return;
    case "project":
      if (!input.entityId) {
        return;
      }
      removeStoredProjectDocument(input.entityId, input.filename);
      return;
    default: {
      const exhaustive: never = input.category;
      return exhaustive;
    }
  }
}

export function readLocalStoredFile(input: {
  category: FileStorageCategory;
  entityId?: string;
  filename: string;
}) {
  const filePath = localDiskPath(input);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return filePath;
}
