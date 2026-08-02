import { clearAuthenticatedBlobCache } from "@/lib/api/authenticated-blob-cache";

const AUTH_TOKEN_KEY = "teamflow_auth_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  clearAuthenticatedBlobCache();
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  clearAuthenticatedBlobCache();
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
