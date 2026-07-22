import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runMultipartUploadIfAuthorized } from "./chat-multipart-upload.js";

describe("multipart conversation upload guard", () => {
  it("does not invoke upload parsing when conversation access fails", async () => {
    let uploadCalled = false;

    const result = await runMultipartUploadIfAuthorized({
      validateAccess: async () => "not_found",
      parseUpload: async () => {
        uploadCalled = true;
        return [];
      },
    });

    assert.deepEqual(result, { status: "not_found" });
    assert.equal(uploadCalled, false);
  });

  it("runs upload parsing only after conversation access succeeds", async () => {
    let uploadCalled = false;

    const result = await runMultipartUploadIfAuthorized({
      validateAccess: async () => "ok",
      parseUpload: async () => {
        uploadCalled = true;
        return ["file"];
      },
    });

    assert.deepEqual(result, { status: "uploaded", result: ["file"] });
    assert.equal(uploadCalled, true);
  });
});
