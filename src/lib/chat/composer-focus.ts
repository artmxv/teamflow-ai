/**
 * Composer keyboard + focus helpers for chat.
 * Kept pure so Enter / Send / restore-focus behavior can be unit-tested.
 */

export function shouldSubmitOnComposerKeyDown(input: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  isSending: boolean;
}): boolean {
  if (input.isComposing) {
    return false;
  }
  if (input.key !== "Enter" || input.shiftKey) {
    return false;
  }
  if (input.isSending) {
    return false;
  }
  return true;
}

export function shouldRestoreComposerFocus(input: {
  focusRequested: boolean;
  isSending: boolean;
  isFocusInAttachmentPicker: boolean;
}): boolean {
  if (!input.focusRequested) {
    return false;
  }
  if (input.isSending) {
    return false;
  }
  if (input.isFocusInAttachmentPicker) {
    return false;
  }
  return true;
}

/** Empty draft → caret at start; failed send with text → caret at end for retry. */
export function composerCaretRangeAfterFocus(value: string): { start: number; end: number } {
  if (value.length === 0) {
    return { start: 0, end: 0 };
  }
  return { start: value.length, end: value.length };
}

export function isFocusInsideAttachmentPicker(activeElement: Element | null): boolean {
  if (!activeElement) {
    return false;
  }
  return Boolean(
    activeElement.closest(
      '[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]',
    ),
  );
}

export function focusChatComposer(
  el: HTMLTextAreaElement,
  options?: { preventScroll?: boolean },
): void {
  el.focus({ preventScroll: options?.preventScroll ?? true });
  const range = composerCaretRangeAfterFocus(el.value);
  try {
    el.setSelectionRange(range.start, range.end);
  } catch {
    // Some environments reject setSelectionRange on non-text inputs; ignore.
  }
}
