import { API_BASE_URL, ApiError, apiRequest, apiUpload, buildAuthHeaders } from "./client";

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

export function resolveProjectDocumentUrl(downloadUrl: string) {
  if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) {
    return downloadUrl;
  }
  return `${API_BASE_URL}${downloadUrl}`;
}

export async function openProjectDocument(document: ProjectDocumentApiItem) {
  const blob = await fetchProjectDocumentBlob(document);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadProjectDocumentFile(document: ProjectDocumentApiItem) {
  const blob = await fetchProjectDocumentBlob(document);
  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = objectUrl;
  link.download = document.originalName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function formatDocumentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const imageDocumentMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function isImageProjectDocument(document: Pick<ProjectDocumentApiItem, "mimeType">) {
  return imageDocumentMimeTypes.has(document.mimeType.toLowerCase());
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
  const url = resolveProjectDocumentUrl(path);
  const response = await fetch(url, { headers: buildAuthHeaders(), credentials: "include" });
  if (!response.ok) {
    throw new Error("Could not load document");
  }

  return response.blob();
}
