import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";

import { createServeAvatarFileController } from "./avatar-file.controller.js";
import type { ResolvedStoredFile } from "../lib/file-storage/index.js";

function createResponseRecorder() {
  const state: {
    statusCode: number;
    body?: unknown;
    ended: boolean;
    headers: Record<string, string>;
  } = {
    statusCode: 200,
    ended: false,
    headers: {},
  };

  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
    end() {
      state.ended = true;
      return response;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      state.headers[name] = String(value);
      return response;
    },
  } as unknown as Response;

  return { response, state };
}

function avatarRequest(filename: string) {
  return { params: { filename } } as unknown as Request;
}

describe("serveAvatarFileController confirmed-missing legacy avatar", () => {
  it("returns 204 after storage confirms missing and stale DB refs are cleared", async () => {
    let clearedFilename: string | null = null;
    let availabilityCalls = 0;
    let sentFile = false;

    const controller = createServeAvatarFileController({
      isSupabaseStorageEnabled: () => true,
      resolveStoredFile: async () => null,
      resolveStorageObjectKey: ({ filename }) => `avatars/${filename}`,
      getSupabaseObjectAvailability: async () => {
        availabilityCalls += 1;
        return "missing";
      },
      clearStaleUploadedAvatarReferences: async (filename) => {
        clearedFilename = filename;
        return 1;
      },
      sendResolvedStoredFile: async () => {
        sentFile = true;
      },
    });

    const { response, state } = createResponseRecorder();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    await controller(avatarRequest("gone-from-render.jpeg"), response, next);

    assert.equal(state.statusCode, 204);
    assert.equal(state.ended, true);
    assert.equal(state.body, undefined);
    assert.equal(clearedFilename, "gone-from-render.jpeg");
    assert.equal(availabilityCalls, 1);
    assert.equal(sentFile, false);
    assert.equal(nextCalled, false);
  });

  it("keeps 404 when storage availability is error (does not clear or mask)", async () => {
    let clearCalls = 0;

    const controller = createServeAvatarFileController({
      isSupabaseStorageEnabled: () => true,
      resolveStoredFile: async () => null,
      resolveStorageObjectKey: ({ filename }) => `avatars/${filename}`,
      getSupabaseObjectAvailability: async () => "error",
      clearStaleUploadedAvatarReferences: async () => {
        clearCalls += 1;
        return 0;
      },
      sendResolvedStoredFile: async () => {},
    });

    const { response, state } = createResponseRecorder();
    await controller(avatarRequest("transient.jpeg"), response, () => {});

    assert.equal(state.statusCode, 404);
    assert.deepEqual(state.body, { message: "Avatar not found" });
    assert.equal(clearCalls, 0);
    assert.equal(state.ended, false);
  });

  it("still streams a valid Supabase avatar with 200 path (sendResolvedStoredFile)", async () => {
    const file: ResolvedStoredFile = {
      kind: "supabase",
      objectKey: "avatars/fresh.webp",
      mimeType: "image/webp",
      originalName: "fresh.webp",
    };
    let sent: ResolvedStoredFile | null = null;
    let clearCalls = 0;

    const controller = createServeAvatarFileController({
      isSupabaseStorageEnabled: () => true,
      resolveStoredFile: async () => file,
      getSupabaseObjectAvailability: async () => "exists",
      clearStaleUploadedAvatarReferences: async () => {
        clearCalls += 1;
        return 0;
      },
      sendResolvedStoredFile: async (_res, resolved) => {
        sent = resolved;
      },
    });

    const { response, state } = createResponseRecorder();
    await controller(avatarRequest("fresh.webp"), response, () => {});

    assert.equal(sent, file);
    assert.equal(clearCalls, 0);
    // Controller itself does not set status when streaming; sendResolvedStoredFile owns 200.
    assert.equal(state.statusCode, 200);
  });
});
