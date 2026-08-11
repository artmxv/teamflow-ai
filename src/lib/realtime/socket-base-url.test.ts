import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSocketBaseUrl } from "./socket-base-url.js";

describe("resolveSocketBaseUrl", () => {
  it("prefers VITE_SOCKET_URL and strips trailing slashes", () => {
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: "https://teamflow-ai-api.onrender.com/",
        apiBaseUrl: "",
        isDev: false,
      }),
      "https://teamflow-ai-api.onrender.com",
    );
  });

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

  it("returns null for same-origin production without VITE_SOCKET_URL", () => {
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: undefined,
        apiBaseUrl: "",
        isDev: false,
      }),
      null,
    );
    assert.equal(
      resolveSocketBaseUrl({
        configuredSocketUrl: null,
        apiBaseUrl: "   ",
        isDev: false,
      }),
      null,
    );
  });
});
