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

const LOCAL_AVATAR_URL_PATTERN = /^\/uploads\/avatars\/([^/]+)$/;

function pathOnlyFromAvatarUrl(avatarUrl: string) {
  const trimmed = avatarUrl.trim();
  if (!trimmed) {
    return "";
  }
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      return parsed.pathname;
    }
  } catch {
    return "";
  }
  return trimmed.split("?")[0]?.split("#")[0] ?? "";
}

export function resolveAvatarFilePathFromUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) {
    return null;
  }

  const trimmed = avatarUrl.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
    const pathname = pathOnlyFromAvatarUrl(trimmed);
    if (!pathname) {
      return null;
    }
    return resolveAvatarFilePathFromUrl(pathname);
  }

  const pathname = pathOnlyFromAvatarUrl(trimmed);
  const match = pathname.match(LOCAL_AVATAR_URL_PATTERN);
  const filename = match?.[1];
  if (!filename || filename.includes("..")) {
    return null;
  }

  const resolved = path.resolve(AVATAR_UPLOAD_ROOT, filename);
  const rootResolved = path.resolve(AVATAR_UPLOAD_ROOT);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    return null;
  }

  return resolved;
}

export function deleteLocalAvatarFile(avatarUrl: string | null | undefined): void {
  const filePath = resolveAvatarFilePathFromUrl(avatarUrl);
  if (!filePath) {
    return;
  }

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    console.warn("[avatar-upload] Could not delete local avatar file");
  }
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
