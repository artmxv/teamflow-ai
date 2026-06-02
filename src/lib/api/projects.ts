import { apiRequest } from "./client";

export type ProjectApiStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

export interface ProjectApiItem {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: ProjectApiStatus;
  color: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  tasks: {
    id: string;
    status: string;
  }[];
  totalTasks: number;
  openTasks: number;
  progress: number;
}

export interface ProjectsApiResponse {
  data: ProjectApiItem[];
}

export interface CreateProjectInput {
  workspaceId: string;
  name: string;
  description?: string;
  status?: ProjectApiStatus;
  color?: string;
  dueDate?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectApiStatus;
  dueDate?: string | null;
  color?: string | null;
}

export async function fetchProjects() {
  const response = await apiRequest<ProjectsApiResponse>("/api/projects");
  return response.data;
}

export async function createProject(input: CreateProjectInput) {
  const response = await apiRequest<{ data: ProjectApiItem }>("/api/projects", {
    method: "POST",
    body: {
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : input.dueDate,
    },
  });

  return response.data;
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  const response = await apiRequest<{ data: ProjectApiItem }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: {
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : input.dueDate,
    },
  });
  return response.data;
}

export async function deleteProject(projectId: string) {
  const response = await apiRequest<{ data: { id: string } }>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
  return response.data;
}
