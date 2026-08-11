import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSocketBaseUrl, resolveSocketTransportOptions } from "./socket-base-url.js";

describe("resolveSocketBaseUrl", () => {
  it("uses the API origin in Vite dev when VITE_SOCKET_URL is unset", () => {
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: undefined,
        apiBaseUrl: "http://localhost:4000",
        isDev: true,
      }),
      "http://localhost:4000",
    );
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: "  ",
        apiBaseUrl: "",
        isDev: true,
      }),
      "http://localhost:4000",
    );
  });

  it("allows VITE_SOCKET_URL override in Vite dev", () => {
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: "http://localhost:4001/",
        apiBaseUrl: "http://localhost:4000",
        isDev: true,
      }),
      "http://localhost:4001",
    );
  });

  it("returns empty string for same-origin production (ignores VITE_SOCKET_URL)", () => {
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: undefined,
        apiBaseUrl: "",
        isDev: false,
      }),
      "",
    );
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: "https://teamflow-ai-api.onrender.com",
        apiBaseUrl: "",
        isDev: false,
      }),
      "",
    );
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: null,
        apiBaseUrl: "   ",
        isDev: false,
      }),
      "",
    );
  });

  it("uses an absolute API override in production when socket URL is unset", () => {
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: undefined,
        apiBaseUrl: "https://teamflow-ai-api.onrender.com",
        isDev: false,
      }),
      "https://teamflow-ai-api.onrender.com",
    );
  });

  it("prefers VITE_SOCKET_URL over absolute API base in production", () => {
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: "https://sockets.example.com/",
        apiBaseUrl: "https://api.example.com",
        isDev: false,
      }),
      "https://sockets.example.com",
    );
  });
});

describe("resolveSocketTransportOptions", () => {
  it("forces polling-only without upgrade for same-origin production", () => {
    assert.deepEqual(
      resolveSocketTransportOptions({
        isDev: false,
        socketBaseUrl: "",
      }),
      {
        transports: ["polling"],
        upgrade: false,
      },
    );
  });

  it("keeps websocket + polling for local development", () => {
    assert.deepEqual(
      resolveSocketTransportOptions({
        isDev: true,
        socketBaseUrl: "http://localhost:4000",
      }),
      {
        transports: ["websocket", "polling"],
        upgrade: true,
      },
    );
  });

  it("keeps websocket + polling for absolute production backend", () => {
    assert.deepEqual(
      resolveSocketTransportOptions({
        isDev: false,
        socketBaseUrl: "https://teamflow-ai-api.onrender.com",
      }),
      {
        transports: ["websocket", "polling"],
        upgrade: true,
      },
    );
  });
});
