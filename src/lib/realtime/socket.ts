import { io, type Socket } from "socket.io-client";

import { API_BASE_URL } from "@/lib/api/client";
import { getAuthToken } from "@/lib/auth/token";
import { clearChatPresence } from "./chat-presence-state";
import { setChatSocketStatus, type ChatSocketStatus } from "./chat-socket-state";

export type TeamFlowSocket = Socket;

type ConnectOptions = {
  workspaceId: string;
};

let socket: TeamFlowSocket | null = null;
let activeWorkspaceId: string | null = null;

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

  instance.on("connect_error", () => {
    setChatSocketStatus(instance.active ? "reconnecting" : "disconnected");
  });
}

/**
 * Browser-only Socket.IO singleton.
 * Auth uses the same JWT as REST (handshake.auth.token). Cookies alone are not enough
 * because the app stores the token in localStorage, not an httpOnly cookie.
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
      setChatSocketStatus("connecting");
      socket.connect();
    }
    return socket;
  }

  setChatSocketStatus("connecting");
  activeWorkspaceId = options.workspaceId;

  socket = io(API_BASE_URL, {
    autoConnect: true,
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: {
      token,
      workspaceId: options.workspaceId,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 8_000,
  });

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
