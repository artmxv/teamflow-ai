import { useSyncExternalStore } from "react";

import {
  getOnlineUserIds,
  isUserOnline,
  subscribeChatPresence,
} from "@/lib/realtime/chat-presence-state";

function getOnlineUserIdsSnapshot(): ReadonlySet<string> {
  return getOnlineUserIds();
}

function getServerOnlineUserIdsSnapshot(): ReadonlySet<string> {
  return new Set();
}

/** Online user IDs for the active workspace (from the shared chat socket). */
export function useOnlineUsers(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribeChatPresence,
    getOnlineUserIdsSnapshot,
    getServerOnlineUserIdsSnapshot,
  );
}

export function useIsUserOnline(userId: string | null | undefined): boolean {
  const onlineUsers = useOnlineUsers();
  if (!userId) {
    return false;
  }
  return onlineUsers.has(userId);
}

/** Non-hook helper for pure checks (tests / non-React code). */
export { isUserOnline };
