import { createClient } from "@supabase/supabase-js";

import { env } from "../../config/env.js";

let client: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!client) {
    client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}

function bucket() {
  return env.SUPABASE_STORAGE_BUCKET!;
}

/** Short-lived signed URL TTL for private file downloads (seconds). */
export const SIGNED_URL_TTL_SECONDS = 120;

export function resolveSupabaseObjectKeyFromPublicUrl(
  avatarUrl: string | null | undefined,
): string | null {
  if (!avatarUrl) {
    return null;
  }

  const trimmed = avatarUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const marker = `/storage/v1/object/public/${bucket()}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) {
      return null;
    }
    const key = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    return key || null;
  } catch {
    return null;
  }
}

export async function uploadToSupabase(input: {
  objectKey: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(bucket()).upload(input.objectKey, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Could not upload file to Supabase Storage: ${error.message}`);
  }

  return input.objectKey;
}

function isStorageNotFoundError(error: { message?: string; statusCode?: string | number }) {
  const code = String(error.statusCode ?? "");
  const message = (error.message ?? "").toLowerCase();
  if (code === "404") {
    return true;
  }
  // Supabase Storage often returns 400 with "Object not found" for missing keys.
  return message.includes("not found") || message.includes("does not exist");
}

/**
 * Distinguish missing objects from transient storage errors.
 * Used before clearing stale avatarUrl rows (never wipe on unknown/error).
 */
export async function getSupabaseObjectAvailability(
  objectKey: string,
): Promise<"exists" | "missing" | "error"> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket())
    .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);

  if (data?.signedUrl) {
    return "exists";
  }

  if (error && isStorageNotFoundError(error)) {
    return "missing";
  }

  return "error";
}

export async function createSignedDownloadUrl(
  objectKey: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket())
    .createSignedUrl(objectKey, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export type SupabaseObjectDownloadResult =
  | {
      ok: true;
      body: ReadableStream<Uint8Array>;
      contentLength: number | null;
      contentType: string | null;
    }
  | { ok: false; reason: "not_found" | "error" };

/** Fetch object bytes via a short-lived signed URL (server-side only; never expose URL to clients). */
export async function fetchObjectContent(
  objectKey: string,
): Promise<SupabaseObjectDownloadResult> {
  const signedUrl = await createSignedDownloadUrl(objectKey);
  if (!signedUrl) {
    return { ok: false, reason: "not_found" };
  }

  let response: Response;
  try {
    response = await fetch(signedUrl);
  } catch {
    return { ok: false, reason: "error" };
  }

  if (response.status === 404) {
    return { ok: false, reason: "not_found" };
  }

  if (!response.ok || !response.body) {
    return { ok: false, reason: "error" };
  }

  const rawLength = response.headers.get("content-length");
  const parsedLength = rawLength ? Number.parseInt(rawLength, 10) : Number.NaN;

  return {
    ok: true,
    body: response.body,
    contentLength: Number.isFinite(parsedLength) ? parsedLength : null,
    contentType: response.headers.get("content-type"),
  };
}

export async function deleteFromSupabase(input: { objectKey: string }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(bucket()).remove([input.objectKey]);
  if (error) {
    console.warn("[file-storage] Could not delete Supabase object:", error.message);
  }
}
