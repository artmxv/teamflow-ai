import { ApiError, apiRequest, apiUpload } from "./client";
import { downloadBlobAsFile, fetchAuthenticatedBlob } from "./authenticated-blob";
import {
  acquireAuthenticatedBlobUrl,
  getAuthenticatedBlobObjectUrl,
  invalidateAuthenticatedBlobUrl,
  releaseAuthenticatedBlobUrl,
} from "./authenticated-blob-cache";
import { assertBrowserOnline } from "@/lib/api-error";
import { isPreviewableImageMimeType } from "@/lib/files/image-preview";

export interface ProjectDocumentUploader {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface ProjectDocumentApiItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  downloadUrl: string;
  createdAt: string;
  uploader: ProjectDocumentUploader;
}

export async function fetchProjectDocuments(projectId: string) {
  const response = await apiRequest<{ data: ProjectDocumentApiItem[] }>(
    `/api/projects/${projectId}/documents`,
  );
  return response.data;
}

export async function uploadProjectDocument(projectId: string, file: File) {
  if (!projectId.trim()) {
    throw new ApiError("Project is required", 400);
  }

  const response = await apiUpload<{ data: ProjectDocumentApiItem }>(
    `/api/projects/${projectId}/documents`,
    file,
  );
  return response.data;
}

export async function deleteProjectDocument(projectId: string, documentId: string) {
  const response = await apiRequest<{ data: { id: string } }>(
    `/api/projects/${projectId}/documents/${documentId}`,
    {
      method: "DELETE",
    },
  );
  return response.data;
}

/**
 * Opens a non-image project document in a new tab.
 * Opens a blank tab synchronously (user gesture), then points it at the blob URL
 * after the authenticated download finishes — so the browser does not block the popup.
 * If the popup is blocked after a successful fetch, the blob stays cached for Retry/Open.
 */
export async function openProjectDocument(document: ProjectDocumentApiItem) {
  assertBrowserOnline();
  const path = document.downloadUrl || document.url;

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
      fetchProjectDocumentBlob(document),
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

export function invalidateProjectDocumentBlobCache(
  document: Pick<ProjectDocumentApiItem, "downloadUrl" | "url">,
) {
  invalidateAuthenticatedBlobUrl(document.downloadUrl || document.url);
}

export async function downloadProjectDocumentFile(document: ProjectDocumentApiItem) {
  assertBrowserOnline();
  const blob = await fetchProjectDocumentBlob(document);
  downloadBlobAsFile(blob, document.originalName);
}

export function formatDocumentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageProjectDocument(document: Pick<ProjectDocumentApiItem, "mimeType">) {
  return isPreviewableImageMimeType(document.mimeType);
}

function documentExtensionFromName(name: string) {
  const ext = name.includes(".") ? name.split(".").pop() : null;
  return ext ? ext.toUpperCase().slice(0, 4) : "FILE";
}

export function getProjectDocumentFileTypeBadge(originalName: string, mimeType: string) {
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

  return documentExtensionFromName(originalName);
}

export async function fetchProjectDocumentBlob(document: ProjectDocumentApiItem): Promise<Blob> {
  const path = document.downloadUrl || document.url;
  if (!path) {
    throw new Error("Could not load document");
  }
  return fetchAuthenticatedBlob(path);
}
