/** Hold duration for opening message actions on touch (within 450–550 ms). */
export const MESSAGE_LONG_PRESS_MS = 500;

/** Cancel long press if the pointer moves farther than this (scroll / swipe). */
export const MESSAGE_LONG_PRESS_MOVE_PX = 10;

const IGNORE_LONG_PRESS_SELECTOR = [
  "a[href]",
  "button",
  "[role='button']",
  "input",
  "textarea",
  "select",
  "label",
  "img",
  "[data-no-message-long-press]",
  "[data-message-actions-trigger]",
].join(", ");

/** True when long press should not start (links, media, reactions, actions, etc.). */
export function shouldIgnoreMessageLongPress(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }
  return Boolean(target.closest(IGNORE_LONG_PRESS_SELECTOR));
}

/** Touch / stylus only; mouse keeps hover + button without long press. */
export function isMessageLongPressPointer(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen";
}
