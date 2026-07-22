import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    name: me?.displayName?.trim() || me?.name || t("chat.you"),
    avatarUrl: me?.avatarUrl ?? null,
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
export function ChatMessageReactionPicker() {
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
            "size-5 shrink-0 text-muted-foreground/70 hover:text-foreground",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
            pickerOpen && "opacity-100",
          )}
          aria-label={t("chat.addReaction")}
          disabled={Boolean(pendingEmoji)}
        >
          <SmilePlus className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align === "end" ? "end" : "start"}
        side="top"
        className="w-auto p-1.5"
        aria-label={t("chat.messageReactions")}
      >
        <div
          className="flex items-center gap-0.5"
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
                  "inline-flex size-8 items-center justify-center rounded-md text-base transition hover:bg-muted",
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

  if (reactions.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          "mt-1.5 flex flex-wrap items-center gap-1",
          align === "end" ? "justify-end" : "justify-start",
        )}
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
            <Tooltip key={reaction.emoji}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={Boolean(pendingEmoji)}
                  aria-label={ariaLabel}
                  aria-pressed={reactedByMe}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-[11px] tabular-nums transition",
                    reactedByMe
                      ? "border-primary/40 bg-primary/15 text-foreground"
                      : "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted/60",
                    isPending && "opacity-60",
                  )}
                  onClick={() => toggleReaction(reaction.emoji)}
                >
                  <span aria-hidden="true">{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-popover px-2.5 py-2 text-popover-foreground shadow-md"
              >
                <ReactionChipTooltipBody emoji={reaction.emoji} lines={authorLines} />
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
