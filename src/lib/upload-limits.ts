/** Matches server limits in `task-upload.ts` and `project-upload.ts`. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_MB = 10;

export function isUploadFileTooLarge(file: File) {
  return file.size > MAX_UPLOAD_BYTES;
}
