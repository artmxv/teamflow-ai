import { randomUUID } from "node:crypto";
import path from "node:path";

import { decodeMulterOriginalName } from "./task-upload.js";

export function resolveMulterStoredFilename(
  file: Express.Multer.File,
  fallbackExtension = "",
) {
  if (file.filename) {
    return file.filename;
  }

  const originalName = decodeMulterOriginalName(file.originalname);
  const extension = path.extname(originalName).toLowerCase() || fallbackExtension;
  return `${randomUUID()}${extension}`;
}
