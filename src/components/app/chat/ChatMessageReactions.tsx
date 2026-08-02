import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  addChatMessageReaction,
  chatMessagesQueryKey,
  removeChatMessageReaction,
  type ChatMessage,
  type ChatMessageReaction,
  type ChatMessageReactionUser,
  type ChatMessagesPage,
} from "@/lib/api/chat";
import { getSelectedWorkspaceId } from "@/lib/api/client";
import {
  buildReactionAuthorTooltipLines,
  CHAT_REACTION_EMOJI,
} from "@/lib/chat/reactions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ReactionActions = {
  reactions: ChatMessageReaction[];
  pendingEmoji: string | null;
  toggleReaction: (emoji: string) => void;
  currentUserId: string;
  align: "start" | "end";
};

const ChatMessageReactionContext = createContext<ReactionActions | null>(null);

function useReactionActions() {
  const value = useContext(ChatMessageReactionContext);
  if (!value) {
    throw new Error("Chat message reaction components require ChatMessageReactionProvider");
  }
  return value;
}

/** Public hook for message action menus that sit inside the reaction provider. */
export function useChatMessageReactionActions() {
  return useReactionActions();
}

function sortReactions(reactions: ChatMessageReaction[]): ChatMessageReaction[] {
  const order = new Map(CHAT_REACTION_EMOJI.map((emoji, index) => [emoji, index]));
  return [...reactions].sort(
    (a, b) =>
      (order.get(a.emoji as (typeof CHAT_REACTION_EMOJI)[number]) ?? 99) -
      (order.get(b.emoji as (typeof CHAT_REACTION_EMOJI)[number]) ?? 99),
  );
}

function replaceMessageReactions(
  page: ChatMessagesPage,
  messageId: string,
  reactions: ChatMessageReaction[],
): ChatMessagesPage {
  return {
    ...page,
    messages: page.messages.map((item) =>
      item.id === messageId ? { ...item, reactions: sortReactions(reactions) } : item,
    ),
  };
}

function buildOptimisticReactions(
  current: ChatMessageReaction[],
  input: {
    emoji: string;
    remove: boolean;
    currentUserId: string;
    currentUser: ChatMessageReactionUser;
  },
): ChatMessageReaction[] {
  const optimisticRows = current.map((row) => ({
    ...row,
    userIds: [...row.userIds],
    reactedBy: [...(row.reactedBy ?? [])],
  }));
  const existingIndex = optimisticRows.findIndex((row) => row.emoji === input.emoji);

  if (input.remove) {
    if (existingIndex >= 0) {
      const row = optimisticRows[existingIndex]!;
      const nextUserIds = row.userIds.filter((id) => id !== input.currentUserId);
      const nextReactedBy = row.reactedBy.filter((user) => user.id !== input.currentUserId);
      if (nextUserIds.length === 0) {
        optimisticRows.splice(existingIndex, 1);
      } else {
        optimisticRows[existingIndex] = {
          ...row,
          userIds: nextUserIds,
          reactedBy: nextReactedBy,
          count: nextUserIds.length,
        };
      }
    }
  } else if (existingIndex >= 0) {
    const row = optimisticRows[existingIndex]!;
    if (!row.userIds.includes(input.currentUserId)) {
      const nextUserIds = [...row.userIds, input.currentUserId];
      const nextReactedBy = [...row.reactedBy, input.currentUser];
      optimisticRows[existingIndex] = {
        ...row,
        userIds: nextUserIds,
        reactedBy: nextReactedBy,
        count: nextUserIds.length,
      };
    }
  } else {
    optimisticRows.push({
      emoji: input.emoji,
      count: 1,
      userIds: [input.currentUserId],
      reactedBy: [input.currentUser],
    });
  }

  return sortReactions(optimisticRows);
}

type ProviderProps = {
  conversationId: string;
  message: ChatMessage;
  currentUserId: string;
  align?: "start" | "end";
  children: ReactNode;
};

