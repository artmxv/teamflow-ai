export type GoogleOAuthCallbackFragment = {
  token?: string;
  redirect?: string;
};

/** Read the one-time OAuth fragment and remove it before the token is used by any network call. */
export function consumeGoogleOAuthCallbackFragment(): GoogleOAuthCallbackFragment {
  if (typeof window === "undefined") {
    return {};
  }

  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(rawHash);
  const token = params.get("token")?.trim() || undefined;
  const redirect = params.get("redirect")?.trim() || undefined;

  if (rawHash.length > 0) {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  return { token, redirect };
}
