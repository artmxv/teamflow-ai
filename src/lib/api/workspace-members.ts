import { apiRequest } from "./client";
import type { WorkspaceRole } from "./auth";
import type { ProjectApiStatus } from "./projects";
import type { TaskApiPriority, TaskApiStatus } from "./tasks";

export interface WorkspaceMemberItem {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface MemberProfileContact {
  phone: string | null;
  position: string | null;
  location: string | null;
}

export interface MemberProfileProject {
  id: string;
  name: string;
  status: ProjectApiStatus;
}

export interface MemberProfileTask {
  id: string;
  key: string;
  title: string;
  status: TaskApiStatus;
  priority: TaskApiPriority;
  projectId: string;
  projectName: string;
  dueDate: string | null;
}

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: string;
  contact: MemberProfileContact;
  projects: MemberProfileProject[];
  tasks: MemberProfileTask[];
}

export async function fetchWorkspaceMembers() {
  const response = await apiRequest<{ data: WorkspaceMemberItem[] }>("/api/workspace/members");
  return response.data;
}

export async function fetchWorkspaceMemberProfile(memberId: string) {
  const response = await apiRequest<{ data: MemberProfile }>(
    `/api/workspace/members/${memberId}/profile`,
  );
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
