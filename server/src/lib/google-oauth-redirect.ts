import { getSafeRedirectPath } from "./safe-redirect.js";

export function buildGoogleOAuthCallbackUrl(
  frontendUrl: string,
  token: string,
  redirect: string,
): string {
  const fragment = new URLSearchParams({
    token,
    redirect: getSafeRedirectPath(redirect),
  });
  return `${frontendUrl.replace(/\/$/, "")}/auth/callback#${fragment.toString()}`;
}
