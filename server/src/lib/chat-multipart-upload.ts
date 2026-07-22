export type MultipartConversationAccess = "ok" | "not_found";

export async function runMultipartUploadIfAuthorized<T>(input: {
  validateAccess: () => Promise<MultipartConversationAccess>;
  parseUpload: () => Promise<T>;
}): Promise<
  | { status: "not_found" }
  | { status: "uploaded"; result: T }
> {
  const access = await input.validateAccess();
  if (access === "not_found") {
    return { status: "not_found" };
  }

  const result = await input.parseUpload();
  return { status: "uploaded", result };
}
