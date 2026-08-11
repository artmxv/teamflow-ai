import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveApiBaseUrl } from "./api-base-url.js";

describe("resolveApiBaseUrl", () => {
  it("uses localhost in Vite dev when VITE_API_URL is unset", () => {
    assert.equal(resolveApiBaseUrl({ configuredUrl: undefined, isDev: true }), "http://localhost:4000");
    assert.equal(resolveApiBaseUrl({ configuredUrl: "  ", isDev: true }), "http://localhost:4000");
  });

  it("uses same-origin empty string in production when VITE_API_URL is unset", () => {
    assert.equal(resolveApiBaseUrl({ configuredUrl: undefined, isDev: false }), "");
    assert.equal(resolveApiBaseUrl({ configuredUrl: null, isDev: false }), "");
    assert.equal(resolveApiBaseUrl({ configuredUrl: "", isDev: false }), "");
  });

  it("keeps VITE_API_URL as an optional override and strips trailing slashes", () => {
    assert.equal(
      resolveApiBaseUrl({
        configuredUrl: "https://teamflow-ai-api.onrender.com",
        isDev: false,
      }),
      "https://teamflow-ai-api.onrender.com",
    );
    assert.equal(
      resolveApiBaseUrl({
        configuredUrl: "http://localhost:4000/",
        isDev: true,
      }),
      "http://localhost:4000",
    );
  });

  it("builds /api paths without doubling /api", () => {
    const prodBase = resolveApiBaseUrl({ configuredUrl: undefined, isDev: false });
    const localBase = resolveApiBaseUrl({ configuredUrl: undefined, isDev: true });
    assert.equal(`${prodBase}/api/workspaces`, "/api/workspaces");
    assert.equal(`${localBase}/api/workspaces`, "http://localhost:4000/api/workspaces");
  });
});