export function ChatMessageReactionProvider({
  conversationId,
  message,
  currentUserId,
  align = "start",
  children,
}: ProviderProps) {
  const { t } = useI18n();
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);
  const workspaceId = getSelectedWorkspaceId();
  const messagesKey = chatMessagesQueryKey(workspaceId, conversationId);
  const reactions = message.reactions ?? [];

  const currentUserProfile: ChatMessageReactionUser = {
    id: currentUserId,
    name: me?.user.displayName?.trim() || me?.user.name || t("chat.you"),
    avatarUrl: me?.user.avatarUrl ?? null,
  };

  const mutation = useMutation({
    mutationFn: async (input: { emoji: string; remove: boolean }) => {
      if (input.remove) {
        return removeChatMessageReaction(conversationId, message.id, input.emoji);
      }
      return addChatMessageReaction(conversationId, message.id, input.emoji);
    },
    onMutate: async (input) => {
      setPendingEmoji(input.emoji);
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const previous = queryClient.getQueryData<ChatMessagesPage>(messagesKey);

      if (previous) {
        const optimisticRows = buildOptimisticReactions(message.reactions ?? [], {
          ...input,
          currentUserId,
          currentUser: currentUserProfile,
        });
        queryClient.setQueryData<ChatMessagesPage>(
          messagesKey,
          replaceMessageReactions(previous, message.id, optimisticRows),
        );
      }

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messagesKey, context.previous);
      }
      toast.error(t("chat.reactionFailed"));
    },
    onSuccess: (reactionsFromServer) => {
      queryClient.setQueryData<ChatMessagesPage>(messagesKey, (old) =>
        old ? replaceMessageReactions(old, message.id, reactionsFromServer) : old,
      );
    },
    onSettled: () => {
      setPendingEmoji(null);
    },
  });

  function toggleReaction(emoji: string) {
    if (pendingEmoji) {
      return;
    }
    const row = reactions.find((item) => item.emoji === emoji);
    const reactedByMe = Boolean(row?.userIds.includes(currentUserId));
    mutation.mutate({ emoji, remove: reactedByMe });
  }

  const value: ReactionActions = {
    reactions,
    pendingEmoji,
    currentUserId,
    align,
    toggleReaction,
  };

  return (
    <ChatMessageReactionContext.Provider value={value}>
      {children}
    </ChatMessageReactionContext.Provider>
  );
}

