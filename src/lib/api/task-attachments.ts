import { getAuthToken } from "@/lib/auth/token";
import { API_BASE_URL, apiRequest } from "./client";

export interface TaskAttachmentUploader {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface TaskAttachmentApiItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  downloadUrl: string;
  createdAt: string;
  uploader: TaskAttachmentUploader;
}

export async function fetchTaskAttachments(taskId: string) {
  const response = await apiRequest<{ data: TaskAttachmentApiItem[] }>(
    `/api/tasks/${taskId}/attachments`,
  );
  return response.data;
}

export async function uploadTaskAttachment(taskId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/attachments`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Upload failed with status ${response.status}`);
  }

  const json = (await response.json()) as { data: TaskAttachmentApiItem };
  return json.data;
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string) {
  const response = await apiRequest<{ data: { id: string } }>(
    `/api/tasks/${taskId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
    },
  );
  return response.data;
}

export function resolveTaskAttachmentUrl(downloadUrl: string) {
  if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) {
    return downloadUrl;
  }
  return `${API_BASE_URL}${downloadUrl}`;
}

export async function openTaskAttachment(attachment: TaskAttachmentApiItem) {
  const blob = await fetchTaskAttachmentBlob(attachment);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadTaskAttachmentFile(attachment: TaskAttachmentApiItem) {
  const blob = await fetchTaskAttachmentBlob(attachment);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = attachment.originalName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const imageAttachmentMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function isImageAttachment(attachment: Pick<TaskAttachmentApiItem, "mimeType">) {
  return imageAttachmentMimeTypes.has(attachment.mimeType.toLowerCase());
}

export function attachmentExtensionFromName(name: string) {
  const ext = name.includes(".") ? name.split(".").pop() : null;
  return ext ? ext.toUpperCase().slice(0, 4) : "FILE";
}

export function getAttachmentFileTypeBadge(originalName: string, mimeType: string) {
  const mime = mimeType.toLowerCase();

  if (mime === "application/pdf") return "PDF";
  if (mime === "application/msword") return "DOC";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "DOCX";
  }
  if (mime === "application/vnd.ms-powerpoint") return "PPT";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return "PPTX";
  }
  if (mime === "image/png") return "PNG";
  if (mime === "image/webp") return "WEBP";
  if (mime === "image/jpeg" || mime === "image/jpg") return "JPG";

  return attachmentExtensionFromName(originalName);
}

export async function fetchTaskAttachmentBlob(attachment: TaskAttachmentApiItem): Promise<Blob> {
  const url = resolveTaskAttachmentUrl(attachment.downloadUrl || attachment.url);
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error("Could not load attachment");
  }

  return response.blob();
}
