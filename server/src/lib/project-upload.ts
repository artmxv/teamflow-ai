import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import multer from "multer";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const PROJECT_UPLOAD_ROOT = path.join(serverRoot, "uploads", "projects");

export const MAX_PROJECT_DOCUMENT_BYTES = 20 * 1024 * 1024;

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

export function isAllowedProjectDocument(mimeType: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return allowedMimeTypes.has(mimeType) || allowedExtensions.has(extension);
}

export function decodeMulterOriginalName(originalName: string): string {
  if (!originalName) {
    return originalName;
  }

  return Buffer.from(originalName, "latin1").toString("utf8");
}

export function projectDocumentDiskPath(projectId: string, filename: string) {
  return path.join(PROJECT_UPLOAD_ROOT, projectId, filename);
}

export function ensureProjectUploadDir(projectId: string) {
  const dir = path.join(PROJECT_UPLOAD_ROOT, projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function removeStoredProjectDocument(projectId: string, filename: string) {
  const filePath = projectDocumentDiskPath(projectId, filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  fs.unlinkSync(filePath);
}

export const projectDocumentUpload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const projectId = req.params.id;
      if (typeof projectId !== "string") {
        cb(new Error("Project id is required"), "");
        return;
      }
      try {
        cb(null, ensureProjectUploadDir(projectId));
      } catch (error) {
        cb(error instanceof Error ? error : new Error("Could not prepare upload folder"), "");
      }
    },
    filename(_req, file, cb) {
      const originalName = decodeMulterOriginalName(file.originalname);
      const extension = path.extname(originalName).toLowerCase();
      cb(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: MAX_PROJECT_DOCUMENT_BYTES },
  fileFilter(_req, file, cb) {
    const originalName = decodeMulterOriginalName(file.originalname);
    if (!isAllowedProjectDocument(file.mimetype, originalName)) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});
