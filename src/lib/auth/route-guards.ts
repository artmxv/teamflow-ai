import { redirect } from "@tanstack/react-router";
import { getAuthToken } from "./token";

/** Redirect to sign-in when no token (client only; localStorage is unavailable during SSR). */
export function requireAuth(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!getAuthToken()) {
    throw redirect({ to: "/signin" });
  }
}

/** Keep sign-in/sign-up public; send authenticated users to the app. */
export function redirectIfAuthenticated(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (getAuthToken()) {
    throw redirect({ to: "/app/dashboard" });
  }
}
