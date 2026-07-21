import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import {
  chatConversationsQueryKey,
  chatMessagesQueryKey,
  chatUnreadCountQueryKey,
} from "@/lib/api/chat";
import {
  applyChatConversationUpdatedToCache,
  applyChatMessageCreatedToCache,
  applyChatMessageDeletedToCache,
  type ChatConversationUpdatedEvent,
  type ChatMessageCreatedEvent,
  type ChatMessageDeletedEvent,
} from "@/lib/realtime/chat-cache";
import {
  getChatSocketStatus,
  getOpenChatConversationId,
  subscribeChatSocketStatus,
  subscribeOpenChatConversationId,
} from "@/lib/realtime/chat-socket-state";
import { connectChatSocket, disconnectChatSocket, getChatSocket } from "@/lib/realtime/socket";

const MESSAGE_CREATED = "chat:message-created";
const MESSAGE_DELETED = "chat:message-deleted";
const CONVERSATION_UPDATED = "chat:conversation-updated";

type UseChatRealtimeOptions = {
  workspaceId: string | null | undefined;
  currentUserId: string | null | undefined;
  enabled?: boolean;
};

/**
 * Keeps a single Socket.IO connection for the authenticated workspace session.
 * Safe for SSR: connects only in the browser after auth + workspace are ready.
 */
export function useChatRealtime({
  workspaceId,
  currentUserId,
  enabled = true,
}: UseChatRealtimeOptions) {
  const queryClient = useQueryClient();
  const status = useSyncExternalStore(
    subscribeChatSocketStatus,
    getChatSocketStatus,
    () => "idle" as const,
  );
  const openConversationId = useSyncExternalStore(
    subscribeOpenChatConversationId,
    getOpenChatConversationId,
    () => null,
  );

  useEffect(() => {
    if (!enabled || !workspaceId || !currentUserId || typeof window === "undefined") {
      disconnectChatSocket();
      return;
    }

    const instance = connectChatSocket({ workspaceId });
    if (!instance) {
      return;
    }

    function onMessageCreated(payload: ChatMessageCreatedEvent) {
      applyChatMessageCreatedToCache({
        queryClient,
        workspaceId: workspaceId!,
        currentUserId: currentUserId!,
        openConversationId: getOpenChatConversationId(),
        event: payload,
      });
    }

    function onMessageDeleted(payload: ChatMessageDeletedEvent) {
      applyChatMessageDeletedToCache({
        queryClient,
        workspaceId: workspaceId!,
        event: payload,
      });
    }

    function onConversationUpdated(payload: ChatConversationUpdatedEvent) {
      applyChatConversationUpdatedToCache({
        queryClient,
        workspaceId: workspaceId!,
        event: payload,
      });
    }

    function refetchAfterReconnect() {
      void queryClient.invalidateQueries({
        queryKey: chatConversationsQueryKey(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: chatUnreadCountQueryKey(workspaceId),
      });

      const openId = getOpenChatConversationId();
      if (openId) {
        void queryClient.invalidateQueries({
          queryKey: chatMessagesQueryKey(workspaceId, openId),
        });
      }
    }

    instance.on(MESSAGE_CREATED, onMessageCreated);
    instance.on(MESSAGE_DELETED, onMessageDeleted);
    instance.on(CONVERSATION_UPDATED, onConversationUpdated);
    instance.on("connect", refetchAfterReconnect);

    return () => {
      instance.off(MESSAGE_CREATED, onMessageCreated);
      instance.off(MESSAGE_DELETED, onMessageDeleted);
      instance.off(CONVERSATION_UPDATED, onConversationUpdated);
      instance.off("connect", refetchAfterReconnect);
    };
  }, [enabled, workspaceId, currentUserId, queryClient]);

  useEffect(() => {
    return () => {
      // Disconnect when the authenticated shell unmounts / logs out.
      if (!enabled) {
        disconnectChatSocket();
      }
    };
  }, [enabled]);

  return {
    status,
    isConnected: status === "connected",
    openConversationId,
    socket: getChatSocket(),
  };
}

export function useChatSocketStatus() {
  return useSyncExternalStore(subscribeChatSocketStatus, getChatSocketStatus, () => "idle" as const);
}
