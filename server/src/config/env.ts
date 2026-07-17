import "dotenv/config";

import { z } from "zod";

/** Dev-only JWT default — rejected when NODE_ENV=production. */
export const DEV_JWT_SECRET = "dev-jwt-secret-change-in-production";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173,http://localhost:8080"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_REDIRECT_URI: z.preprocess(emptyToUndefined, z.string().url().optional()),
  FILE_STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  SUPABASE_STORAGE_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
  TASK_REMINDER_CRON_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
});

const parsed = envSchema.parse(process.env);

/** Browser origins allowed by CORS (comma-separated). First entry is the default APP_URL fallback. */
export const corsOrigins = parsed.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

for (const origin of corsOrigins) {
  try {
    new URL(origin);
  } catch {
    throw new Error(`CORS_ORIGIN contains an invalid URL: ${origin}`);
  }
}

if (corsOrigins.length === 0) {
  throw new Error("CORS_ORIGIN must include at least one origin.");
}

/** Public frontend origin for invite links (defaults to first CORS origin in dev). */
export const appUrl = (parsed.APP_URL ?? corsOrigins[0] ?? "http://localhost:5173").replace(
  /\/$/,
  "",
);

function containsLocalhost(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

function validateGoogleOAuthConfig(): void {
  const id = parsed.GOOGLE_CLIENT_ID?.trim() ?? "";
  const secret = parsed.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirect = parsed.GOOGLE_REDIRECT_URI?.trim() ?? "";

  const setCount = [id, secret, redirect].filter(Boolean).length;
  if (setCount === 0 || setCount === 3) {
    return;
  }

  throw new Error(
    "Google OAuth is partially configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI together, or leave all three empty.",
  );
}

function validateEmailConfig(): void {
  if (parsed.EMAIL_PROVIDER !== "resend") {
    return;
  }

  if (!parsed.RESEND_API_KEY?.trim()) {
    throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY.");
  }

  if (!parsed.EMAIL_FROM?.trim()) {
    throw new Error("EMAIL_PROVIDER=resend requires EMAIL_FROM.");
  }
}

function validateFileStorageConfig(): void {
  if (parsed.FILE_STORAGE_DRIVER !== "supabase") {
    return;
  }

  const missing: string[] = [];
  if (!parsed.SUPABASE_URL?.trim()) {
    missing.push("SUPABASE_URL");
  }
  if (!parsed.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!parsed.SUPABASE_STORAGE_BUCKET?.trim()) {
    missing.push("SUPABASE_STORAGE_BUCKET");
  }

  if (missing.length > 0) {
    throw new Error(
      `FILE_STORAGE_DRIVER=supabase requires ${missing.join(", ")}. Leave FILE_STORAGE_DRIVER=local for disk uploads.`,
    );
  }
}

function validateProductionConfig(): void {
  if (parsed.NODE_ENV !== "production") {
    return;
  }

  if (parsed.JWT_SECRET === DEV_JWT_SECRET) {
    throw new Error(
      `JWT_SECRET must not use the dev default "${DEV_JWT_SECRET}" in production. Set a long random secret.`,
    );
  }

  if (!parsed.APP_URL?.trim()) {
    throw new Error(
      "APP_URL is required in production (deployed frontend URL for invite links and auth redirects).",
    );
  }

  if (containsLocalhost(parsed.APP_URL)) {
    throw new Error("APP_URL must not use localhost or 127.0.0.1 in production.");
  }

  for (const origin of corsOrigins) {
    if (containsLocalhost(origin)) {
      throw new Error("CORS_ORIGIN must not include localhost or 127.0.0.1 in production.");
    }
  }
}

function normalizeSupabaseUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  return url
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/$/, "");
}

validateGoogleOAuthConfig();
validateEmailConfig();
validateFileStorageConfig();
validateProductionConfig();

export const env = {
  ...parsed,
  APP_URL: appUrl,
  CORS_ORIGINS: corsOrigins,
  GOOGLE_CLIENT_ID: parsed.GOOGLE_CLIENT_ID?.trim() || undefined,
  GOOGLE_CLIENT_SECRET: parsed.GOOGLE_CLIENT_SECRET?.trim() || undefined,
  GOOGLE_REDIRECT_URI: parsed.GOOGLE_REDIRECT_URI?.trim() || undefined,
  EMAIL_FROM: parsed.EMAIL_FROM?.trim() || undefined,
  RESEND_API_KEY: parsed.RESEND_API_KEY?.trim() || undefined,
  SUPABASE_URL: normalizeSupabaseUrl(parsed.SUPABASE_URL),
  SUPABASE_SERVICE_ROLE_KEY: parsed.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
  SUPABASE_STORAGE_BUCKET: parsed.SUPABASE_STORAGE_BUCKET?.trim() || undefined,
  TASK_REMINDER_CRON_SECRET: parsed.TASK_REMINDER_CRON_SECRET?.trim() || undefined,
};
