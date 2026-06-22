import { ApiError } from "@/lib/api/client";
import type { TKey } from "@/lib/i18n";

/** Network blips or hosting cold starts — safe to retry. */
export function isTransientApiError(error: unknown): boolean {
  if (error instanceof TypeError) {
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

/** User-facing copy — never expose raw fetch/status messages. */
export function friendlyApiErrorMessage(error: unknown, t: (key: TKey) => string): string {
  if (isTransientApiError(error)) {
    return t("common.errorServerHint");
  }
  if (error instanceof ApiError && error.status === 403) {
    return t("common.errorForbiddenHint");
  }
  if (error instanceof ApiError && error.status === 404) {
    return t("common.errorNotFoundHint");
  }
  return t("common.errorGenericHint");
}
