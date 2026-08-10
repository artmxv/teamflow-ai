import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EmojiPicker } from "frimousse";

import { getRecentEmojis, pushRecentEmoji } from "@/lib/chat/recent-emoji";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChatComposerEmojiPickerPanelProps = {
  lang: Lang;
  loadingLabel: string;
  emptyLabel: string;
  searchPlaceholder: string;
  categoryLabels: CategoryTabLabels;
  categoriesAriaLabel: string;
  onEmojiSelect: (emoji: string) => void;
  className?: string;
};

export type CategoryTabId =
  | "recent"
  | "smileys"
  | "animals"
  | "food"
  | "activity"
  | "travel"
  | "objects"
  | "symbols";

export type CategoryTabLabels = Record<CategoryTabId, string>;

type CategoryTabDef = {
  id: CategoryTabId;
  /** Representative emoji shown on the tab button. */
  icon: string;
  /** Localized frimousse category header labels that map to this tab. */
  matchLabels: readonly string[];
};

/**
 * Tab order for the picker. Labels from emojibase (en/ru) are matched to tabs.
 * people-body → smileys, flags → symbols (8 tabs as requested, not all emojibase groups).
 */
const CATEGORY_TABS: readonly CategoryTabDef[] = [
  { id: "recent", icon: "🕒", matchLabels: [] },
  {
    id: "smileys",
    icon: "😀",
    matchLabels: ["smileys & emotion", "people & body", "смайлики и люди", "тело людей"],
  },
  {
    id: "animals",
    icon: "🐻",
    matchLabels: ["animals & nature", "животные и природа"],
  },
  {
    id: "food",
    icon: "🍔",
    matchLabels: ["food & drink", "еда и напитки"],
  },
  {
    id: "activity",
    icon: "⚽",
    matchLabels: ["activities", "варианты досуга"],
  },
  {
    id: "travel",
    icon: "✈️",
    matchLabels: ["travel & places", "путешествия и местности"],
  },
  {
    id: "objects",
    icon: "💡",
    matchLabels: ["objects", "предметы"],
  },
  {
    id: "symbols",
    icon: "🔣",
    matchLabels: ["symbols", "flags", "символы", "флаг"],
  },
];

const LABEL_TO_TAB_ID = new Map<string, CategoryTabId>();
for (const tab of CATEGORY_TABS) {
  for (const label of tab.matchLabels) {
    LABEL_TO_TAB_ID.set(label.toLowerCase(), tab.id);
  }
}

function isCategoryTabId(value: string): value is CategoryTabId {
  return CATEGORY_TABS.some((tab) => tab.id === value);
}

function resolveTabIdFromLabel(label: string): CategoryTabId | null {
  return LABEL_TO_TAB_ID.get(label.trim().toLowerCase()) ?? null;
}

function findCategoryElement(root: HTMLElement, tabId: CategoryTabId): HTMLElement | null {
  const headers = root.querySelectorAll<HTMLElement>("[frimousse-category-header]");
  for (const header of headers) {
    const headerTabId =
      header.dataset.emojiCategoryTab ?? resolveTabIdFromLabel(header.textContent?.trim() ?? "");
    if (headerTabId === tabId) {
      return header.closest<HTMLElement>("[frimousse-category]");
    }
  }
  return null;
}

/**
 * Frimousse panel for the chat composer. Loaded lazily so the main chat chunk
 * does not pay for emoji data / picker code until the user opens it.
 */
