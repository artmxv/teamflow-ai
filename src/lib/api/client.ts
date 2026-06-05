import { getAuthToken } from "@/lib/auth/token";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/** @deprecated Legacy global key — migrated to user-scoped keys on login. */
export const SELECTED_WORKSPACE_STORAGE_KEY = "teamflow.currentWorkspaceId";

export const ACTIVE_WORKSPACE_STORAGE_KEY = "teamflow.activeWorkspaceId";
const USER_WORKSPACE_KEY_PREFIX = "teamflow.currentWorkspaceId:";

let sessionUserId: string | null = null;
let sessionUserEmail: string | null = null;

export function setWorkspaceStorageUser(userId: string | null, userEmail?: string | null): void {
  sessionUserId = userId;
  sessionUserEmail = userEmail ?? null;
}

export function getUserScopedWorkspaceKey(
  userId?: string | null,
  userEmail?: string | null,
): string | null {
  const id = userId ?? sessionUserId;
  if (id) {
    return `${USER_WORKSPACE_KEY_PREFIX}${id}`;
  }
  const email = userEmail ?? sessionUserEmail;
  if (email) {
    return `${USER_WORKSPACE_KEY_PREFIX}${email}`;
  }
  return null;
}

/** Active workspace for the current session (X-Workspace-Id header). */
export function getSelectedWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
}

/** User-specific persisted workspace (survives logout). */
export function getPersistedWorkspaceId(
  userId?: string | null,
  userEmail?: string | null,
): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const key = getUserScopedWorkspaceKey(userId, userEmail);
  if (!key) {
    return null;
  }
  return localStorage.getItem(key);
}

export function setSelectedWorkspaceId(
  id: string,
  userId?: string | null,
  userEmail?: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id);
  const key = getUserScopedWorkspaceKey(userId, userEmail);
  if (key) {
    localStorage.setItem(key, id);
  }
}

export function clearActiveWorkspaceId(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
}

/** Clears active session workspace; optionally clears a user's persisted choice. */
export function clearSelectedWorkspaceId(userId?: string | null, userEmail?: string | null): void {
  clearActiveWorkspaceId();
  const key = getUserScopedWorkspaceKey(userId, userEmail);
  if (key) {
    localStorage.removeItem(key);
  }
}

/** Save current active workspace to the user's scoped key, then clear active session. */
export function preserveWorkspaceSelectionForUser(userId: string, userEmail?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  const active = getSelectedWorkspaceId();
  const key = getUserScopedWorkspaceKey(userId, userEmail);
  if (active && key) {
    localStorage.setItem(key, active);
  }
  clearActiveWorkspaceId();
}

/** One-time migration from the legacy global key to the current user's scoped key. */
export function migrateLegacyWorkspaceKey(userId: string, userEmail?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  const legacy = localStorage.getItem(SELECTED_WORKSPACE_STORAGE_KEY);
  if (!legacy) {
    return;
  }
  const key = getUserScopedWorkspaceKey(userId, userEmail);
  if (key && !localStorage.getItem(key)) {
    localStorage.setItem(key, legacy);
  }
  localStorage.removeItem(SELECTED_WORKSPACE_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  /** Do not send Authorization header (e.g. login/register). */
  skipAuth?: boolean;
  /** Do not send X-Workspace-Id (token-based routes like workspace invitations). */
  skipWorkspaceHeader?: boolean;
};

export async function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const headers: Record<string, string> = {};

  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!options?.skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (!options?.skipWorkspaceHeader) {
      const workspaceId = getSelectedWorkspaceId();
      if (workspaceId) {
        headers["X-Workspace-Id"] = workspaceId;
      }
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? (options?.body !== undefined ? "POST" : "GET"),
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    const message = body?.message ?? `API request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body?.code);
  }

  return response.json() as Promise<T>;
}
