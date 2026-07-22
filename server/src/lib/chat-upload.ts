import multer from "multer";

import { CHAT_MAX_FILE_ATTACHMENTS, CHAT_MAX_FILE_BYTES } from "./chat-attachment-utils.js";
import { decodeMulterOriginalName, isAllowedTaskAttachment } from "./task-upload.js";

export const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CHAT_MAX_FILE_BYTES,
    files: CHAT_MAX_FILE_ATTACHMENTS,
  },
  fileFilter(_req, file, cb) {
    const originalName = decodeMulterOriginalName(file.originalname);
    if (!originalName.trim()) {
      cb(new Error("Invalid file name"));
      return;
    }
    if (!isAllowedTaskAttachment(file.mimetype, originalName)) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});
