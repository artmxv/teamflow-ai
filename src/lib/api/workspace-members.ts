import { apiRequest } from "./client";
import type { WorkspaceRole } from "./auth";

export interface WorkspaceMemberItem {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: WorkspaceRole;
}

export async function fetchWorkspaceMembers() {
  const response = await apiRequest<{ data: WorkspaceMemberItem[] }>("/api/workspace/members");
  return response.data;
}
