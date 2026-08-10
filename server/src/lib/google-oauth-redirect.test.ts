import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGoogleOAuthCallbackUrl } from "./google-oauth-redirect.js";

describe("Google OAuth callback redirect", () => {
  it("puts the bearer token in the fragment instead of the query string", () => {
    const redirect = buildGoogleOAuthCallbackUrl(
      "https://teamflow.example/",
      "signed.jwt.value",
      "/app/projects?view=active",
    );
    const url = new URL(redirect);

    assert.equal(url.origin, "https://teamflow.example");
    assert.equal(url.pathname, "/auth/callback");
    assert.equal(url.search, "");
    assert.equal(url.searchParams.has("token"), false);

    const fragment = new URLSearchParams(url.hash.slice(1));
    assert.equal(fragment.get("token"), "signed.jwt.value");
    assert.equal(fragment.get("redirect"), "/app/projects?view=active");
  });

  it("normalizes an unsafe redirect to the dashboard", () => {
    const url = new URL(
      buildGoogleOAuthCallbackUrl(
        "https://teamflow.example",
        "signed.jwt.value",
        "https://attacker.example/steal",
      ),
    );

    const fragment = new URLSearchParams(url.hash.slice(1));
    assert.equal(fragment.get("redirect"), "/app/dashboard");
  });
});
