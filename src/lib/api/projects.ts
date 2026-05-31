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

export async function fetchProjects() {
  const response = await apiRequest<ProjectsApiResponse>("/api/projects");
  return response.data;
}
