import { apiRequest } from "./client";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface AuthMeData {
  user: AuthUser;
  workspace: AuthWorkspace | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface AuthPayloadResponse {
  data: {
    user: AuthUser;
    token: string;
  };
}

interface MeResponse {
  data: AuthMeData;
}

interface LogoutResponse {
  data: {
    success: boolean;
  };
}

export type AuthResponse = AuthPayloadResponse["data"];

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await apiRequest<AuthPayloadResponse>("/api/auth/login", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
  return response.data;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiRequest<AuthPayloadResponse>("/api/auth/register", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
  return response.data;
}

export async function getMe(): Promise<AuthMeData> {
  const response = await apiRequest<MeResponse>("/api/auth/me");
  return response.data;
}

export async function logout(): Promise<void> {
  await apiRequest<LogoutResponse>("/api/auth/logout", { method: "POST" });
}
