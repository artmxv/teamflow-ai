import { getAuthToken } from "@/lib/auth/token";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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
