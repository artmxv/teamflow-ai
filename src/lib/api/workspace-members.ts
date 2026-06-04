import { apiRequest } from "./client";
import type { WorkspaceRole } from "./auth";

export interface WorkspaceMemberItem {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export async function fetchWorkspaceMembers() {
  const response = await apiRequest<{ data: WorkspaceMemberItem[] }>("/api/workspace/members");
  return response.data;
}

export async function updateWorkspaceMemberRole(
  memberId: string,
  role: Extract<WorkspaceRole, "ADMIN" | "MEMBER">,
) {
  const response = await apiRequest<{ data: WorkspaceMemberItem }>(
    `/api/workspace/members/${memberId}`,
    {
      method: "PATCH",
      body: { role },
    },
  );
  return response.data;
}

export async function removeWorkspaceMember(memberId: string) {
  const response = await apiRequest<{ data: { id: string } }>(
    `/api/workspace/members/${memberId}`,
    {
      method: "DELETE",
    },
  );
  return response.data;
}
