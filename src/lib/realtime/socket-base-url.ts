/**
 * Resolve the Socket.IO server origin.
 *
 * - Local Vite: API origin (usually http://localhost:4000), optional VITE_SOCKET_URL
 * - Production same-origin (empty API base via Vercel rewrites): "" so the client
 *   uses the current page origin + /socket.io (proxied by vercel.json)
 * - Production with absolute API override: that origin (or VITE_SOCKET_URL)
 *
 * When the HTTP API is same-origin, VITE_SOCKET_URL is intentionally ignored so
 * the browser never opens a direct connection to onrender.com for realtime.
 */
export function resolveSocketBaseUrl(options: {
  configuredSocketUrl?: string | null;
  apiBaseUrl: string;
  isDev: boolean;
}): string {
  const configured = options.configuredSocketUrl?.trim().replace(/\/+$/, "") ?? "";
  const apiBase = options.apiBaseUrl.trim().replace(/\/+$/, "");

  if (options.isDev) {
    return configured || apiBase || "http://localhost:4000";
  }

  // Same-origin production: Vercel rewrites /api and /socket.io to Render.
  if (!apiBase) {
    return "";
  }

  // Absolute API origin (special setups): prefer explicit socket URL, else API.
  return configured || apiBase;
}

/**
 * Socket.IO client transport policy.
 *
 * Production same-origin goes through Vercel HTTP rewrites, which are reliable
 * for Engine.IO polling but not for a browser WebSocket upgrade to Render.
 * Local / absolute-backend setups keep websocket + polling as usual.
 */
export function resolveSocketTransportOptions(options: {
  isDev: boolean;
  socketBaseUrl: string;
}): {
  transports: ("polling" | "websocket")[];
  upgrade: boolean;
} {
  const sameOriginProduction = !options.isDev && options.socketBaseUrl === "";
  if (sameOriginProduction) {
    return {
      transports: ["polling"],
      upgrade: false,
    };
  }

  return {
    transports: ["websocket", "polling"],
    upgrade: true,
  };
}
