import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import multer from "multer";


const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const TASK_UPLOAD_ROOT = path.join(serverRoot, "uploads", "tasks");

export const MAX_TASK_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const allowedExtensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
]);

export function isAllowedTaskAttachment(mimeType: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return allowedMimeTypes.has(mimeType) || allowedExtensions.has(extension);
}

/**
 * Multer receives multipart filenames as latin1 strings even when the browser
 * sends UTF-8 (e.g. Cyrillic). Re-decode bytes so originalName stores correctly.
 */
export function decodeMulterOriginalName(originalName: string): string {
  if (!originalName) {
    return originalName;
  }

  return Buffer.from(originalName, "latin1").toString("utf8");
}

export function taskAttachmentDiskPath(taskId: string, filename: string) {
  return path.join(TASK_UPLOAD_ROOT, taskId, filename);
}

export function removeStoredTaskAttachment(taskId: string, filename: string) {
  const filePath = taskAttachmentDiskPath(taskId, filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  fs.unlinkSync(filePath);
}

export const taskAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TASK_ATTACHMENT_BYTES },
  fileFilter(_req, file, cb) {
    const originalName = decodeMulterOriginalName(file.originalname);
    if (!isAllowedTaskAttachment(file.mimetype, originalName)) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});
