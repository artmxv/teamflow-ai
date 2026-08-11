import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clearStaleUploadedAvatarReferences } from "../services/auth.service.js";

describe("clearStaleUploadedAvatarReferences", () => {
  it("rejects unsafe filenames without querying the database", async () => {
    assert.equal(await clearStaleUploadedAvatarReferences(""), 0);
    assert.equal(await clearStaleUploadedAvatarReferences("../secret.jpeg"), 0);
    assert.equal(await clearStaleUploadedAvatarReferences("a/b.jpeg"), 0);
    assert.equal(await clearStaleUploadedAvatarReferences("a\\b.jpeg"), 0);
  });
});
