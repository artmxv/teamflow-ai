import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import multer from "multer";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const AVATAR_UPLOAD_ROOT = path.join(serverRoot, "uploads", "avatars");

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function isAllowedAvatarImage(mimeType: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return allowedMimeTypes.has(mimeType) || allowedExtensions.has(extension);
}

export function avatarPublicPath(filename: string) {
  return `/uploads/avatars/${filename}`;
}

export function ensureAvatarUploadDir() {
  fs.mkdirSync(AVATAR_UPLOAD_ROOT, { recursive: true });
  return AVATAR_UPLOAD_ROOT;
}

export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      try {
        cb(null, ensureAvatarUploadDir());
      } catch (error) {
        cb(error instanceof Error ? error : new Error("Could not prepare upload folder"), "");
      }
    },
    filename(_req, file, cb) {
      const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: MAX_AVATAR_BYTES },
  fileFilter(_req, file, cb) {
    if (!isAllowedAvatarImage(file.mimetype, file.originalname)) {
      cb(new Error("UNSUPPORTED_AVATAR_TYPE"));
      return;
    }
    cb(null, true);
  },
});
