import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Loader2, Pin, PinOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  chatPinnedMessagesQueryKey,
  getPinnedChatMessages,
  pinChatMessage,
  unpinChatMessage,
  updateChatMessagesCache,
  type ChatMessage,
  type ChatMessagePin,
  type ChatMessagesPage,
} from "@/lib/api/chat";
import { buildPinnedMessagePreview } from "@/lib/chat/pins";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function formatPinnedTimestamp(iso: string, lang: Lang) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function applyPinToMessagesPage(
  page: ChatMessagesPage,
  messageId: string,
  pin: ChatMessagePin | null,
): ChatMessagesPage {
  return {
    ...page,
    messages: page.messages.map((message) =>
      message.id === messageId ? { ...message, pin } : message,
    ),
  };
}

function applyPinToPinnedList(
  current: { messages: ChatMessage[] } | undefined,
  message: ChatMessage,
  pin: ChatMessagePin | null,
): { messages: ChatMessage[] } {
  const existing = current?.messages ?? [];
  if (pin === null) {
    return {
      messages: existing.filter((item) => item.id !== message.id),
    };
  }

  const nextMessage = { ...message, pin };
  const without = existing.filter((item) => item.id !== message.id);
  const merged = [...without, nextMessage].sort((a, b) => {
    const aAt = a.pin?.pinnedAt ?? "";
    const bAt = b.pin?.pinnedAt ?? "";
    const timeDiff = new Date(bAt).getTime() - new Date(aAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });
  return { messages: merged };
}

/** Compact pin / unpin control next to other message actions. */
export function ChatMessagePinButton({
  conversationId,
  message,
  workspaceId,
  alwaysVisible = false,
  asMenuItem = false,
  onDone,
}: {
  conversationId: string;
  message: ChatMessage;
  workspaceId: string;
  alwaysVisible?: boolean;
  asMenuItem?: boolean;
  onDone?: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const isPinned = Boolean(message.pin);
  const pinnedKey = chatPinnedMessagesQueryKey(workspaceId, conversationId);
  const label = isPinned ? t("chat.unpinMessage") : t("chat.pinMessage");

  const mutation = useMutation({
    mutationFn: async () => {
      if (isPinned) {
        await unpinChatMessage(conversationId, message.id);
        return null as ChatMessagePin | null;
      }
      return pinChatMessage(conversationId, message.id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["chat-messages", workspaceId, conversationId],
      });
      await queryClient.cancelQueries({ queryKey: pinnedKey });
    },
    onSuccess: (pin) => {
      updateChatMessagesCache(queryClient, conversationId, (old) =>
        applyPinToMessagesPage(old, message.id, pin),
      );
      queryClient.setQueryData<{ messages: ChatMessage[] }>(pinnedKey, (old) =>
        applyPinToPinnedList(old, message, pin),
      );
      toast.success(pin ? t("chat.messagePinned") : t("chat.messageUnpinned"));
      onDone?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("chat.pinMessageFailed"));
      void queryClient.invalidateQueries({
        queryKey: ["chat-messages", workspaceId, conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: pinnedKey });
    },
  });

  if (asMenuItem) {
    return (
      <DropdownMenuItem
        className="gap-2"
        disabled={mutation.isPending}
        onSelect={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : isPinned ? (
          <PinOff className="size-4" aria-hidden="true" />
        ) : (
          <Pin className="size-4" aria-hidden="true" />
        )}
        {label}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-7 shrink-0 text-muted-foreground/70 hover:text-foreground",
        !alwaysVisible &&
          "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
        isPinned && "opacity-100 text-foreground/80",
        mutation.isPending && "opacity-100",
      )}
      aria-label={label}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : isPinned ? (
        <PinOff className="size-3.5" aria-hidden="true" />
      ) : (
        <Pin className="size-3.5" aria-hidden="true" />
      )}
    </Button>
  );
}

/** Subtle "Pinned" indicator on a message bubble. */
export function ChatMessagePinBadge({ pin }: { pin: ChatMessagePin }) {
  const { t } = useI18n();
  const label = `${t("chat.pinnedBy")}: ${pin.pinnedBy.name}`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mb-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Pin className="size-3 shrink-0" aria-hidden="true" />
            <span>{t("chat.pinnedLabel")}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type ChatPinnedMessagesPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  workspaceId: string;
  onSelectMessage: (messageId: string) => void;
};

/** Compact sheet listing pinned messages for the active conversation. */
export function ChatPinnedMessagesPanel({
  open,
  onOpenChange,
  conversationId,
  workspaceId,
  onSelectMessage,
}: ChatPinnedMessagesPanelProps) {
  const { t, lang } = useI18n();
  const pinnedKey = chatPinnedMessagesQueryKey(workspaceId, conversationId);

  const pinnedQuery = useQuery({
    queryKey: pinnedKey,
    queryFn: () => getPinnedChatMessages(conversationId),
    enabled: open && Boolean(workspaceId && conversationId),
    staleTime: 30_000,
  });

  const messages = pinnedQuery.data?.messages ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 px-4 py-3 pr-12 text-left">
          <SheetTitle className="truncate text-sm">{t("chat.pinnedMessages")}</SheetTitle>
          <SheetDescription className="sr-only">{t("chat.pinnedMessages")}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2" role="list">
          {pinnedQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("common.loading")}
            </div>
          ) : pinnedQuery.isError ? (
            <div className="space-y-2 px-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">{t("chat.errorTitle")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void pinnedQuery.refetch()}
              >
                {t("chat.retry")}
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t("chat.noPinnedMessages")}
            </p>
          ) : (
            messages.map((message) => {
              const preview = buildPinnedMessagePreview(message, {
                image: t("chat.pinnedPreviewImage"),
                file: t("chat.pinnedPreviewFile"),
                task: t("chat.pinnedPreviewTask"),
                project: t("chat.pinnedPreviewProject"),
              });
              const pinnedBy = message.pin?.pinnedBy.name ?? "";
              const messageAt = formatPinnedTimestamp(message.createdAt, lang);
              const pinnedAt = message.pin
                ? formatPinnedTimestamp(message.pin.pinnedAt, lang)
                : "";

              return (
                <button
                  key={message.id}
                  type="button"
                  role="listitem"
                  className="flex min-h-11 w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onSelectMessage(message.id)}
                >
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-medium text-foreground">
                      {message.sender.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {messageAt}
                    </span>
                  </div>
                  <p className="line-clamp-2 break-words text-sm text-foreground/90">
                    {preview || t("chat.noPreview")}
                  </p>
                  {message.pin ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t("chat.pinnedBy")}: {pinnedBy}
                      {pinnedAt ? ` · ${pinnedAt}` : ""}
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Header button that opens the pinned messages panel. */
export function ChatPinnedMessagesHeaderButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  const label = t("chat.pinnedMessages");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 shrink-0 sm:size-8"
      title={label}
      aria-label={label}
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
    >
      {open ? (
        <BookmarkCheck className="size-4" aria-hidden="true" />
      ) : (
        <Bookmark className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}

/** Temporary highlight class helper for jump-to-message. */
export function useTemporaryMessageHighlight(durationMs = 1600) {
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedMessageId) {
      return;
    }
    const timer = window.setTimeout(() => {
      setHighlightedMessageId(null);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [highlightedMessageId, durationMs]);

  return { highlightedMessageId, setHighlightedMessageId };
}
