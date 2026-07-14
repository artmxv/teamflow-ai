import { ApiError } from "@/lib/api/client";
import type { TKey } from "@/lib/i18n";

const API_ERROR_KEYS: Record<string, TKey> = {
  "Failed to fetch": "common.errorNetwork",
  "NetworkError when attempting to fetch resource.": "common.errorNetwork",
  "Load failed": "common.errorNetwork",
};

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    return lower.includes("failed to fetch") || lower.includes("network");
  }
  return false;
}

/** Map API/network errors to localized, user-friendly copy (no raw stack traces). */
export function friendlyApiErrorMessage(
  error: unknown,
  t: (key: TKey) => string,
  fallbackKey: TKey = "common.errorServerHint",
): string {
  if (isNetworkError(error)) {
    return t("common.errorNetwork");
  }

  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return t("common.errorAccessDenied");
    }
    if (error.status >= 500) {
      return t(fallbackKey);
    }
    const key = API_ERROR_KEYS[error.message];
    if (key) {
      return t(key);
    }
  }

  if (error instanceof Error) {
    const key = API_ERROR_KEYS[error.message];
    if (key) {
      return t(key);
    }
  }

  return t(fallbackKey);
}
