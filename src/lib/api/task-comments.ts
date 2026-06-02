import { apiRequest } from "./client";

export interface TaskCommentAuthor {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface TaskCommentApiItem {
  id: string;
  body: string;
  createdAt: string;
  author: TaskCommentAuthor;
}

export async function fetchTaskComments(taskId: string) {
  const response = await apiRequest<{ data: TaskCommentApiItem[] }>(
    `/api/tasks/${taskId}/comments`,
  );
  return response.data;
}

export async function createTaskComment(taskId: string, body: string) {
  const response = await apiRequest<{ data: TaskCommentApiItem }>(`/api/tasks/${taskId}/comments`, {
    method: "POST",
    body: { body },
  });
  return response.data;
}

export async function updateTaskComment(taskId: string, commentId: string, body: string) {
  const response = await apiRequest<{ data: TaskCommentApiItem }>(
    `/api/tasks/${taskId}/comments/${commentId}`,
    {
      method: "PATCH",
      body: { body },
    },
  );
  return response.data;
}

export async function deleteTaskComment(taskId: string, commentId: string) {
  const response = await apiRequest<{ data: { id: string } }>(
    `/api/tasks/${taskId}/comments/${commentId}`,
    {
      method: "DELETE",
    },
  );
  return response.data;
}
