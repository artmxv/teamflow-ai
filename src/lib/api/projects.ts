import { API_BASE_URL, apiRequest } from "./client";

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

export async function fetchProjects() {
  const response = await apiRequest<ProjectsApiResponse>("/api/projects");
  return response.data;
}

export async function createProject(input: CreateProjectInput) {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : input.dueDate,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `API request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { data: ProjectApiItem };
  return body.data;
}
