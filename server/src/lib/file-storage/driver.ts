import { env } from "../../config/env.js";

export function isSupabaseConfigured() {
  return Boolean(
    env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.SUPABASE_STORAGE_BUCKET,
  );
}

export function isSupabaseStorageEnabled() {
  return env.FILE_STORAGE_DRIVER === "supabase";
}

/** Project documents and task attachments always upload to Supabase when configured. */
export function shouldUseSupabaseForProjectTaskUploads() {
  return isSupabaseStorageEnabled() || isSupabaseConfigured();
}

export function shouldBufferUploadsInMemory() {
  return isSupabaseStorageEnabled();
}
