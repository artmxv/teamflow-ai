import type { NextFunction, Request, Response } from "express";
import path from "node:path";

import {
  isSupabaseStorageEnabled,
  resolveStoredFile,
  sendResolvedStoredFile,
} from "../lib/file-storage/index.js";

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

/**
 * Serve avatar bytes for `/uploads/avatars/:filename`.
 * Local driver falls through to express.static; Supabase streams via signed download
 * because the bucket is private and `/object/public/*` URLs return 400.
 */
export async function serveAvatarFileController(req: Request, res: Response, next: NextFunction) {
  const filename = typeof req.params.filename === "string" ? req.params.filename : "";
  if (!isSafeAvatarFilename(filename)) {
    res.status(404).json({ message: "Avatar not found" });
    return;
  }

  if (!isSupabaseStorageEnabled()) {
    next();
    return;
  }

  const extension = path.extname(filename).toLowerCase();
  const mimeType = AVATAR_MIME_BY_EXT[extension] ?? "application/octet-stream";

  try {
    const file = await resolveStoredFile({
      category: "avatar",
      entityId: "_",
      filename,
      mimeType,
      originalName: filename,
    });

    if (!file) {
      res.status(404).json({ message: "Avatar not found" });
      return;
    }

    await sendResolvedStoredFile(res, file, next);
  } catch (error) {
    next(error);
  }
}
