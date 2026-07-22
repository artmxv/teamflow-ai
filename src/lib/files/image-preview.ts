const imagePreviewMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export function isPreviewableImageMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  return imagePreviewMimeTypes.has(mimeType.toLowerCase());
}
