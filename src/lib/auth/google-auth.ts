import { API_BASE_URL } from "@/lib/api/client";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import type { TKey } from "@/lib/i18n";

export function startGoogleAuth(redirectPath?: string): void {
  const safeRedirect = getSafeRedirectPath(redirectPath);
  const params = new URLSearchParams({ redirect: safeRedirect });
  window.location.href = `${API_BASE_URL}/api/auth/google?${params.toString()}`;
}

export function googleAuthErrorKey(error: string | undefined): TKey {
  if (error === "google_unavailable") {
    return "auth.googleUnavailable";
  }
  return "auth.googleSignInFailed";
}
