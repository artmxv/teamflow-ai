import { API_BASE_URL } from "@/lib/api/client";
import { resolveAvatarUrlWithBase } from "@/lib/avatar-url-resolve";

/**
 * Resolve avatar URL for <img src>.
 * Rewrites broken Supabase `/object/public/…/avatars/…` URLs (private bucket → 400)
 * and absolute app `/uploads/avatars/…` hosts to the canonical API uploads path.
 */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  return resolveAvatarUrlWithBase(url, API_BASE_URL);
}

/**
 * Optional larger Google CDN variant for fullscreen preview.
 * Returns null when no safe upgrade is available; callers should keep the original URL.
 */
export function upgradeGoogleAvatarPreviewUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("googleusercontent.com")) {
      return null;
    }

    const href = url;
    const pathUpgraded = href.replace(/\/s\d+(?:-c)?\//i, "/s512-c/");
    const queryUpgraded = pathUpgraded.replace(/=s\d+(?:-c)?(?=$|[?#])/i, "=s512-c");
    if (queryUpgraded === url) {
      return null;
    }
    return queryUpgraded;
  } catch {
    return null;
  }
}
