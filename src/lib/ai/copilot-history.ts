export const COPILOT_LOCAL_HISTORY_MAX_MESSAGES = 24;
export const COPILOT_LOCAL_HISTORY_CONTENT_MAX_CHARS = 4_000;

export type StoredCopilotMessage = {
  role: "user" | "assistant";
  content: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const COPILOT_HISTORY_KEY_PREFIX = "teamflow.aiCopilotHistory";

export function copilotHistoryStorageKey(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
): string | null {
  const normalizedUserId = userId?.trim();
  const normalizedWorkspaceId = workspaceId?.trim();
  if (!normalizedUserId || !normalizedWorkspaceId) {
    return null;
  }
  return `${COPILOT_HISTORY_KEY_PREFIX}:${encodeURIComponent(normalizedUserId)}:${encodeURIComponent(normalizedWorkspaceId)}`;
}

function normalizeStoredMessages(value: unknown): StoredCopilotMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is StoredCopilotMessage =>
        typeof item === "object" &&
        item !== null &&
        (item as StoredCopilotMessage).role !== undefined &&
        ((item as StoredCopilotMessage).role === "user" ||
          (item as StoredCopilotMessage).role === "assistant") &&
        typeof (item as StoredCopilotMessage).content === "string",
    )
    .map(({ role, content }) => ({
      role,
      content: content.slice(0, COPILOT_LOCAL_HISTORY_CONTENT_MAX_CHARS),
    }))
    .slice(-COPILOT_LOCAL_HISTORY_MAX_MESSAGES);
}

export function readCopilotHistory(
  storage: StorageLike,
  key: string | null,
): StoredCopilotMessage[] {
  if (!key) {
    return [];
  }
  try {
    const raw = storage.getItem(key);
    return raw ? normalizeStoredMessages(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

export function writeCopilotHistory(
  storage: StorageLike,
  key: string | null,
  messages: StoredCopilotMessage[],
): void {
  if (!key) {
    return;
  }
  try {
    const bounded = normalizeStoredMessages(messages);
    if (bounded.length === 0) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(bounded));
  } catch {
    // Storage can be unavailable in private mode or at quota. The in-memory chat still works.
  }
}

export function clearCopilotHistory(storage: StorageLike, key: string | null): void {
  if (!key) {
    return;
  }
  try {
    storage.removeItem(key);
  } catch {
    // The current in-memory conversation can still be cleared.
  }
}
