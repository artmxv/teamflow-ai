import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import { appUrl, env } from "../config/env.js";
import { getSafeRedirectPath } from "../lib/safe-redirect.js";
import { findOrCreateGoogleUser, isGoogleOAuthConfigured } from "../services/auth.service.js";

type GoogleOAuthState = {
  redirect: string;
  purpose: "google_oauth";
};

function buildGoogleOAuthClient(): OAuth2Client | null {
  if (!isGoogleOAuthConfigured()) {
    return null;
  }

  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

function signOAuthState(redirect: string): string {
  return jwt.sign({ redirect, purpose: "google_oauth" }, env.JWT_SECRET, { expiresIn: "10m" });
}

function verifyOAuthState(state: unknown): GoogleOAuthState | null {
  if (typeof state !== "string" || state.length === 0) {
    return null;
  }

  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as GoogleOAuthState;
    if (payload.purpose !== "google_oauth") {
      return null;
    }
    return {
      purpose: "google_oauth",
      redirect: getSafeRedirectPath(payload.redirect),
    };
  } catch {
    return null;
  }
}

function redirectToSignIn(res: Response, error: string, redirect?: string): void {
  const safeRedirect = getSafeRedirectPath(redirect);
  const params = new URLSearchParams({ error });
  if (safeRedirect !== "/app/dashboard") {
    params.set("redirect", safeRedirect);
  }
  res.redirect(`${appUrl}/signin?${params.toString()}`);
}

function redirectToCallback(res: Response, token: string, redirect: string): void {
  const params = new URLSearchParams({
    token,
    redirect: getSafeRedirectPath(redirect),
  });
  res.redirect(`${appUrl}/auth/callback?${params.toString()}`);
}

export function googleAuthStartController(req: Request, res: Response): void {
  const safeRedirect = getSafeRedirectPath(req.query.redirect);
  const client = buildGoogleOAuthClient();

  if (!client) {
    redirectToSignIn(res, "google_unavailable", safeRedirect);
    return;
  }

  const state = signOAuthState(safeRedirect);
  const authUrl = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });

  res.redirect(authUrl);
}

export async function googleAuthCallbackController(req: Request, res: Response): Promise<void> {
  const oauthError = typeof req.query.error === "string" ? req.query.error : null;
  const statePayload = verifyOAuthState(req.query.state);
  const safeRedirect = statePayload?.redirect ?? "/app/dashboard";

  if (oauthError) {
    redirectToSignIn(res, "google_unavailable", safeRedirect);
    return;
  }

  if (!statePayload) {
    redirectToSignIn(res, "invalid_state", safeRedirect);
    return;
  }

  const client = buildGoogleOAuthClient();
  if (!client) {
    redirectToSignIn(res, "google_unavailable", safeRedirect);
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : null;
  if (!code) {
    redirectToSignIn(res, "google_unavailable", safeRedirect);
    return;
  }

  try {
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) {
      redirectToSignIn(res, "google_unavailable", safeRedirect);
      return;
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();

    if (!profile?.email) {
      redirectToSignIn(res, "google_unavailable", safeRedirect);
      return;
    }

    if (profile.email_verified === false) {
      redirectToSignIn(res, "email_not_verified", safeRedirect);
      return;
    }

    const { token } = await findOrCreateGoogleUser({
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0] ?? "User",
      avatarUrl: profile.picture ?? null,
    });

    redirectToCallback(res, token, safeRedirect);
  } catch {
    redirectToSignIn(res, "google_unavailable", safeRedirect);
  }
}
