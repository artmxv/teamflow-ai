import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";

import {
  CHAT_CONVERSATIONS_FALLBACK_POLL_MS,
  chatUnreadCountQueryKey,
  fetchChatUnreadCount,
} from "@/lib/api/chat";
import { getSelectedWorkspaceId } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  getChatSocketStatus,
  isChatSocketConnected,
  subscribeChatSocketStatus,
} from "@/lib/realtime/chat-socket-state";

export function useChatUnreadCount(enabled = true) {
  const { data: me } = useCurrentUser();
  const workspaceId = me?.workspace?.id ?? getSelectedWorkspaceId();
  const queryKey = useMemo(() => chatUnreadCountQueryKey(workspaceId), [workspaceId]);
  const socketStatus = useSyncExternalStore(
    subscribeChatSocketStatus,
    getChatSocketStatus,
    () => "idle" as const,
  );

  const query = useQuery({
    queryKey,
    queryFn: fetchChatUnreadCount,
    enabled: Boolean(enabled && workspaceId),
    refetchOnWindowFocus: true,
    refetchInterval: (current) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
      }
      if (current.state.error) {
        return false;
      }
      // Socket connected: rely on realtime; slow fallback only.
      if (isChatSocketConnected() || socketStatus === "connected") {
        return false;
      }
      return CHAT_CONVERSATIONS_FALLBACK_POLL_MS;
    },
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
