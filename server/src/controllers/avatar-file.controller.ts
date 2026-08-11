import type { NextFunction, Request, Response } from "express";
import path from "node:path";

import {
  getSupabaseObjectAvailability,
  isSupabaseStorageEnabled,
  resolveStoredFile,
  resolveStorageObjectKey,
  sendResolvedStoredFile,
} from "../lib/file-storage/index.js";
import { clearStaleUploadedAvatarReferences } from "../services/auth.service.js";

const AVATAR_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function isSafeAvatarFilename(filename: string) {
  return (
    Boolean(filename) &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !path.isAbsolute(filename)
  );
}

type AvatarFileControllerDeps = {
  isSupabaseStorageEnabled: typeof isSupabaseStorageEnabled;
  resolveStoredFile: typeof resolveStoredFile;
  getSupabaseObjectAvailability: typeof getSupabaseObjectAvailability;
  resolveStorageObjectKey: typeof resolveStorageObjectKey;
  sendResolvedStoredFile: typeof sendResolvedStoredFile;
  clearStaleUploadedAvatarReferences: typeof clearStaleUploadedAvatarReferences;
};

const defaultDeps: AvatarFileControllerDeps = {
  isSupabaseStorageEnabled,
  resolveStoredFile,
  getSupabaseObjectAvailability,
  resolveStorageObjectKey,
  sendResolvedStoredFile,
  clearStaleUploadedAvatarReferences,
};

/**
 * Clear stale DB avatarUrl only when storage confirms the object is missing.
 * Returns true only for that confirmed-missing + successful clear path.
 * Network/auth/unknown storage errors return false (caller keeps 404).
 */
async function clearConfirmedMissingAvatarReference(
  filename: string,
  deps: AvatarFileControllerDeps,
): Promise<boolean> {
  try {
    if (deps.isSupabaseStorageEnabled()) {
      const objectKey = deps.resolveStorageObjectKey({
        category: "avatar",
        entityId: "_",
        filename,
      });
      const availability = await deps.getSupabaseObjectAvailability(objectKey);
      if (availability !== "missing") {
        // Transient storage / permission errors must not wipe valid avatarUrl rows.
        return false;
      }
    } else {
      // Without Supabase we cannot confirm object absence the same way.
      return false;
    }

    await deps.clearStaleUploadedAvatarReferences(filename);
    return true;
  } catch (error) {
    console.warn("[avatar] Could not clear stale avatar references", error);
    return false;
  }
}

/**
 * Serve avatar bytes for `/uploads/avatars/:filename`.
 * Local driver falls through to express.static; Supabase streams via signed download
 * because the bucket is private and `/object/public/*` URLs return 400.
 * Confirmed-missing: clear stale DB refs and return 204 (img onError → initials).
 */
export function createServeAvatarFileController(overrides: Partial<AvatarFileControllerDeps> = {}) {
  const deps: AvatarFileControllerDeps = { ...defaultDeps, ...overrides };

  return async function serveAvatarFileController(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const filename = typeof req.params.filename === "string" ? req.params.filename : "";
    if (!isSafeAvatarFilename(filename)) {
      res.status(404).json({ message: "Avatar not found" });
      return;
    }

    if (!deps.isSupabaseStorageEnabled()) {
      next();
      return;
    }

    const extension = path.extname(filename).toLowerCase();
    const mimeType = AVATAR_MIME_BY_EXT[extension] ?? "application/octet-stream";

    try {
      const file = await deps.resolveStoredFile({
        category: "avatar",
        entityId: "_",
        filename,
        mimeType,
        originalName: filename,
      });

      if (!file) {
        const confirmedMissingCleared = await clearConfirmedMissingAvatarReference(filename, deps);
        if (confirmedMissingCleared) {
          res.status(204).end();
          return;
        }

        res.status(404).json({ message: "Avatar not found" });
        return;
      }

      await deps.sendResolvedStoredFile(res, file, next);
    } catch (error) {
      next(error);
    }
  };
}

export const serveAvatarFileController = createServeAvatarFileController();
