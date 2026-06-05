export const DEFAULT_POST_AUTH_PATH = "/app/dashboard";

/** Allow only same-origin relative paths to prevent open redirects. */
export function getSafeRedirectPath(redirect: unknown): string {
  if (typeof redirect !== "string") {
    return DEFAULT_POST_AUTH_PATH;
  }

  const trimmed = redirect.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_POST_AUTH_PATH;
  }

  return trimmed;
}
