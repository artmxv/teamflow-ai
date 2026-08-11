import { io, type Socket } from "socket.io-client";

import { API_BASE_URL } from "@/lib/api/client";
import { getAuthToken } from "@/lib/auth/token";
import { clearChatPresence } from "./chat-presence-state";
import { setChatSocketStatus, type ChatSocketStatus } from "./chat-socket-state";
import { resolveSocketBaseUrl } from "./socket-base-url";

export type TeamFlowSocket = Socket;

type ConnectOptions = {
  workspaceId: string;
};

let socket: TeamFlowSocket | null = null;
let activeWorkspaceId: string | null = null;
let missingSocketUrlWarned = false;

/** Socket.IO origin: VITE_SOCKET_URL in production, API origin in local dev. */
export const SOCKET_BASE_URL = resolveSocketBaseUrl({
  configuredSocketUrl: import.meta.env.VITE_SOCKET_URL,
  apiBaseUrl: API_BASE_URL,
  isDev: import.meta.env.DEV,
});

function mapStatusFromSocket(instance: TeamFlowSocket): ChatSocketStatus {
  if (instance.connected) {
    return "connected";
  }
  if (instance.active) {
    return instance.disconnected ? "reconnecting" : "connecting";
  }
  return "disconnected";
}

function bindLifecycle(instance: TeamFlowSocket) {
  instance.on("connect", () => {
    setChatSocketStatus("connected");
  });

  instance.on("disconnect", () => {
    clearChatPresence();
    setChatSocketStatus(instance.active ? "reconnecting" : "disconnected");
  });

  instance.io.on("reconnect_attempt", () => {
    setChatSocketStatus("reconnecting");
  });

  instance.io.on("reconnect", () => {
    setChatSocketStatus("connected");
  });

  instance.io.on("reconnect_failed", () => {
    clearChatPresence();
    setChatSocketStatus("disconnected");
  });

  instance.on("connect_error", () => {
    setChatSocketStatus(instance.active ? "reconnecting" : "disconnected");
  });
}

/**
 * Browser-only Socket.IO singleton.
 * Auth uses the same JWT as REST (handshake.auth.token). Cookies alone are not enough
 * because the app stores the token in localStorage, not an httpOnly cookie.
 *
 * Soft-fails when SOCKET_BASE_URL is missing (same-origin Vercel without VITE_SOCKET_URL):
 * chat keeps working over HTTP polling; navigation/bootstrap is unaffected.
 */
export function connectChatSocket(options: ConnectOptions): TeamFlowSocket | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = getAuthToken();
  if (!token || !options.workspaceId) {
    disconnectChatSocket();
    return null;
  }

  if (!SOCKET_BASE_URL) {
    if (import.meta.env.PROD && !missingSocketUrlWarned) {
      missingSocketUrlWarned = true;
      console.warn(
        "[TeamFlow] VITE_SOCKET_URL is not set. Realtime chat is disabled; HTTP chat still works. Set VITE_SOCKET_URL to the backend origin (e.g. https://teamflow-ai-api.onrender.com) at build time.",
      );
    }
    setChatSocketStatus("disconnected");
    return null;
  }

  if (socket && activeWorkspaceId === options.workspaceId && socket.connected) {
    return socket;
  }

  if (socket && activeWorkspaceId !== options.workspaceId) {
    disconnectChatSocket();
  }

  if (socket) {
    socket.auth = {
      token,
      workspaceId: options.workspaceId,
    };
    if (!socket.connected) {
      setChatSocketStatus("connecting");
      socket.connect();
    }
    return socket;
  }

  setChatSocketStatus("connecting");
  activeWorkspaceId = options.workspaceId;

  try {
    socket = io(SOCKET_BASE_URL, {
      autoConnect: true,
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: {
        token,
        workspaceId: options.workspaceId,
      },
      reconnection: true,
      // Cap retries so a down backend cannot spam the console forever.
      reconnectionAttempts: 12,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      timeout: 12_000,
    });
  } catch (error) {
    activeWorkspaceId = null;
    socket = null;
    setChatSocketStatus("disconnected");
    console.warn("[TeamFlow] Failed to start Socket.IO client", error);
    return null;
  }

  bindLifecycle(socket);
  setChatSocketStatus(mapStatusFromSocket(socket));

  return socket;
}

export function getChatSocket(): TeamFlowSocket | null {
  return socket;
}

export function disconnectChatSocket() {
  clearChatPresence();

  if (!socket) {
    activeWorkspaceId = null;
    setChatSocketStatus("idle");
    return;
  }

  const instance = socket;
  socket = null;
  activeWorkspaceId = null;
  instance.removeAllListeners();
  instance.io.removeAllListeners();
  instance.disconnect();
  setChatSocketStatus("disconnected");
}

export function refreshChatSocketAuth(workspaceId: string) {
  const token = getAuthToken();
  if (!token) {
    disconnectChatSocket();
    return null;
  }

  if (!socket || activeWorkspaceId !== workspaceId) {
    return connectChatSocket({ workspaceId });
  }

  socket.auth = { token, workspaceId };
  if (!socket.connected) {
    setChatSocketStatus("connecting");
    socket.connect();
  }
  return socket;
}
