import { apiRequest } from "./client";
import type { ProjectApiStatus } from "./projects";

export type TaskApiStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type TaskApiPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskApiItem {
  id: string;
  key: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskApiStatus;
  priority: TaskApiPriority;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    status: ProjectApiStatus;
  };
  assignee: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
  commentsCount: number;
  checklistTotal: number;
  checklistDone: number;
  attachmentsCount: number;
}

export interface TasksApiResponse {
  data: TaskApiItem[];
}

export async function fetchTasks() {
  const response = await apiRequest<TasksApiResponse>("/api/tasks");
  return response.data;
}
