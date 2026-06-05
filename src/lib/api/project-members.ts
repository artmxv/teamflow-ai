import { apiRequest } from "./client";

export interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
}

export interface ProjectMemberApiItem {
  id: string;
  role: string | null;
  createdAt: string;
  user: ProjectMemberUser;
}

export interface AvailableProjectMember {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarUrl: string | null;
}

export async function fetchProjectMembers(projectId: string) {
  const response = await apiRequest<{ data: ProjectMemberApiItem[] }>(
    `/api/projects/${projectId}/members`,
  );
  return response.data;
}

export async function fetchAvailableProjectMembers(projectId: string) {
  const response = await apiRequest<{ data: AvailableProjectMember[] }>(
    `/api/projects/${projectId}/available-members`,
  );
  return response.data;
}

export async function addProjectMember(projectId: string, userId: string) {
  const response = await apiRequest<{ data: ProjectMemberApiItem }>(
    `/api/projects/${projectId}/members`,
    {
      method: "POST",
      body: { userId },
    },
  );
  return response.data;
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const response = await apiRequest<{ data: { id: string } }>(
    `/api/projects/${projectId}/members/${memberId}`,
    {
      method: "DELETE",
    },
  );
  return response.data;
}
