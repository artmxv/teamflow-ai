import { ApiError } from "@/lib/api/client";
import type { TKey } from "@/lib/i18n";

export function friendlyUploadErrorMessage(error: unknown, t: (key: TKey) => string) {
  if (error instanceof ApiError) {
    const message = error.message.toLowerCase();
    if (
      error.status === 400 &&
      (message.includes("mb or smaller") ||
        message.includes("too large") ||
        message.includes("file size"))
    ) {
      return t("uploads.fileTooLarge");
    }

    if (
      error.status >= 500 &&
      message.includes("could not upload file to supabase storage") &&
      (message.includes("fetch failed") ||
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("temporarily unavailable"))
    ) {
      return t("uploads.storageTemporarilyUnavailable");
    }
  }

  return t("uploads.uploadFailed");
}
