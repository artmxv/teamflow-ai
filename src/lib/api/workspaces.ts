import { apiRequest } from "@/lib/api/client";
import type { BillingPlanId } from "@/lib/api/billing";
import type { AuthWorkspace } from "@/lib/api/auth";

export type WorkspaceItem = {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  role: AuthWorkspace["role"];
  plan: BillingPlanId;
  teamSize: string | null;
  createdAt: string;
};

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  teamSize?: string;
};

type WorkspacesListResponse = {
  data: WorkspaceItem[];
};

type WorkspaceItemResponse = {
  data: WorkspaceItem;
};

export async function fetchWorkspaces(): Promise<WorkspaceItem[]> {
  const response = await apiRequest<WorkspacesListResponse>("/api/workspaces");
  return response.data;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceItem> {
  const response = await apiRequest<WorkspaceItemResponse>("/api/workspaces", {
    method: "POST",
    body: input,
  });
  return response.data;
}

export async function switchWorkspace(workspaceId: string): Promise<WorkspaceItem> {
  const response = await apiRequest<WorkspaceItemResponse>("/api/workspaces/current", {
    method: "PATCH",
    body: { workspaceId },
  });
  return response.data;
}

export type DeleteWorkspaceResult = {
  deletedWorkspaceId: string;
  fallbackWorkspace: WorkspaceItem | null;
};

type DeleteWorkspaceResponse = {
  data: DeleteWorkspaceResult;
};

export async function deleteWorkspace(workspaceId: string): Promise<DeleteWorkspaceResult> {
  const response = await apiRequest<DeleteWorkspaceResponse>(`/api/workspaces/${workspaceId}`, {
    method: "DELETE",
  });
  return response.data;
}
