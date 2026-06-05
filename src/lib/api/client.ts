import { getAuthToken } from "@/lib/auth/token";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
export const SELECTED_WORKSPACE_STORAGE_KEY = "teamflow.currentWorkspaceId";

export function getSelectedWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(SELECTED_WORKSPACE_STORAGE_KEY);
}

export function setSelectedWorkspaceId(id: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(SELECTED_WORKSPACE_STORAGE_KEY, id);
}

export function clearSelectedWorkspaceId(): void {
  if (typeof window === "undefined") {
    return;
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

    const workspaceId = getSelectedWorkspaceId();
    if (workspaceId) {
      headers["X-Workspace-Id"] = workspaceId;
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
