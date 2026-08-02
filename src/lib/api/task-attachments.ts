import { API_BASE_URL, ApiError, apiRequest, apiUpload } from "./client";
import { downloadBlobAsFile, fetchAuthenticatedBlob } from "./authenticated-blob";
import {
  acquireAuthenticatedBlobUrl,
  getAuthenticatedBlobObjectUrl,
  invalidateAuthenticatedBlobUrl,
  releaseAuthenticatedBlobUrl,
} from "./authenticated-blob-cache";
import { assertBrowserOnline } from "@/lib/api-error";
import { isPreviewableImageMimeType } from "@/lib/files/image-preview";

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
  if (!taskId.trim()) {
    throw new ApiError("Task is required", 400);
  }

  const response = await apiUpload<{ data: TaskAttachmentApiItem }>(
    `/api/tasks/${taskId}/attachments`,
    file,
  );
  return response.data;
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

/**
 * Opens a non-image attachment in a new tab.
 * Opens a blank tab synchronously (user gesture), then points it at the blob URL
 * after the authenticated download finishes — so the browser does not block the popup.
 * If the popup is blocked after a successful fetch, the blob stays cached for Retry/Open.
 */
export async function openTaskAttachment(attachment: TaskAttachmentApiItem) {
  assertBrowserOnline();
  const path = attachment.downloadUrl || attachment.url;

  const cachedUrl = getAuthenticatedBlobObjectUrl(path);
  if (cachedUrl) {
    const opened = window.open(cachedUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Blob remains cached; caller can leave Open enabled for another click.
      return;
    }
    return;
  }

  // Must stay synchronous with the click; do not use noopener (need to set location).
  const tab = window.open("about:blank", "_blank");

  try {
    const objectUrl = await acquireAuthenticatedBlobUrl(path, () =>
      fetchTaskAttachmentBlob(attachment),
    );

    if (tab && !tab.closed) {
      tab.location.href = objectUrl;
      releaseAuthenticatedBlobUrl(path);
      return;
    }

    // Popup blocked or closed: keep object URL in cache for the next Open click.
    releaseAuthenticatedBlobUrl(path);
  } catch (error) {
    if (tab && !tab.closed) {
      tab.close();
    }
    throw error;
  }
}

export function invalidateTaskAttachmentBlobCache(
  attachment: Pick<TaskAttachmentApiItem, "downloadUrl" | "url">,
) {
  invalidateAuthenticatedBlobUrl(attachment.downloadUrl || attachment.url);
}

export async function downloadTaskAttachmentFile(attachment: TaskAttachmentApiItem) {
  assertBrowserOnline();
  const blob = await fetchTaskAttachmentBlob(attachment);
  downloadBlobAsFile(blob, attachment.originalName);
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageAttachment(attachment: Pick<TaskAttachmentApiItem, "mimeType">) {
  return isPreviewableImageMimeType(attachment.mimeType);
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
  const path = attachment.downloadUrl || attachment.url;
  return fetchAuthenticatedBlob(path);
}
