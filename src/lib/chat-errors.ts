import { ApiError } from "@/lib/api/client";
import {
  CHAT_MAX_FILE_ATTACHMENTS,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_SEND_OFFLINE_ERROR,
  CHAT_SEND_TIMEOUT_ERROR,
} from "@/lib/api/chat";
import { friendlyApiErrorMessage } from "@/lib/api-error";
import type { TKey } from "@/lib/i18n";

const CHAT_TITLE_MAX_LENGTH = 80;

const CHAT_ERROR_KEYS: Record<string, TKey> = {
  "Cannot create a direct chat with yourself": "chat.directSelfFailed",
  "Workspace member not found": "chat.directCreateFailed",
  "Pinned message limit reached (50 per conversation)": "chat.pinLimitReached",
  "You can only delete your own messages": "chat.deleteOwnOnly",
  "Only workspace owners and admins can rename the general chat": "chat.renameDenied",
  "Direct conversations cannot be renamed": "chat.renameDirectDenied",
  "Message text or attachments are required": "chat.validationEmpty",
  "Invalid chat message payload": "chat.sendFailed",
  "Duplicate task or project attachments are not allowed": "chat.duplicateAttachment",
  "One or more tasks were not found in this workspace": "chat.entityNotFound",
  "One or more projects were not found in this workspace": "chat.entityNotFound",
  "One or more files are invalid": "chat.attachmentInvalid",
  "You cannot download this attachment": "chat.downloadFailed",
  "Attachment not found": "chat.attachmentUnavailable",
  "Unsupported reaction emoji": "chat.reactionFailed",
  "Conversation not found": "chat.errorTitle",
  "Message not found": "chat.errorTitle",
  "title cannot be empty": "chat.renameValidationEmpty",
  [CHAT_SEND_OFFLINE_ERROR]: "common.offline",
  [CHAT_SEND_TIMEOUT_ERROR]: "common.offline",
};

/**
 * Maps chat API failures to safe localized copy.
 * Never returns raw backend error.message to the UI.
 */
export function friendlyChatErrorMessage(
  error: unknown,
  t: (key: TKey) => string,
  fallbackKey: TKey,
): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return t("common.offline");
    }

    const exact = CHAT_ERROR_KEYS[error.message];
    if (exact) {
      return t(exact);
    }

    const lower = error.message.toLowerCase();
    if (lower.includes("mb or smaller") || lower.includes("file must be")) {
      return t("chat.validationFileTooLarge").replace("{max}", "10");
    }
    if (lower.includes("attach at most")) {
      return t("chat.validationTooManyFiles").replace("{max}", String(CHAT_MAX_FILE_ATTACHMENTS));
    }
    if (lower.includes("content must be at most")) {
      return t("chat.validationTooLong").replace("{max}", String(CHAT_MESSAGE_MAX_LENGTH));
    }
    if (lower.includes("title must be at most")) {
      return t("chat.renameValidationTooLong").replace("{max}", String(CHAT_TITLE_MAX_LENGTH));
    }
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return t("common.offline");
  }

  if (error instanceof ApiError && error.status === 403) {
    return t("common.errorForbiddenHint");
  }

  return friendlyApiErrorMessage(error, t, fallbackKey);
}
