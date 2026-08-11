/**
 * Canonical browser avatar URL for Supabase-backed (and legacy) avatars:
 * `/uploads/avatars/:filename` on the API origin.
 *
 * Production (same-origin API via Vercel): `apiBaseUrl` is `""`, so the path stays
 * relative and `vercel.json` rewrites `/uploads/*` to Render. Do not invent absolute
 * Render filesystem URLs on the client.
 */
export function resolveAvatarUrlWithBase(
  url: string | null | undefined,
  apiBaseUrl: string,
): string | null {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const base = apiBaseUrl.replace(/\/+$/, "");

  const supabaseAvatarMatch = trimmed.match(
    /\/storage\/v1\/object\/public\/[^/]+\/avatars\/([^/?#]+)/i,
  );
  if (supabaseAvatarMatch?.[1]) {
    return avatarUploadsUrl(base, supabaseAvatarMatch[1]);
  }

  // Absolute app/API avatar paths → same canonical uploads URL (works with /uploads rewrite).
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const uploadsMatch = parsed.pathname.match(/\/uploads\/avatars\/([^/?#]+)$/i);
      if (uploadsMatch?.[1]) {
        return avatarUploadsUrl(base, uploadsMatch[1]);
      }
    } catch {
      return trimmed;
    }
    // External hosts (e.g. Google OAuth picture CDN) stay as-is.
    return trimmed;
  }

  const relativeUploadsMatch = trimmed.match(/\/uploads\/avatars\/([^/?#]+)$/i);
  if (relativeUploadsMatch?.[1]) {
    return avatarUploadsUrl(base, relativeUploadsMatch[1]);
  }

  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`;
  }

  return trimmed;
}

function avatarUploadsUrl(apiBaseUrl: string, filename: string): string {
  const safe =
    !filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")
      ? encodeURIComponent(filename)
      : filename;
  return `${apiBaseUrl}/uploads/avatars/${safe}`;
}
