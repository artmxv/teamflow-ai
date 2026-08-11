import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAvatarUrlWithBase } from "./avatar-url-resolve.js";

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
