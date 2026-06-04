import { apiRequest } from "./client";
import type { WorkspaceRole } from "./auth";

export type WorkspaceInvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface WorkspaceInvitationItem {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptUrl: string;
}

export interface CreateWorkspaceInvitationResult {
  invitation: WorkspaceInvitationItem;
  deliveryMode: string;
  acceptUrl: string;
}

export interface InvitationPreview {
  id: string;
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  expiresAt: string;
  isExpired: boolean;
  canAccept: boolean;
  emailMatchesCurrentUser: boolean | null;
}

export async function fetchWorkspaceInvitations() {
  const response = await apiRequest<{ data: WorkspaceInvitationItem[] }>(
    "/api/workspace/invitations",
  );
  return response.data;
}

export async function createWorkspaceInvitation(input: {
  email: string;
  role: "ADMIN" | "MEMBER";
}) {
  const response = await apiRequest<{ data: CreateWorkspaceInvitationResult }>(
    "/api/workspace/invitations",
    { method: "POST", body: input },
  );
  return response.data;
}

export async function revokeWorkspaceInvitation(id: string) {
  const response = await apiRequest<{ data: WorkspaceInvitationItem }>(
    `/api/workspace/invitations/${id}`,
    { method: "DELETE" },
  );
  return response.data;
}

export async function fetchInvitationPreview(token: string) {
  const response = await apiRequest<{ data: InvitationPreview }>(
    `/api/invitations/${encodeURIComponent(token)}`,
    { skipAuth: false },
  );
  return response.data;
}

export async function acceptWorkspaceInvitation(token: string) {
  const response = await apiRequest<{ data: { workspaceId: string; role: WorkspaceRole } }>(
    `/api/invitations/${encodeURIComponent(token)}/accept`,
    { method: "POST" },
  );
  return response.data;
}
