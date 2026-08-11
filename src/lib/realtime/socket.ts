import { io, type Socket } from "socket.io-client";

import { API_BASE_URL } from "@/lib/api/client";
import { getAuthToken } from "@/lib/auth/token";
import { clearChatPresence } from "./chat-presence-state";
import { setChatSocketStatus, type ChatSocketStatus } from "./chat-socket-state";
import { resolveSocketBaseUrl, resolveSocketTransportOptions } from "./socket-base-url";

export type TeamFlowSocket = Socket;

type ConnectOptions = {
  workspaceId: string;
};

let socket: TeamFlowSocket | null = null;
let activeWorkspaceId: string | null = null;
/** True only after at least one successful connect on the current socket instance. */
let hasEstablishedConnection = false;

/**
 * Socket.IO origin:
 * - local Vite → API origin (localhost)
 * - production same-origin → "" (current Vercel host + /socket.io rewrite)
 */
export const SOCKET_BASE_URL = resolveSocketBaseUrl({
  configuredSocketUrl: import.meta.env.VITE_SOCKET_URL,
  apiBaseUrl: API_BASE_URL,
  isDev: import.meta.env.DEV,
});

const SOCKET_TRANSPORT = resolveSocketTransportOptions({
  isDev: import.meta.env.DEV,
  socketBaseUrl: SOCKET_BASE_URL,
});

function mapStatusFromSocket(instance: TeamFlowSocket): ChatSocketStatus {
  if (instance.connected) {
    return "connected";
  }
  if (instance.active) {
    return hasEstablishedConnection ? "reconnecting" : "connecting";
  }
  return "disconnected";
}

function bindLifecycle(instance: TeamFlowSocket) {
  instance.on("connect", () => {
    hasEstablishedConnection = true;
    setChatSocketStatus("connected");
  });

  instance.on("disconnect", () => {
    clearChatPresence();
    setChatSocketStatus(mapStatusFromSocket(instance));
  });

  instance.io.on("reconnect_attempt", () => {
    setChatSocketStatus(hasEstablishedConnection ? "reconnecting" : "connecting");
  });

  instance.io.on("reconnect", () => {
    hasEstablishedConnection = true;
    setChatSocketStatus("connected");
  });

  instance.io.on("reconnect_failed", () => {
    clearChatPresence();
    setChatSocketStatus("disconnected");
  });

  instance.on("connect_error", () => {
    setChatSocketStatus(mapStatusFromSocket(instance));
  });
}

/**
 * Browser-only Socket.IO singleton.
 * Auth uses the same JWT as REST (handshake.auth.token). Cookies alone are not enough
 * because the app stores the token in localStorage, not an httpOnly cookie.
 *
 * HTTP chat keeps working if realtime is temporarily unavailable.
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
      setChatSocketStatus(hasEstablishedConnection ? "reconnecting" : "connecting");
      socket.connect();
    }
    return socket;
  }

  setChatSocketStatus("connecting");
  activeWorkspaceId = options.workspaceId;
  hasEstablishedConnection = false;

  // Empty string → same-origin (current page host). Socket.IO treats undefined the same.
  const url = SOCKET_BASE_URL || undefined;

  try {
    socket = io(url, {
      autoConnect: true,
      withCredentials: true,
      transports: SOCKET_TRANSPORT.transports,
      upgrade: SOCKET_TRANSPORT.upgrade,
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
    hasEstablishedConnection = false;
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
    hasEstablishedConnection = false;
    setChatSocketStatus("idle");
    return;
  }

  const instance = socket;
  socket = null;
  activeWorkspaceId = null;
  hasEstablishedConnection = false;
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
    setChatSocketStatus(hasEstablishedConnection ? "reconnecting" : "connecting");
    socket.connect();
  }
  return socket;
}
