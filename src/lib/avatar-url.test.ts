import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  clearAvatarUrlFailure,
  isAvatarUrlFailed,
  markAvatarUrlFailed,
  resetAvatarFailureCacheForTests,
} from "./avatar-failure-cache.js";
import { resolveAvatarUrlWithBase } from "./avatar-url-resolve.js";

function resolveForDisplay(url: string | null | undefined, apiBaseUrl: string) {
  const resolved = resolveAvatarUrlWithBase(url, apiBaseUrl);
  if (!resolved || isAvatarUrlFailed(resolved)) {
    return null;
  }
  return resolved;
}

describe("resolveAvatarUrlWithBase", () => {
  it("keeps same-origin /uploads/avatars path when API base is empty (Vercel production)", () => {
    assert.equal(
      resolveAvatarUrlWithBase("/uploads/avatars/abc.jpeg", ""),
      "/uploads/avatars/abc.jpeg",
    );
  });

  it("prefixes local API origin in Vite dev", () => {
    assert.equal(
      resolveAvatarUrlWithBase("/uploads/avatars/abc.jpeg", "http://localhost:4000"),
      "http://localhost:4000/uploads/avatars/abc.jpeg",
    );
  });

  it("rewrites private-bucket public Supabase URLs to the API uploads path", () => {
    assert.equal(
      resolveAvatarUrlWithBase(
        "https://xyz.supabase.co/storage/v1/object/public/teamflow/avatars/u1.webp",
        "",
      ),
      "/uploads/avatars/u1.webp",
    );
  });

  it("normalizes absolute Render/Vercel uploads URLs to the current API base", () => {
    assert.equal(
      resolveAvatarUrlWithBase(
        "https://teamflow-ai-api.onrender.com/uploads/avatars/old.jpeg",
        "",
      ),
      "/uploads/avatars/old.jpeg",
    );
    assert.equal(
      resolveAvatarUrlWithBase(
        "https://teamflow-ai-murex.vercel.app/uploads/avatars/old.jpeg",
        "http://localhost:4000",
      ),
      "http://localhost:4000/uploads/avatars/old.jpeg",
    );
  });

  it("leaves Google OAuth CDN URLs untouched", () => {
    const google = "https://lh3.googleusercontent.com/a/ACg8ocExample=s96-c";
    assert.equal(resolveAvatarUrlWithBase(google, ""), google);
  });
});

describe("avatar failure cache + resolve", () => {
  beforeEach(() => {
    resetAvatarFailureCacheForTests();
  });

  it("keeps valid uploaded avatar URLs", () => {
    assert.equal(
      resolveForDisplay("/uploads/avatars/fresh.webp", ""),
      "/uploads/avatars/fresh.webp",
    );
  });

  it("keeps valid external/Google avatar URLs", () => {
    const google = "https://lh3.googleusercontent.com/a/ACg8ocExample=s96-c";
    assert.equal(resolveForDisplay(google, ""), google);
  });

  it("falls back to null for missing legacy uploads after a failed load", () => {
    const legacy = "/uploads/avatars/gone-from-render.jpeg";
    assert.equal(resolveForDisplay(legacy, ""), legacy);

    markAvatarUrlFailed(legacy);

    assert.equal(resolveForDisplay(legacy, ""), null);
    assert.equal(isAvatarUrlFailed(legacy), true);
  });

  it("does not retry-loop the same broken URL after markAvatarUrlFailed", () => {
    const broken = "/uploads/avatars/stale.jpeg";
    markAvatarUrlFailed(broken);
    markAvatarUrlFailed(broken);

    assert.equal(resolveForDisplay(broken, ""), null);
    assert.equal(resolveForDisplay(broken, ""), null);
    assert.equal(resolveForDisplay(`https://app.example${broken}`, ""), null);
  });

  it("after confirmed-missing load failure (backend 204 → img onError), resolve is null so UserAvatar shows initials and does not re-request", () => {
    const legacy = "/uploads/avatars/gone-from-render.jpeg";
    assert.equal(resolveForDisplay(legacy, ""), legacy);

    // Same path as UserAvatar.onError after a 204/empty image response.
    markAvatarUrlFailed(legacy);

    assert.equal(resolveForDisplay(legacy, ""), null);
    assert.equal(isAvatarUrlFailed(legacy), true);
    assert.equal(resolveForDisplay(legacy, ""), null);
  });

  it("resolves production Vercel proxy paths with empty API base", () => {
    assert.equal(
      resolveForDisplay("/uploads/avatars/ok.jpeg", ""),
      "/uploads/avatars/ok.jpeg",
    );
  });

  it("allows clearing a failure so a recovered URL can load again", () => {
    const url = "/uploads/avatars/recovered.jpeg";
    markAvatarUrlFailed(url);
    assert.equal(resolveForDisplay(url, ""), null);
    clearAvatarUrlFailure(url);
    assert.equal(resolveForDisplay(url, ""), url);
  });
});
