import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  CHAT_CONVERSATIONS_POLL_MS,
  chatUnreadCountQueryKey,
  fetchChatUnreadCount,
} from "@/lib/api/chat";
import { getSelectedWorkspaceId } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export function useChatUnreadCount(enabled = true) {
  const { data: me } = useCurrentUser();
  const workspaceId = me?.workspace?.id ?? getSelectedWorkspaceId();
  const queryKey = useMemo(() => chatUnreadCountQueryKey(workspaceId), [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: fetchChatUnreadCount,
    enabled: Boolean(enabled && workspaceId),
    refetchOnWindowFocus: true,
    refetchInterval: (current) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
      }
      return current.state.error ? false : CHAT_CONVERSATIONS_POLL_MS;
    },
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
