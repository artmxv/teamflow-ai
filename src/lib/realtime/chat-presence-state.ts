/**
 * Client-side online presence for the active workspace.
 * Backed by the shared chat Socket.IO connection (not React Query / localStorage).
 */

export type ChatPresenceSnapshotEvent = {
  workspaceId: string;
  onlineUserIds: string[];
};

export type ChatPresenceUpdatedEvent = {
  workspaceId: string;
  userId: string;
  isOnline: boolean;
};

type Listener = () => void;

let presenceWorkspaceId: string | null = null;
let onlineUserIds = new Set<string>();
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function replaceOnlineIds(next: Set<string>) {
  onlineUserIds = next;
  emitChange();
}

export function getPresenceWorkspaceId(): string | null {
  return presenceWorkspaceId;
}

export function getOnlineUserIds(): ReadonlySet<string> {
  return onlineUserIds;
}

export function isUserOnline(userId: string | null | undefined): boolean {
  if (!userId) {
    return false;
  }
  return onlineUserIds.has(userId);
}

export function subscribeChatPresence(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replaces the online set for a workspace (server snapshot). */
export function applyPresenceSnapshot(event: ChatPresenceSnapshotEvent) {
  presenceWorkspaceId = event.workspaceId;
  replaceOnlineIds(new Set(event.onlineUserIds));
}

/** Applies a single online/offline transition for the active workspace. */
export function applyPresenceUpdate(event: ChatPresenceUpdatedEvent) {
  if (presenceWorkspaceId && event.workspaceId !== presenceWorkspaceId) {
    return;
  }

  if (!presenceWorkspaceId) {
    presenceWorkspaceId = event.workspaceId;
  }

  const next = new Set(onlineUserIds);
  if (event.isOnline) {
    next.add(event.userId);
  } else {
    next.delete(event.userId);
  }
  replaceOnlineIds(next);
}

/**
 * Clears presence so green indicators never linger after disconnect,
 * auth change, or workspace switch.
 */
export function clearChatPresence() {
  if (presenceWorkspaceId === null && onlineUserIds.size === 0) {
    return;
  }
  presenceWorkspaceId = null;
  replaceOnlineIds(new Set());
}

/** Test helper: reset module state without notifying (optional notify via clear). */
export function resetChatPresenceForTests() {
  presenceWorkspaceId = null;
  onlineUserIds = new Set();
  listeners.clear();
}
