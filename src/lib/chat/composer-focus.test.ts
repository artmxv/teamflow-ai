import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  composerCaretRangeAfterFocus,
  isFocusInsideAttachmentPicker,
  shouldRestoreComposerFocus,
  shouldSubmitOnComposerKeyDown,
} from "./composer-focus.js";

describe("shouldSubmitOnComposerKeyDown", () => {
  it("submits on Enter when idle (successful Enter send path)", () => {
    assert.equal(
      shouldSubmitOnComposerKeyDown({
        key: "Enter",
        shiftKey: false,
        isComposing: false,
        isSending: false,
      }),
      true,
    );
  });

  it("does not submit on Shift + Enter", () => {
    assert.equal(
      shouldSubmitOnComposerKeyDown({
        key: "Enter",
        shiftKey: true,
        isComposing: false,
        isSending: false,
      }),
      false,
    );
  });

  it("does not submit while IME composition is active", () => {
    assert.equal(
      shouldSubmitOnComposerKeyDown({
        key: "Enter",
        shiftKey: false,
        isComposing: true,
        isSending: false,
      }),
      false,
    );
  });

  it("does not submit while a send is already pending", () => {
    assert.equal(
      shouldSubmitOnComposerKeyDown({
        key: "Enter",
        shiftKey: false,
        isComposing: false,
        isSending: true,
      }),
      false,
    );
  });
});

describe("shouldRestoreComposerFocus", () => {
  it("restores focus after successful Send-button click once sending finishes", () => {
    // Same restore gate as Enter: form submit clears draft then requests focus.
    assert.equal(
      shouldRestoreComposerFocus({
        focusRequested: true,
        isSending: false,
        isFocusInAttachmentPicker: false,
      }),
      true,
    );
  });

  it("restores focus after successful Enter send once sending finishes", () => {
    assert.equal(
      shouldRestoreComposerFocus({
        focusRequested: true,
        isSending: false,
        isFocusInAttachmentPicker: false,
      }),
      true,
    );
  });

  it("restores focus after failed send so the draft can be retried", () => {
    assert.equal(
      shouldRestoreComposerFocus({
        focusRequested: true,
        isSending: false,
        isFocusInAttachmentPicker: false,
      }),
      true,
    );
  });

  it("waits while send is still pending (textarea may still be disabled)", () => {
    assert.equal(
      shouldRestoreComposerFocus({
        focusRequested: true,
        isSending: true,
        isFocusInAttachmentPicker: false,
      }),
      false,
    );
  });

  it("does not steal focus while selecting a task, project, or file", () => {
    assert.equal(
      shouldRestoreComposerFocus({
        focusRequested: true,
        isSending: false,
        isFocusInAttachmentPicker: true,
      }),
      false,
    );
  });

  it("does nothing when focus was not requested (e.g. only navigating to chat)", () => {
    assert.equal(
      shouldRestoreComposerFocus({
        focusRequested: false,
        isSending: false,
        isFocusInAttachmentPicker: false,
      }),
      false,
    );
  });
});

describe("composerCaretRangeAfterFocus", () => {
  it("places caret at the start of an empty composer after successful clear", () => {
    assert.deepEqual(composerCaretRangeAfterFocus(""), { start: 0, end: 0 });
  });

  it("places caret at the end when a failed-send draft is preserved", () => {
    assert.deepEqual(composerCaretRangeAfterFocus("retry me"), {
      start: 8,
      end: 8,
    });
  });
});

describe("isFocusInsideAttachmentPicker", () => {
  it("returns false when there is no active element", () => {
    assert.equal(isFocusInsideAttachmentPicker(null), false);
  });

  it("detects focus inside a dialog (task/project picker)", () => {
    const dialog = { closest: (selector: string) => (selector.includes("dialog") ? {} : null) };
    assert.equal(isFocusInsideAttachmentPicker(dialog as unknown as Element), true);
  });
});
