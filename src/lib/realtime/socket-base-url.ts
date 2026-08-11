/**
 * Resolve the Socket.IO server origin.
 *
 * HTTP API can be same-origin via Vercel `/api` rewrites, but WebSockets cannot.
 * Production therefore needs an explicit backend origin (`VITE_SOCKET_URL`).
 *
 * Returns `null` when production would otherwise fall back to the Vercel host
 * (which causes failed `wss://…vercel.app/socket.io` connections). Callers should
 * soft-fail: leave chat on HTTP polling, do not start a reconnect storm.
 */
export function resolveSocketBaseUrl(options: {
  configuredSocketUrl?: string | null;
  apiBaseUrl: string;
  isDev: boolean;
}): string | null {
  const configured = options.configuredSocketUrl?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const apiBase = options.apiBaseUrl.trim().replace(/\/+$/, "");

  // Local Vite: sockets share the API origin (usually http://localhost:4000).
  if (options.isDev) {
    return apiBase || "http://localhost:4000";
  }

  // Absolute API override (e.g. direct Render URL) can also host Socket.IO.
  if (apiBase) {
    return apiBase;
  }

  // Same-origin production API: Vercel rewrites cover /api/* only, not /socket.io.
  return null;
}
