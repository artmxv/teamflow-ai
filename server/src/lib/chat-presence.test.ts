import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PRESENCE_OFFLINE_GRACE_MS,
  createPresenceRegistry,
} from "../realtime/chat-presence.js";

describe("chat presence registry", () => {
  it("marks a user online on the first socket", () => {
    const registry = createPresenceRegistry({ graceMs: 50 });
    const offlineEvents: Array<{ workspaceId: string; userId: string }> = [];
    registry.setOfflineHandler((event) => offlineEvents.push(event));

    const becameOnline = registry.addSocket("w1", "u1", "s1");

    assert.equal(becameOnline, true);
    assert.equal(registry.isUserOnline("w1", "u1"), true);
    assert.deepEqual(registry.listOnlineUserIds("w1"), ["u1"]);
    assert.equal(offlineEvents.length, 0);
  });

  it("does not emit a duplicate online transition for a second socket", () => {
    const registry = createPresenceRegistry({ graceMs: 50 });

    assert.equal(registry.addSocket("w1", "u1", "s1"), true);
    assert.equal(registry.addSocket("w1", "u1", "s2"), false);
    assert.equal(registry.getSocketCount("w1", "u1"), 2);
    assert.deepEqual(registry.listOnlineUserIds("w1"), ["u1"]);
  });

  it("keeps the user online when one of multiple sockets disconnects", () => {
    const registry = createPresenceRegistry({ graceMs: 50 });
    const offlineEvents: Array<{ workspaceId: string; userId: string }> = [];
    registry.setOfflineHandler((event) => offlineEvents.push(event));

    registry.addSocket("w1", "u1", "s1");
    registry.addSocket("w1", "u1", "s2");
    registry.removeSocket("w1", "u1", "s1");

    assert.equal(registry.isUserOnline("w1", "u1"), true);
    assert.equal(registry.getSocketCount("w1", "u1"), 1);
    assert.equal(registry.hasPendingOffline("w1", "u1"), false);
    assert.equal(offlineEvents.length, 0);
  });

  it("emits offline after grace when the final socket disconnects", async () => {
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const registry = createPresenceRegistry({
      graceMs: 40,
      setTimer: ((fn: () => void, ms: number) => {
        timers.push({ fn, ms });
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimer: (() => undefined) as typeof clearTimeout,
    });

    const offlineEvents: Array<{ workspaceId: string; userId: string }> = [];
    registry.setOfflineHandler((event) => offlineEvents.push(event));

    registry.addSocket("w1", "u1", "s1");
    registry.removeSocket("w1", "u1", "s1");

    assert.equal(registry.isUserOnline("w1", "u1"), true);
    assert.equal(registry.hasPendingOffline("w1", "u1"), true);
    assert.equal(timers.length, 1);
    assert.equal(timers[0]!.ms, 40);

    timers[0]!.fn();

    assert.equal(registry.isUserOnline("w1", "u1"), false);
    assert.deepEqual(offlineEvents, [{ workspaceId: "w1", userId: "u1" }]);
  });

  it("cancels pending offline when the user reconnects before grace expiry", () => {
    const timers = new Map<number, () => void>();
    let nextId = 1;
    let cleared: number[] = [];

    const registry = createPresenceRegistry({
      graceMs: 40,
      setTimer: ((fn: () => void) => {
        const id = nextId++;
        timers.set(id, fn);
        return id as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimer: ((id: ReturnType<typeof setTimeout>) => {
        cleared.push(id as unknown as number);
        timers.delete(id as unknown as number);
      }) as typeof clearTimeout,
    });

    const offlineEvents: Array<{ workspaceId: string; userId: string }> = [];
    registry.setOfflineHandler((event) => offlineEvents.push(event));

    registry.addSocket("w1", "u1", "s1");
    registry.removeSocket("w1", "u1", "s1");
    assert.equal(registry.hasPendingOffline("w1", "u1"), true);

    const becameOnlineAgain = registry.addSocket("w1", "u1", "s2");

    assert.equal(becameOnlineAgain, false);
    assert.equal(registry.isUserOnline("w1", "u1"), true);
    assert.equal(registry.hasPendingOffline("w1", "u1"), false);
    assert.equal(cleared.length, 1);
    assert.equal(offlineEvents.length, 0);
  });

  it("isolates presence by workspace", () => {
    const registry = createPresenceRegistry({ graceMs: 50 });

    registry.addSocket("w1", "u1", "s-a");
    registry.addSocket("w2", "u1", "s-b");
    registry.addSocket("w1", "u2", "s-c");

    assert.deepEqual(registry.listOnlineUserIds("w1").sort(), ["u1", "u2"]);
    assert.deepEqual(registry.listOnlineUserIds("w2"), ["u1"]);
    assert.equal(registry.isUserOnline("w2", "u2"), false);

    registry.removeSocket("w1", "u1", "s-a");
    // Still online in w2 even while w1 enters grace for u1.
    assert.equal(registry.isUserOnline("w2", "u1"), true);
  });

  it("snapshot lists only users online in that workspace", () => {
    const registry = createPresenceRegistry({ graceMs: 50 });
    registry.addSocket("w1", "u1", "s1");
    registry.addSocket("w1", "u2", "s2");
    registry.addSocket("w2", "u3", "s3");

    assert.deepEqual(registry.listOnlineUserIds("w1").sort(), ["u1", "u2"]);
    assert.deepEqual(registry.listOnlineUserIds("w2"), ["u3"]);
    assert.deepEqual(registry.listOnlineUserIds("w-missing"), []);
  });

  it("does not register users until addSocket is called (auth gate)", () => {
    const registry = createPresenceRegistry({ graceMs: 50 });
    assert.deepEqual(registry.listOnlineUserIds("w1"), []);
    assert.equal(registry.isUserOnline("w1", "inactive-user"), false);
    assert.equal(registry.getSocketCount("w1", "inactive-user"), 0);
  });

  it("clear removes timers and sockets safely", () => {
    const timers = new Map<number, () => void>();
    let nextId = 1;
    let cleared = 0;

    const registry = createPresenceRegistry({
      graceMs: PRESENCE_OFFLINE_GRACE_MS,
      setTimer: ((fn: () => void) => {
        const id = nextId++;
        timers.set(id, fn);
        return id as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimer: ((id: ReturnType<typeof setTimeout>) => {
        cleared += 1;
        timers.delete(id as unknown as number);
      }) as typeof clearTimeout,
    });

    registry.addSocket("w1", "u1", "s1");
    registry.removeSocket("w1", "u1", "s1");
    assert.equal(registry.hasPendingOffline("w1", "u1"), true);

    registry.clear();

    assert.equal(cleared, 1);
    assert.deepEqual(registry.listOnlineUserIds("w1"), []);
    assert.equal(registry.hasPendingOffline("w1", "u1"), false);
    assert.equal(timers.size, 0);
  });
});
