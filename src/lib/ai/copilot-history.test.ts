import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearCopilotHistory,
  COPILOT_LOCAL_HISTORY_MAX_MESSAGES,
  copilotHistoryStorageKey,
  readCopilotHistory,
  writeCopilotHistory,
  type StoredCopilotMessage,
} from "./copilot-history.js";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("Copilot local history", () => {
  it("scopes history to both user and workspace", () => {
    const first = copilotHistoryStorageKey("user-1", "workspace-1");
    assert.notEqual(first, copilotHistoryStorageKey("user-2", "workspace-1"));
    assert.notEqual(first, copilotHistoryStorageKey("user-1", "workspace-2"));
    assert.equal(copilotHistoryStorageKey(null, "workspace-1"), null);
  });

  it("restores only the newest bounded messages", () => {
    const storage = memoryStorage();
    const key = copilotHistoryStorageKey("user-1", "workspace-1");
    const messages: StoredCopilotMessage[] = Array.from(
      { length: COPILOT_LOCAL_HISTORY_MAX_MESSAGES + 4 },
      (_, index) => ({ role: index % 2 === 0 ? "user" : "assistant", content: `message-${index}` }),
    );

    writeCopilotHistory(storage, key, messages);

    const restored = readCopilotHistory(storage, key);
    assert.equal(restored.length, COPILOT_LOCAL_HISTORY_MAX_MESSAGES);
    assert.equal(restored[0]?.content, "message-4");
    assert.equal(restored.at(-1)?.content, `message-${messages.length - 1}`);
  });

  it("ignores malformed data and clears only the current key", () => {
    const storage = memoryStorage();
    const firstKey = copilotHistoryStorageKey("user-1", "workspace-1")!;
    const secondKey = copilotHistoryStorageKey("user-1", "workspace-2")!;
    storage.setItem(firstKey, "not-json");
    writeCopilotHistory(storage, secondKey, [{ role: "assistant", content: "kept" }]);

    assert.deepEqual(readCopilotHistory(storage, firstKey), []);
    clearCopilotHistory(storage, firstKey);
    assert.deepEqual(readCopilotHistory(storage, secondKey), [
      { role: "assistant", content: "kept" },
    ]);
  });
});
