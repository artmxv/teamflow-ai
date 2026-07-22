import { API_BASE_URL, ApiError, buildAuthHeaders } from "./client";

export function resolveApiUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${API_BASE_URL}${pathOrUrl}`;
}

export async function fetchAuthenticatedBlob(pathOrUrl: string): Promise<Blob> {
  const url = resolveApiUrl(pathOrUrl);
  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? "Could not load file", response.status);
  }

  return response.blob();
}

export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
