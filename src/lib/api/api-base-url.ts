const LOCAL_API_URL = "http://localhost:4000";

/**
 * Resolve the browser API origin.
 * - Local Vite dev → http://localhost:4000
 * - Production/preview → same-origin "" (Vercel rewrites /api/* to Render)
 * - Optional VITE_API_URL overrides both (special/local setups)
 *
 * Paths always start with `/api/...`, so the base must NOT end with `/api`
 * (otherwise requests become `/api/api/...`).
 */
export function resolveApiBaseUrl(options: {
  configuredUrl?: string | null;
  isDev: boolean;
}): string {
  const configured = options.configuredUrl?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (options.isDev) {
    return LOCAL_API_URL;
  }
  return "";
}
