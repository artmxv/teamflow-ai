import { useSyncExternalStore } from "react";

import { API_BASE_URL } from "@/lib/api/client";
import {
  getAvatarFailureSnapshot,
  isAvatarUrlFailed,
  markAvatarUrlFailed,
  subscribeAvatarFailures,
} from "@/lib/avatar-failure-cache";
import { resolveAvatarUrlWithBase } from "@/lib/avatar-url-resolve";

/**
 * Resolve avatar URL for <img src>.
 * Rewrites broken Supabase `/object/public/…/avatars/…` URLs (private bucket → 400)
 * and absolute app `/uploads/avatars/…` hosts to the canonical API uploads path.
 * Returns null for URLs that already failed to load in this session.
 */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  const resolved = resolveAvatarUrlWithBase(url, API_BASE_URL);
  if (!resolved || isAvatarUrlFailed(resolved)) {
    return null;
  }
  return resolved;
}

/**
 * Subscribes to the shared failure cache so parents (e.g. MemberProfileDrawer)
 * re-render when an avatar URL is marked broken and stop showing zoom / preview.
 */
export function useResolvedAvatarUrl(url: string | null | undefined): string | null {
  useSyncExternalStore(subscribeAvatarFailures, getAvatarFailureSnapshot, () => 0);
  return resolveAvatarUrl(url);
}

export function reportAvatarLoadFailure(url: string | null | undefined): void {
  markAvatarUrlFailed(url);
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
