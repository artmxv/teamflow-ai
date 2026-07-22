/**
 * In-memory Socket.IO presence for the current single-instance deployment.
 *
 * A user is online in a workspace while at least one authenticated socket for
 * that pair remains connected (or until the short offline grace expires).
 *
 * Horizontal scaling later needs a shared presence layer (e.g. Redis) plus the
 * Socket.IO Redis adapter. Do not treat this registry as multi-instance safe.
 */

export const PRESENCE_OFFLINE_GRACE_MS = 4_000;

export type PresenceOfflineEvent = {
  workspaceId: string;
  userId: string;
};

export type PresenceOfflineHandler = (event: PresenceOfflineEvent) => void;

type TimerHandle = ReturnType<typeof setTimeout>;

type PresenceRegistryOptions = {
  graceMs?: number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
};

function presenceKey(workspaceId: string, userId: string): string {
  return `${workspaceId}:${userId}`;
}

/**
 * Pure in-memory registry. Auth / active-membership gates stay in Socket.IO middleware;
 * only successfully authenticated connections should call addSocket.
 */
export function createPresenceRegistry(options: PresenceRegistryOptions = {}) {
  const graceMs = options.graceMs ?? PRESENCE_OFFLINE_GRACE_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;

  /** workspaceId → userId → socketIds */
  const socketsByUser = new Map<string, Map<string, Set<string>>>();
  /** workspaceId → userIds considered online (includes offline grace window) */
  const onlineUsers = new Map<string, Set<string>>();
  const pendingOffline = new Map<string, TimerHandle>();

  let onOffline: PresenceOfflineHandler | null = null;

  function getUserSockets(workspaceId: string, userId: string): Set<string> | undefined {
    return socketsByUser.get(workspaceId)?.get(userId);
  }

  function markOnline(workspaceId: string, userId: string): boolean {
    let users = onlineUsers.get(workspaceId);
    if (!users) {
      users = new Set();
      onlineUsers.set(workspaceId, users);
    }
    if (users.has(userId)) {
      return false;
    }
    users.add(userId);
    return true;
  }

  function markOffline(workspaceId: string, userId: string) {
    const users = onlineUsers.get(workspaceId);
    if (!users) {
      return;
    }
    users.delete(userId);
    if (users.size === 0) {
      onlineUsers.delete(workspaceId);
    }
  }

  function cancelPendingOffline(workspaceId: string, userId: string) {
    const key = presenceKey(workspaceId, userId);
    const timer = pendingOffline.get(key);
    if (!timer) {
      return;
    }
    clearTimer(timer);
    pendingOffline.delete(key);
  }

  function scheduleOffline(workspaceId: string, userId: string) {
    cancelPendingOffline(workspaceId, userId);
    const key = presenceKey(workspaceId, userId);
    const timer = setTimer(() => {
      pendingOffline.delete(key);
      if ((getUserSockets(workspaceId, userId)?.size ?? 0) > 0) {
        return;
      }
      markOffline(workspaceId, userId);
      onOffline?.({ workspaceId, userId });
    }, graceMs);
    pendingOffline.set(key, timer);
  }

  return {
    setOfflineHandler(handler: PresenceOfflineHandler | null) {
      onOffline = handler;
    },

    /**
     * Registers an authenticated socket.
     * @returns true when this is the first online transition (not a duplicate tab).
     */
    addSocket(workspaceId: string, userId: string, socketId: string): boolean {
      cancelPendingOffline(workspaceId, userId);

      let byUser = socketsByUser.get(workspaceId);
      if (!byUser) {
        byUser = new Map();
        socketsByUser.set(workspaceId, byUser);
      }

      let sockets = byUser.get(userId);
      if (!sockets) {
        sockets = new Set();
        byUser.set(userId, sockets);
      }

      sockets.add(socketId);
      return markOnline(workspaceId, userId);
    },

    /**
     * Removes a socket. Keeps the user online during grace when it was the last socket.
     */
    removeSocket(workspaceId: string, userId: string, socketId: string): void {
      const byUser = socketsByUser.get(workspaceId);
      const sockets = byUser?.get(userId);
      if (!sockets || !sockets.has(socketId)) {
        return;
      }

      sockets.delete(socketId);
      if (sockets.size > 0) {
        return;
      }

      byUser!.delete(userId);
      if (byUser!.size === 0) {
        socketsByUser.delete(workspaceId);
      }

      scheduleOffline(workspaceId, userId);
    },

    listOnlineUserIds(workspaceId: string): string[] {
      const users = onlineUsers.get(workspaceId);
      if (!users || users.size === 0) {
        return [];
      }
      return Array.from(users);
    },

    isUserOnline(workspaceId: string, userId: string): boolean {
      return onlineUsers.get(workspaceId)?.has(userId) ?? false;
    },

    getSocketCount(workspaceId: string, userId: string): number {
      return getUserSockets(workspaceId, userId)?.size ?? 0;
    },

    hasPendingOffline(workspaceId: string, userId: string): boolean {
      return pendingOffline.has(presenceKey(workspaceId, userId));
    },

    /** Clears timers and maps (graceful server shutdown / tests). */
    clear() {
      for (const timer of pendingOffline.values()) {
        clearTimer(timer);
      }
      pendingOffline.clear();
      socketsByUser.clear();
      onlineUsers.clear();
    },
  };
}

export type ChatPresenceRegistry = ReturnType<typeof createPresenceRegistry>;

/** Process-wide registry for the single Socket.IO instance. */
export const chatPresenceRegistry = createPresenceRegistry();
