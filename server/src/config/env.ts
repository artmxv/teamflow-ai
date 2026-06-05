import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().url().default("http://localhost:8080"),
  APP_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

const parsed = envSchema.parse(process.env);

/** Browser origins allowed by CORS (comma-separated). First entry is the default APP_URL fallback. */
export const corsOrigins = parsed.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

/** Public frontend origin for invite links (defaults to first CORS origin). */
export const appUrl = (parsed.APP_URL ?? corsOrigins[0] ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

export const env = {
  ...parsed,
  APP_URL: appUrl,
  CORS_ORIGINS: corsOrigins,
  GOOGLE_CLIENT_ID: parsed.GOOGLE_CLIENT_ID?.trim() || undefined,
  GOOGLE_CLIENT_SECRET: parsed.GOOGLE_CLIENT_SECRET?.trim() || undefined,
  GOOGLE_REDIRECT_URI: parsed.GOOGLE_REDIRECT_URI?.trim() || undefined,
};
