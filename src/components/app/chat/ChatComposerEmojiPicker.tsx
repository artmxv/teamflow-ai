import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  insertTextAtSelection,
  type TextSelectionRange,
} from "@/lib/chat/insert-text-at-selection";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ChatComposerEmojiPickerPanel = lazy(() =>
  import("./ChatComposerEmojiPickerPanel").then((mod) => ({
    default: mod.ChatComposerEmojiPickerPanel,
  })),
);

type ChatComposerEmojiPickerProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

function readTextareaSelection(el: HTMLTextAreaElement | null): TextSelectionRange | null {
  if (!el) {
    return null;
  }
  try {
    return { start: el.selectionStart, end: el.selectionEnd };
  } catch {
    return null;
  }
}

export function ChatComposerEmojiPicker({
  textareaRef,
  value,
  onChange,
  disabled,
}: ChatComposerEmojiPickerProps) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const selectionRef = useRef<TextSelectionRange | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const ignoreFocusOutsideRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }

    const saveSelection = () => {
      selectionRef.current = readTextareaSelection(el);
    };

    el.addEventListener("select", saveSelection);
    el.addEventListener("keyup", saveSelection);
    el.addEventListener("mouseup", saveSelection);
    el.addEventListener("input", saveSelection);
    el.addEventListener("focus", saveSelection);

    return () => {
      el.removeEventListener("select", saveSelection);
      el.removeEventListener("keyup", saveSelection);
      el.removeEventListener("mouseup", saveSelection);
      el.removeEventListener("input", saveSelection);
      el.removeEventListener("focus", saveSelection);
    };
  }, [textareaRef]);

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret == null) {
      return;
    }
    pendingCaretRef.current = null;
    const el = textareaRef.current;
    if (!el || el.disabled) {
      return;
    }
    el.focus({ preventScroll: true });
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      // Ignore environments that reject setSelectionRange.
    }
    selectionRef.current = { start: caret, end: caret };
  }, [value, textareaRef]);

  function captureSelectionBeforeOpen() {
    selectionRef.current = readTextareaSelection(textareaRef.current) ?? selectionRef.current;
  }

  function restoreTextareaFocus() {
    const el = textareaRef.current;
    if (!el || el.disabled) {
      return;
    }
    el.focus({ preventScroll: true });
    const range = selectionRef.current ?? {
      start: el.value.length,
      end: el.value.length,
    };
    try {
      el.setSelectionRange(range.start, range.end);
    } catch {
      // Ignore environments that reject setSelectionRange.
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      captureSelectionBeforeOpen();
    }
    setOpen(nextOpen);
    if (!nextOpen) {
      // Escape / outside click: return focus to the composer.
      requestAnimationFrame(() => {
        restoreTextareaFocus();
      });
    }
  }

  function handleEmojiSelect(emoji: string) {
    const selection = selectionRef.current ?? readTextareaSelection(textareaRef.current);
    const result = insertTextAtSelection(valueRef.current, selection, emoji);
    selectionRef.current = { start: result.caret, end: result.caret };
    pendingCaretRef.current = result.caret;
    // Restoring textarea focus must not dismiss the popover (multi-insert).
    ignoreFocusOutsideRef.current = true;
    // Keep the picker open so several emoji can be inserted in a row.
    onChange(result.value);
  }

  return (
    <Popover modal={false} open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground"
          disabled={disabled}
          aria-label={t("chat.addEmoji")}
          aria-expanded={open}
          aria-haspopup="dialog"
          onMouseDown={captureSelectionBeforeOpen}
          onTouchStart={captureSelectionBeforeOpen}
        >
          <Smile className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(event) => {
          // Avoid stealing focus into a trap; search can still be focused by the user.
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onFocusOutside={(event) => {
          if (ignoreFocusOutsideRef.current) {
            event.preventDefault();
            ignoreFocusOutsideRef.current = false;
          }
        }}
        className={cn(
          "w-[min(100vw-1.5rem,22rem)] overflow-hidden p-0",
          "max-h-[min(22rem,var(--radix-popover-content-available-height,22rem))]",
        )}
      >
        <div className="flex h-[min(20rem,var(--radix-popover-content-available-height,20rem))] max-h-[min(20rem,calc(100dvh-8rem))] flex-col">
          {open ? (
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {t("chat.emojiLoading")}
                </div>
              }
            >
              <ChatComposerEmojiPickerPanel
                lang={lang}
                loadingLabel={t("chat.emojiLoading")}
                emptyLabel={t("chat.emojiEmpty")}
                searchPlaceholder={t("chat.searchEmoji")}
                onEmojiSelect={handleEmojiSelect}
              />
            </Suspense>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