/** Compact emoji picker shown next to message actions. */
export function ChatMessageReactionPicker({
  alwaysVisible = false,
}: {
  alwaysVisible?: boolean;
}) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { reactions, pendingEmoji, toggleReaction, currentUserId, align } =
    useReactionActions();

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 shrink-0 text-muted-foreground/70 hover:text-foreground",
            !alwaysVisible &&
              "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
            pickerOpen && "opacity-100",
          )}
          aria-label={t("chat.addReaction")}
          disabled={Boolean(pendingEmoji)}
        >
          <SmilePlus className="size-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align === "end" ? "end" : "start"}
        side="top"
        collisionPadding={12}
        className="w-auto max-w-[calc(100vw-1.5rem)] p-1.5"
        aria-label={t("chat.messageReactions")}
      >
        <div
          className="flex flex-wrap items-center gap-0.5"
          role="group"
          aria-label={t("chat.messageReactions")}
        >
          {CHAT_REACTION_EMOJI.map((emoji) => {
            const reactedByMe = Boolean(
              reactions.find((row) => row.emoji === emoji)?.userIds.includes(currentUserId),
            );
            return (
              <button
                key={emoji}
                type="button"
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-md text-base transition hover:bg-muted",
                  reactedByMe && "bg-primary/15",
                )}
                aria-label={reactedByMe ? t("chat.removeReaction") : t("chat.addReaction")}
                aria-pressed={reactedByMe}
                disabled={Boolean(pendingEmoji)}
                onClick={() => {
                  toggleReaction(emoji);
                  setPickerOpen(false);
                }}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ReactionChipTooltipBody({
  emoji,
  lines,
}: {
  emoji: string;
  lines: string[];
}) {
  return (
    <div className="max-w-48 space-y-1">
      <div className="text-sm leading-none">{emoji}</div>
      <ul className="space-y-0.5">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} className="truncate text-xs leading-snug">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Reaction chips rendered under the message bubble. */
export function ChatMessageReactionChips() {
  const { t } = useI18n();
  const { reactions, pendingEmoji, toggleReaction, currentUserId, align } =
    useReactionActions();
  const [authorsOpenEmoji, setAuthorsOpenEmoji] = useState<string | null>(null);
  const longPressConsumedRef = useRef(false);

  if (reactions.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          "mt-1.5 flex max-w-full flex-wrap items-center gap-1",
          align === "end" ? "justify-end" : "justify-start",
        )}
        data-no-message-long-press=""
      >
        {reactions.map((reaction) => {
          const reactedByMe = reaction.userIds.includes(currentUserId);
          const isPending = pendingEmoji === reaction.emoji;
          const authorLines = buildReactionAuthorTooltipLines({
            reactedBy: reaction.reactedBy ?? [],
            currentUserId,
            youLabel: t("chat.you"),
            andMoreLabel: (count) =>
              t("chat.reactionAndMore").replace("{count}", String(count)),
          });
          const actionLabel = reactedByMe ? t("chat.removeReaction") : t("chat.addReaction");
          const ariaLabel =
            authorLines.length > 0
              ? `${reaction.emoji}. ${authorLines.join(", ")}. ${actionLabel}`
              : actionLabel;

          return (
            <Popover
              key={reaction.emoji}
              open={authorsOpenEmoji === reaction.emoji}
              onOpenChange={(open) => {
                setAuthorsOpenEmoji(open ? reaction.emoji : null);
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverAnchor asChild>
                    <button
                      type="button"
                      disabled={Boolean(pendingEmoji)}
                      aria-label={ariaLabel}
                      aria-pressed={reactedByMe}
                      className={cn(
                        "inline-flex h-7 min-h-7 items-center gap-1 rounded-full border px-2 text-[11px] tabular-nums transition",
                        reactedByMe
                          ? "border-primary/40 bg-primary/15 text-foreground"
                          : "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted/60",
                        isPending && "opacity-60",
                      )}
                      onClick={() => {
                        if (longPressConsumedRef.current) {
                          longPressConsumedRef.current = false;
                          return;
                        }
                        toggleReaction(reaction.emoji);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setAuthorsOpenEmoji(reaction.emoji);
                      }}
                      onPointerDown={(event) => {
                        if (event.pointerType !== "touch") {
                          return;
                        }
                        const target = event.currentTarget;
                        const timer = window.setTimeout(() => {
                          longPressConsumedRef.current = true;
                          setAuthorsOpenEmoji(reaction.emoji);
                        }, 450);
                        const clear = () => {
                          window.clearTimeout(timer);
                          target.removeEventListener("pointerup", clear);
                          target.removeEventListener("pointercancel", clear);
                          target.removeEventListener("pointerleave", clear);
                        };
                        target.addEventListener("pointerup", clear);
                        target.addEventListener("pointercancel", clear);
                        target.addEventListener("pointerleave", clear);
                      }}
                    >
                      <span aria-hidden="true">{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </button>
                  </PopoverAnchor>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  collisionPadding={12}
                  className="max-w-[min(16rem,calc(100vw-1.5rem))] bg-popover px-2.5 py-2 text-popover-foreground shadow-md"
                >
                  <ReactionChipTooltipBody emoji={reaction.emoji} lines={authorLines} />
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                side="top"
                align={align === "end" ? "end" : "start"}
                collisionPadding={12}
                className="w-auto max-w-[min(16rem,calc(100vw-1.5rem))] p-2.5"
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {t("chat.reactionAuthors")}
                </p>
                <ReactionChipTooltipBody emoji={reaction.emoji} lines={authorLines} />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
