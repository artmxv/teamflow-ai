/**
 * Insert text into a string at a textarea-style selection range.
 * Indices are UTF-16 code units (same as HTMLTextAreaElement.selectionStart/End).
 * The insertion string is never split per "character", so multi-code-unit emoji stay intact.
 */

export type TextSelectionRange = {
  start: number;
  end: number;
};

export function insertTextAtSelection(
  text: string,
  selection: TextSelectionRange | null | undefined,
  insertion: string,
): { value: string; caret: number } {
  if (!insertion) {
    const caret = selection
      ? Math.min(Math.max(selection.start, selection.end), text.length)
      : text.length;
    return { value: text, caret };
  }

  if (
    !selection ||
    !Number.isFinite(selection.start) ||
    !Number.isFinite(selection.end) ||
    selection.start < 0 ||
    selection.end < 0
  ) {
    return {
      value: text + insertion,
      caret: text.length + insertion.length,
    };
  }

  const start = Math.min(Math.max(0, Math.min(selection.start, selection.end)), text.length);
  const end = Math.min(Math.max(0, Math.max(selection.start, selection.end)), text.length);
  const value = text.slice(0, start) + insertion + text.slice(end);
  return {
    value,
    caret: start + insertion.length,
  };
}
