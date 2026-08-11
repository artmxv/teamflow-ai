import { API_BASE_URL } from "@/lib/api/client";

/**
 * Resolve avatar URL for <img src>.
 * Rewrites broken Supabase `/object/public/…/avatars/…` URLs (private bucket → 400)
 * to the API path that streams the file via signed download.
 */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const supabaseAvatarMatch = url.match(
    /\/storage\/v1\/object\/public\/[^/]+\/avatars\/([^/?#]+)/i,
  );
  if (supabaseAvatarMatch?.[1]) {
    return `${API_BASE_URL}/uploads/avatars/${supabaseAvatarMatch[1]}`;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
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
