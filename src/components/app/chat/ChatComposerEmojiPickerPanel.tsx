import { EmojiPicker } from "frimousse";

import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";

type ChatComposerEmojiPickerPanelProps = {
  lang: Lang;
  loadingLabel: string;
  emptyLabel: string;
  searchPlaceholder: string;
  onEmojiSelect: (emoji: string) => void;
  className?: string;
};

/**
 * Frimousse panel for the chat composer. Loaded lazily so the main chat chunk
 * does not pay for emoji data / picker code until the user opens it.
 */
export function ChatComposerEmojiPickerPanel({
  lang,
  loadingLabel,
  emptyLabel,
  searchPlaceholder,
  onEmojiSelect,
  className,
}: ChatComposerEmojiPickerPanelProps) {
  return (
    <EmojiPicker.Root
      locale={lang === "ru" ? "ru" : "en"}
      columns={8}
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-popover text-popover-foreground",
        className,
      )}
      onEmojiSelect={({ emoji }) => {
        onEmojiSelect(emoji);
      }}
    >
      <EmojiPicker.Search
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="z-10 mx-2 mt-2 h-9 shrink-0 appearance-none rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      />
      <EmojiPicker.Viewport className="relative min-h-0 flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {loadingLabel}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1.5"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className="bg-popover px-3 pt-2.5 pb-1 text-xs font-medium text-muted-foreground"
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1.5 px-1.5" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                type="button"
                className="flex size-9 items-center justify-center rounded-md text-lg outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/25 data-active:bg-accent"
                aria-label={emoji.label}
              >
                <span aria-hidden="true">{emoji.emoji}</span>
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
