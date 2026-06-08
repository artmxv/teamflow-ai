import { apiRequest, apiUpload } from "./client";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export interface AuthUser {
  id: string;
  name: string;
  displayName: string | null;
  timezone: string | null;
  bio: string | null;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
  phone: string | null;
  position: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BillingPlanId = "FREE" | "TEAM" | "BUSINESS" | "ENTERPRISE";

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  teamSize: string | null;
  plan: BillingPlanId;
  role: WorkspaceRole;
}

export interface UpdateProfileInput {
  name?: string;
  displayName?: string;
  timezone?: string;
  bio?: string;
  phone?: string;
  position?: string;
  location?: string;
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

interface UpdateProfileResponse {
  data: {
    user: AuthUser;
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

export async function updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
  const response = await apiRequest<UpdateProfileResponse>("/api/auth/profile", {
    method: "PATCH",
    body: input,
  });
  return response.data.user;
}

export async function uploadAvatar(file: File): Promise<AuthUser> {
  const response = await apiUpload<UpdateProfileResponse>("/api/auth/avatar", file, {
    fieldName: "avatar",
    skipWorkspaceHeader: true,
  });
  return response.data.user;
}

export async function removeAvatar(): Promise<AuthUser> {
  const response = await apiRequest<UpdateProfileResponse>("/api/auth/avatar", {
    method: "DELETE",
  });
  return response.data.user;
}