export function ChatComposerEmojiPickerPanel({
  lang,
  loadingLabel,
  emptyLabel,
  searchPlaceholder,
  categoryLabels,
  categoriesAriaLabel,
  onEmojiSelect,
  className,
}: ChatComposerEmojiPickerPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const ignoreScrollSyncRef = useRef(false);
  const scrollSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollTabRef = useRef<CategoryTabId | null>(null);

  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>(() => getRecentEmojis());
  const [activeTab, setActiveTab] = useState<CategoryTabId>(() =>
    getRecentEmojis().length > 0 ? "recent" : "smileys",
  );

  const isSearching = search.trim().length > 0;
  const showRecentTab = recent.length > 0;
  const showRecentPanel = !isSearching && showRecentTab && activeTab === "recent";
  const showEmojiList = isSearching || !showRecentPanel;

  const visibleTabs = CATEGORY_TABS.filter((tab) => tab.id !== "recent" || showRecentTab);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setRecent(pushRecentEmoji(emoji));
      onEmojiSelect(emoji);
    },
    [onEmojiSelect],
  );

  const syncActiveTabFromScroll = useCallback(() => {
    if (ignoreScrollSyncRef.current || isSearching || showRecentPanel) {
      return;
    }

    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) {
      return;
    }

    const headers = root.querySelectorAll<HTMLElement>("[frimousse-category-header]");
    const viewportTop = viewport.getBoundingClientRect().top;
    let current: CategoryTabId | null = null;

    for (const header of headers) {
      const rect = header.getBoundingClientRect();
      // Sticky headers sit at the top of the viewport while their section is active.
      if (rect.top <= viewportTop + 8) {
        const dataTabId = header.dataset.emojiCategoryTab;
        const tabId =
          dataTabId && isCategoryTabId(dataTabId)
            ? dataTabId
            : resolveTabIdFromLabel(header.textContent?.trim() ?? "");
        if (tabId) {
          current = tabId;
        }
      }
    }

    if (current) {
      setActiveTab(current);
    }
  }, [isSearching, showRecentPanel]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !showEmojiList) {
      return;
    }

    const onScroll = () => {
      syncActiveTabFromScroll();
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [showEmojiList, syncActiveTabFromScroll]);

  useEffect(() => {
    return () => {
      if (scrollSyncTimerRef.current) {
        clearTimeout(scrollSyncTimerRef.current);
      }
    };
  }, []);

  // Keep the active category tab visible inside the horizontally scrollable row.
  useEffect(() => {
    if (isSearching) {
      return;
    }
    const tabList = tabListRef.current;
    if (!tabList) {
      return;
    }
    const activeButton = tabList.querySelector<HTMLElement>('[aria-selected="true"]');
    activeButton?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeTab, isSearching, showRecentTab]);

  // Scroll after React paints so the list is visible when leaving the Recent panel.
  useLayoutEffect(() => {
    const tabId = pendingScrollTabRef.current;
    if (!tabId || tabId === "recent") {
      return;
    }

    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport || !showEmojiList) {
      return;
    }

    pendingScrollTabRef.current = null;
    ignoreScrollSyncRef.current = true;

    const categoryEl = findCategoryElement(root, tabId);
    if (categoryEl) {
      viewport.scrollTo({ top: categoryEl.offsetTop, behavior: "smooth" });
    }

    if (scrollSyncTimerRef.current) {
      clearTimeout(scrollSyncTimerRef.current);
    }
    scrollSyncTimerRef.current = setTimeout(() => {
      ignoreScrollSyncRef.current = false;
      syncActiveTabFromScroll();
    }, 450);
  }, [activeTab, showEmojiList, syncActiveTabFromScroll]);

  function handleTabClick(tabId: CategoryTabId) {
    if (search) {
      setSearch("");
    }

    setActiveTab(tabId);

    if (tabId === "recent") {
      pendingScrollTabRef.current = null;
      return;
    }

    // If the list is already visible, scroll in the layout effect after this paint.
    pendingScrollTabRef.current = tabId;
  }

  return (
    <EmojiPicker.Root
      ref={rootRef}
      locale={lang === "ru" ? "ru" : "en"}
      columns={8}
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-popover text-popover-foreground",
        className,
      )}
      onEmojiSelect={({ emoji }) => {
        handleEmojiSelect(emoji);
      }}
    >
      <EmojiPicker.Search
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="z-10 mx-2 mt-2 h-9 shrink-0 appearance-none rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      />

      {!isSearching ? (
        <div
          ref={tabListRef}
          role="tablist"
          aria-label={categoriesAriaLabel}
          className={cn(
            // min-w-0 + w-full: allow this flex child to shrink so overflow-x can scroll
            // (otherwise tabs grow past the popover and get clipped with no scroll).
            "app-scrollbar flex w-full min-w-0 shrink-0 gap-1 overflow-x-auto overscroll-x-contain",
            "touch-pan-x px-2 pt-2 pb-1.5",
          )}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const label = categoryLabels[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                title={label}
                aria-label={label}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 grow-0 items-center gap-1 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  {tab.icon}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {showRecentPanel ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pt-1 pb-1.5">
          <div className="grid grid-cols-8 gap-0">
            {recent.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex size-9 items-center justify-center rounded-md text-lg outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/25"
                aria-label={emoji}
                onClick={() => handleEmojiSelect(emoji)}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <EmojiPicker.Viewport
        ref={viewportRef}
        className={cn("relative min-h-0 flex-1 outline-none", showEmojiList ? null : "hidden")}
      >
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {loadingLabel}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1.5"
          components={{
            CategoryHeader: ({ category, ...props }) => {
              const tabId = resolveTabIdFromLabel(category.label);
              return (
                <div
                  {...props}
                  className="bg-popover px-3 pt-2.5 pb-1 text-xs font-medium text-muted-foreground"
                  data-emoji-category-tab={tabId ?? undefined}
                >
                  {category.label}
                </div>
              );
            },
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
