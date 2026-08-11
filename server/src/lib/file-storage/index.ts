import { avatarPublicPath, deleteLocalAvatarFile } from "../avatar-upload.js";
import { isSupabaseConfigured, isSupabaseStorageEnabled } from "./driver.js";
import {
  deleteFromSupabase,
  createSignedDownloadUrl,
  fetchObjectContent,
  resolveSupabaseObjectKeyFromPublicUrl,
  uploadToSupabase,
} from "./supabase.js";
import { deleteLocalStoredFile, readLocalStoredFile } from "./local.js";
import type { FileStorageCategory, ResolvedStoredFile, StoredFilePayload } from "./types.js";
import { isFullStorageObjectKey, resolveStorageObjectKey } from "./types.js";

export type { FileStorageCategory, ResolvedStoredFile, StoredFilePayload };
export {
  buildObjectKey,
  buildStoredObjectFilename,
  isFullStorageObjectKey,
  resolveStorageObjectKey,
} from "./types.js";

export {
  isSupabaseConfigured,
  isSupabaseStorageEnabled,
  shouldBufferUploadsInMemory,
  shouldUseSupabaseForProjectTaskUploads,
} from "./driver.js";

export { getSupabaseObjectAvailability } from "./supabase.js";

export async function persistUploadedFile(input: StoredFilePayload) {
  await uploadToSupabase(input);
}

export async function deleteStoredFile(input: {
  category: FileStorageCategory;
  entityId?: string;
  filename: string;
}) {
  if (shouldResolveEntityFileFromSupabase(input.category, input.filename)) {
    if (!input.entityId) {
      return;
    }

    const objectKey = resolveStorageObjectKey({
      category: input.category,
      entityId: input.entityId,
      filename: input.filename,
    });
    await deleteFromSupabase({ objectKey });

    // TODO: remove after legacy Render-local files are no longer needed.
    if (!isFullStorageObjectKey(input.filename)) {
      deleteLocalStoredFile(input);
    }
    return;
  }

  deleteLocalStoredFile(input);
}

function shouldResolveEntityFileFromSupabase(
  category: FileStorageCategory,
  filename: string,
): boolean {
  if (category === "avatar") {
    return isSupabaseStorageEnabled();
  }

  return (
    isSupabaseStorageEnabled() ||
    (isSupabaseConfigured() && isFullStorageObjectKey(filename))
  );
}

export async function resolveStoredFile(input: {
  category: FileStorageCategory;
  entityId?: string;
  filename: string;
  mimeType: string;
  originalName: string;
}): Promise<ResolvedStoredFile | null> {
  if (shouldResolveEntityFileFromSupabase(input.category, input.filename)) {
    if (!input.entityId) {
      return null;
    }

    const objectKey = resolveStorageObjectKey({
      category: input.category,
      entityId: input.entityId,
      filename: input.filename,
    });

    const hasSupabaseObject = Boolean(await createSignedDownloadUrl(objectKey));
    if (hasSupabaseObject) {
      return {
        kind: "supabase",
        objectKey,
        mimeType: input.mimeType,
        originalName: input.originalName,
      };
    }

    // Fallback for files uploaded to Render local disk before Supabase migration.
    if (!isFullStorageObjectKey(input.filename)) {
      const filePath = readLocalStoredFile(input);
      if (filePath) {
        return {
          kind: "local",
          filePath,
          mimeType: input.mimeType,
          originalName: input.originalName,
        };
      }
    }

    return null;
  }

  const filePath = readLocalStoredFile(input);
  if (!filePath) {
    return null;
  }

  return {
    kind: "local",
    filePath,
    mimeType: input.mimeType,
    originalName: input.originalName,
  };
}

/**
 * Client-facing avatar URL. Always an app path (`/uploads/avatars/...`) so the API
 * can serve local disk or private Supabase objects. Do not store `/object/public/`
 * URLs — private buckets reject them with HTTP 400.
 */
export function resolveAvatarStorageUrl(filename: string) {
  return avatarPublicPath(filename);
}

function resolveSupabaseAvatarObjectKey(avatarUrl: string): string | null {
  const fromPublicUrl = resolveSupabaseObjectKeyFromPublicUrl(avatarUrl);
  if (fromPublicUrl) {
    return fromPublicUrl;
  }

  const localMatch = avatarUrl.trim().match(/\/uploads\/avatars\/([^/?#]+)$/i);
  const filename = localMatch?.[1];
  if (!filename || filename.includes("..")) {
    return null;
  }

  return `avatars/${filename}`;
}

export async function deleteAvatarByUrl(avatarUrl: string | null | undefined) {
  if (!avatarUrl) {
    return;
  }

  if (isSupabaseStorageEnabled()) {
    const objectKey = resolveSupabaseAvatarObjectKey(avatarUrl);
    if (objectKey) {
      await deleteFromSupabase({ objectKey });
    }
    return;
  }

  deleteLocalAvatarFile(avatarUrl);
}

function setInlineFileHeaders(
  res: import("express").Response,
  file: Pick<ResolvedStoredFile, "mimeType" | "originalName">,
  contentType?: string | null,
  contentLength?: number | null,
) {
  res.setHeader("Content-Type", file.mimeType || contentType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(file.originalName)}"`,
  );

  if (contentLength != null && Number.isFinite(contentLength)) {
    res.setHeader("Content-Length", String(contentLength));
  }
}

export async function sendResolvedStoredFile(
  res: import("express").Response,
  file: ResolvedStoredFile,
  next: import("express").NextFunction,
): Promise<void> {
  if (file.kind === "supabase") {
    const download = await fetchObjectContent(file.objectKey);
    if (!download.ok) {
      if (!res.headersSent) {
        if (download.reason === "not_found") {
          res.status(404).json({ message: "File is no longer available on the server" });
          return;
        }

        res.status(500).json({ message: "Could not download file from storage" });
      }
      return;
    }

    res.status(200);
    setInlineFileHeaders(res, file, download.contentType, download.contentLength);

    try {
      const { pipeline } = await import("node:stream/promises");
      const { Readable } = await import("node:stream");
      await pipeline(Readable.fromWeb(download.body), res);
    } catch (pipeError) {
      if (!res.headersSent) {
        next(pipeError);
      }
    }
    return;
  }

  res.status(200);
  setInlineFileHeaders(res, file);

  res.sendFile(file.filePath, { maxAge: 0 }, (sendError) => {
    if (sendError && !res.headersSent) {
      next(sendError);
    }
  });
}
