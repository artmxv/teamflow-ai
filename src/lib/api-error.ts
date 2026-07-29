import { ApiError } from "@/lib/api/client";
import type { TKey } from "@/lib/i18n";

const API_ERROR_KEYS: Record<string, TKey> = {
  "Failed to fetch": "common.errorNetwork",
  "NetworkError when attempting to fetch resource.": "common.errorNetwork",
  "Load failed": "common.errorNetwork",
};

/** Stable marker for intentional offline guards (mapped → common.offline). */
export const OFFLINE_ERROR_MARKER = "OFFLINE";

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** Throws OFFLINE_ERROR_MARKER when the browser reports no network. */
export function assertBrowserOnline(): void {
  if (isBrowserOffline()) {
    throw new Error(OFFLINE_ERROR_MARKER);
  }
}

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

/** Network blips or hosting cold starts — safe to retry. */
export function isTransientApiError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 408 || error.status >= 502;
  }
  return false;
}

export function isAuthApiError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Map API/network errors to localized, user-friendly copy (no raw stack traces). */
export function friendlyApiErrorMessage(
  error: unknown,
  t: (key: TKey) => string,
  fallbackKey: TKey = "common.errorServerHint",
): string {
  if (isBrowserOffline()) {
    return t("common.offline");
  }

  if (error instanceof Error && error.message === OFFLINE_ERROR_MARKER) {
    return t("common.offline");
  }

  if (isNetworkError(error)) {
    return t("common.errorNetwork");
  }

  if (isTransientApiError(error)) {
    return t("common.errorServerHint");
  }

  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return error.status === 401 ? t("common.errorAccessDenied") : t("common.errorForbiddenHint");
    }
    if (error.status === 404) {
      return t("common.errorNotFoundHint");
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

  return t("common.errorGenericHint");
}
