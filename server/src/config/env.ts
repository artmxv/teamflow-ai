import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().url().default("http://localhost:8080"),
  APP_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
});

const parsed = envSchema.parse(process.env);

/** Public frontend origin for invite links (defaults to CORS_ORIGIN). */
export const appUrl = (parsed.APP_URL ?? parsed.CORS_ORIGIN).replace(/\/$/, "");

export const env = { ...parsed, APP_URL: appUrl };
