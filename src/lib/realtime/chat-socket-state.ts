export type ChatSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

type Listener = () => void;

let status: ChatSocketStatus = "idle";
const listeners = new Set<Listener>();

let openConversationId: string | null = null;
const openConversationListeners = new Set<Listener>();

export function getChatSocketStatus(): ChatSocketStatus {
  return status;
}

export function setChatSocketStatus(next: ChatSocketStatus) {
  if (status === next) {
    return;
  }
  status = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeChatSocketStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isChatSocketConnected(): boolean {
  return status === "connected";
}

export function getOpenChatConversationId(): string | null {
  return openConversationId;
}

export function setOpenChatConversationId(conversationId: string | null) {
  if (openConversationId === conversationId) {
    return;
  }
  openConversationId = conversationId;
  for (const listener of openConversationListeners) {
    listener();
  }
}

export function subscribeOpenChatConversationId(listener: Listener): () => void {
  openConversationListeners.add(listener);
  return () => {
    openConversationListeners.delete(listener);
  };
}
