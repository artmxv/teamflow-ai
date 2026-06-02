import { apiRequest } from "./client";
import type { Priority, TaskStatus } from "@/lib/mock-data";
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

export const taskStatusToApi = {
  backlog: "BACKLOG",
  todo: "TODO",
  in_progress: "IN_PROGRESS",
  review: "REVIEW",
  done: "DONE",
} as const satisfies Record<TaskStatus, TaskApiStatus>;

export const taskPriorityToApi = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
} as const satisfies Record<Priority, TaskApiPriority>;

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskApiStatus;
  priority?: TaskApiPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export async function fetchTasks() {
  const response = await apiRequest<TasksApiResponse>("/api/tasks");
  return response.data;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskApiStatus;
  priority?: TaskApiPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export async function createTask(input: CreateTaskInput) {
  const response = await apiRequest<{ data: TaskApiItem }>("/api/tasks", {
    method: "POST",
    body: {
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : input.dueDate,
    },
  });
  return response.data;
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const response = await apiRequest<{ data: TaskApiItem }>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: {
      ...input,
      dueDate:
        input.dueDate !== undefined
          ? input.dueDate
            ? new Date(input.dueDate).toISOString()
            : null
          : undefined,
    },
  });
  return response.data;
}

export async function deleteTask(id: string) {
  const response = await apiRequest<{ data: { id: string } }>(`/api/tasks/${id}`, {
    method: "DELETE",
  });
  return response.data;
}
