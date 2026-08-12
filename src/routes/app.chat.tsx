import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type UIEvent,
} from "react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/auth/route-guards";
import { isWorkspaceManager, useCurrentUser } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { MemberProfileDrawer } from "@/components/app/MemberProfileDrawer";
import { UserAvatar } from "@/components/app/UserAvatar";
import { NewDirectMessageDialog } from "@/components/app/chat/NewDirectMessageDialog";
import { NewChannelDialog } from "@/components/app/chat/NewChannelDialog";
import { ChatConversationHeader } from "@/components/app/chat/ChatConversationHeader";
import { ChatMessageActions } from "@/components/app/chat/ChatMessageActions";
import { ChatMessageAttachments } from "@/components/app/chat/ChatMessageAttachments";
import {
  ChatMessageReactionChips,
  ChatMessageReactionProvider,
} from "@/components/app/chat/ChatMessageReactions";
import {
  ChatMessagePinBadge,
  ChatPinnedMessagesPanel,
  useTemporaryMessageHighlight,
} from "@/components/app/chat/ChatMessagePins";
import { ChatOnlineDot } from "@/components/app/chat/ChatOnlineDot";
import {
  ChatAttachMenu,
  ChatPendingAttachmentChips,
} from "@/components/app/chat/ChatComposerAttachments";
import { ChatComposerEmojiPicker } from "@/components/app/chat/ChatComposerEmojiPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  buildChatAttachmentPreviewLabel,
  CHAT_CONVERSATIONS_FALLBACK_POLL_MS,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_MESSAGES_FALLBACK_POLL_MS,
  CHAT_MESSAGES_PAGE_SIZE,
  chatConversationsQueryKey,
  chatMessagesQueryKey,
  chatPinnedMessagesQueryKey,
  conversationDisplayName,
  deleteChatMessage,
  encodeChatCursor,
  fetchChatConversations,
  fetchChatMessages,
  markConversationRead,
  mergeChatMessages,
  renameChatConversation,
  resolveInitialConversationId,
  sendChatMessage,
  setConversationPinned,
  updateChatConversationsCache,
  updateChatMessagesCache,
  validateChatDraft,
  localizeChatPreviewContent,
  type ChatConversation,
  type ChatMessage,
  type ChatMessagesPage,
  type PendingChatFile,
  type PendingChatProject,
  type PendingChatTask,
} from "@/lib/api/chat";
import {
  focusChatComposer,
  isFocusInsideAttachmentPicker,
  shouldRestoreComposerFocus,
  shouldSubmitOnComposerKeyDown,
} from "@/lib/chat/composer-focus";
import {
  CHAT_CONVERSATION_TITLE_MAX_LENGTH,
  validateChatConversationTitle,
} from "@/lib/chat/conversation-title";
import { shouldShowDirectPresence } from "@/lib/chat/presence";
import {
  isMessageLongPressPointer,
  MESSAGE_LONG_PRESS_MOVE_PX,
  MESSAGE_LONG_PRESS_MS,
  shouldIgnoreMessageLongPress,
} from "@/lib/chat/message-long-press";
import { resolveInitialScrollTarget } from "@/lib/chat/scroll";
import { getSelectedWorkspaceId } from "@/lib/api/client";
import { friendlyChatErrorMessage } from "@/lib/chat-errors";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  getChatSocketStatus,
  isChatSocketConnected,
  setOpenChatConversationId,
  subscribeChatSocketStatus,
} from "@/lib/realtime/chat-socket-state";
import { useIsUserOnline } from "@/lib/realtime/use-chat-presence";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  Hash,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Search,
  Send,
  SquarePen,
  Users,
} from "lucide-react";

export type ChatSearch = {
  conversation?: string;
};

export const Route = createFileRoute("/app/chat")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    conversation:
      typeof search.conversation === "string" && search.conversation.length > 0
        ? search.conversation
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Chat — TeamFlow AI" }] }),
  component: WorkspaceChatPage,
});

const NEAR_BOTTOM_PX = 80;
const COMPOSER_COUNTER_SOFT_LIMIT = 1800;
const COMPOSER_MAX_HEIGHT_PX = 160;

function formatChatTimestamp(iso: string, lang: Lang) {
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

function formatSidebarTime(iso: string | null, lang: Lang, justNow: string) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs >= 0 && diffMs < 60_000) {
    return justNow;
  }

  const sameDay = new Date(now).toDateString() === date.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function ChatTimestamp({ iso }: { iso: string }) {
  const { lang } = useI18n();
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(formatChatTimestamp(iso, lang));
  }, [iso, lang]);

  return (
    <time dateTime={iso} className="text-[11px] text-muted-foreground/80" suppressHydrationWarning>
      {label || "\u00a0"}
    </time>
  );
}

function SidebarTime({ iso }: { iso: string | null }) {
  const { lang, t } = useI18n();
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(formatSidebarTime(iso, lang, t("chat.justNow")));
  }, [iso, lang, t]);

  return (
    <span
      className="shrink-0 text-[10px] text-muted-foreground tabular-nums"
      suppressHydrationWarning
    >
      {label}
    </span>
  );
}

/** Two-column chat layout from xl (~1280px). Below that: list OR conversation. */
function useIsDesktopXl() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(min-width: 1280px)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => true,
  );
}

function WorkspaceChatPage() {
  const { t } = useI18n();
  const { data: me } = useCurrentUser();
  const user = me?.user;
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const { conversation: conversationFromUrl } = Route.useSearch();
  const workspaceId = me?.workspace?.id ?? getSelectedWorkspaceId();
  const isDesktop = useIsDesktopXl();

  const [directDialogOpen, setDirectDialogOpen] = useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [conversationFilter, setConversationFilter] = useState("");
  const [mobileShowList, setMobileShowList] = useState(!conversationFromUrl);

  const conversationsQueryKey = useMemo(
    () => chatConversationsQueryKey(workspaceId),
    [workspaceId],
  );

  const socketStatus = useSyncExternalStore(
    subscribeChatSocketStatus,
    getChatSocketStatus,
    () => "idle" as const,
  );

  const conversationsQuery = useQuery({
    queryKey: conversationsQueryKey,
    queryFn: fetchChatConversations,
    enabled: Boolean(workspaceId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
      }
      if (query.state.error) {
        return false;
      }
      if (isChatSocketConnected()) {
        return false;
      }
      return CHAT_CONVERSATIONS_FALLBACK_POLL_MS;
    },
  });

  const conversations = conversationsQuery.data ?? [];

  const selectedConversationId = useMemo(() => {
    if (!conversations.length) {
      return null;
    }

    if (conversationFromUrl) {
      const match = conversations.some((item) => item.id === conversationFromUrl);
      if (match) {
        return conversationFromUrl;
      }
    }

    // Mobile list without a conversation in the URL: do not auto-open a chat.
    if (!isDesktop && !conversationFromUrl) {
      return null;
    }

    return resolveInitialConversationId({
      requestedId: conversationFromUrl,
      conversations,
    });
  }, [conversationFromUrl, conversations, isDesktop]);

  useEffect(() => {
    setOpenChatConversationId(selectedConversationId);
    return () => {
      setOpenChatConversationId(null);
    };
  }, [selectedConversationId]);

  const selectedConversation =
    conversations.find((item) => item.id === selectedConversationId) ?? null;

  useEffect(() => {
    if (!conversationsQuery.isSuccess || conversations.length === 0) {
      return;
    }

    if (!isDesktop && mobileShowList && !conversationFromUrl) {
      return;
    }

    // On mobile, only sync the URL when a conversation is already selected in the URL
    // or the messages pane is open — never force-open from the list.
    if (!isDesktop && !conversationFromUrl) {
      return;
    }

    const resolved = resolveInitialConversationId({
      requestedId: conversationFromUrl,
      conversations,
    });

    if (!resolved) {
      return;
    }

    if (resolved !== conversationFromUrl) {
      void navigate({
        search: { conversation: resolved },
        replace: true,
      });
    }
  }, [
    conversations,
    conversationsQuery.isSuccess,
    conversationFromUrl,
    isDesktop,
    mobileShowList,
    navigate,
  ]);

  useEffect(() => {
    if (conversationFromUrl) {
      setMobileShowList(false);
    } else {
      setMobileShowList(true);
    }
  }, [conversationFromUrl]);

  function selectConversation(conversationId: string) {
    const fromMobileList = !isDesktop && mobileShowList;
    setMobileShowList(false);
    void navigate({
      search: { conversation: conversationId },
      replace: !fromMobileList,
    });
  }

  function handleBackToList() {
    // Keep conversationId in the URL; only switch the mobile view back to the list.
    setMobileShowList(true);
  }

  const showSidebar = isDesktop || mobileShowList || !selectedConversationId;
  const showMessages = isDesktop || (!mobileShowList && Boolean(selectedConversationId));

  const filteredConversations = useMemo(() => {
    const normalized = conversationFilter.trim().toLowerCase();
    if (!normalized) {
      return conversations;
    }
    return conversations.filter((item) => {
      const name = conversationDisplayName(item, t("chat.generalChat")).toLowerCase();
      const preview = item.latestMessage?.content.toLowerCase() ?? "";
      return name.includes(normalized) || preview.includes(normalized);
    });
  }, [conversationFilter, conversations, t]);

  const pinned = filteredConversations.filter((item) => item.isPinned);
  const unpinned = filteredConversations.filter((item) => !item.isPinned);
  const canRenameGeneral = isWorkspaceManager(me?.workspace?.role);

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      setConversationPinned(id, isPinned),
    onMutate: async ({ id, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: conversationsQueryKey });
      const previous = queryClient.getQueryData<ChatConversation[]>(conversationsQueryKey);
      updateChatConversationsCache(queryClient, (old) =>
        old.map((item) => (item.id === id ? { ...item, isPinned } : item)),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(conversationsQueryKey, context.previous);
      }
      toast.error(friendlyChatErrorMessage(error, t, "chat.pinFailed"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  return (
    <AppShell>
      <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("chat.chats")}
          </h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{t("chat.subtitle")}</p>
        </div>
        <ChatRealtimeStatus status={socketStatus} />
      </div>

      <div className="relative flex h-[calc(100dvh-8.5rem)] min-h-0 overflow-hidden rounded-2xl border border-border bg-card shadow-soft sm:h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-11rem)] md:min-h-112">
        {conversationsQuery.isLoading ? (
          <ChatPageSkeleton />
        ) : conversationsQuery.isError ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <ApiErrorState
              titleKey="chat.conversationsErrorTitle"
              error={conversationsQuery.error}
              onRetry={() => void conversationsQuery.refetch()}
              isRetrying={conversationsQuery.isFetching}
              compact
            />
          </div>
        ) : (
          <>
            <aside
              className={cn(
                "flex w-full min-w-0 flex-col border-border xl:w-[300px] xl:shrink-0 xl:border-r",
                showSidebar ? "flex" : "hidden",
                isDesktop && "flex",
              )}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-3">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="filter-search-icon pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    value={conversationFilter}
                    onChange={(event) => setConversationFilter(event.target.value)}
                    placeholder={t("chat.searchConversations")}
                    aria-label={t("chat.searchConversations")}
                    className="filter-search-input w-full pl-9 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="brand"
                  className="size-10 shrink-0 rounded-lg shadow-sm"
                  aria-label={t("chat.newMessage")}
                  title={t("chat.newMessage")}
                  onClick={() => setDirectDialogOpen(true)}
                >
                  <SquarePen className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-10 shrink-0 rounded-lg border-auxiliary/30 bg-auxiliary/8 text-auxiliary hover:bg-auxiliary/14"
                  aria-label={t("chat.createChannel")}
                  title={t("chat.createChannel")}
                  onClick={() => setChannelDialogOpen(true)}
                >
                  <Users className="size-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
                {filteredConversations.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title={
                      conversationFilter.trim()
                        ? t("chat.noSearchResults")
                        : t("chat.noConversations")
                    }
                    description={
                      conversationFilter.trim()
                        ? t("chat.noSearchResultsHint")
                        : t("chat.noConversationsHint")
                    }
                    compact
                    className="border-0 bg-transparent py-8 shadow-none"
                  />
                ) : (
                  <div className="px-2 py-2">
                    <ul className="space-y-0.5">
                      {[...pinned, ...unpinned].map((item) => (
                        <ConversationRow
                          key={item.id}
                          conversation={item}
                          active={item.id === selectedConversationId}
                          currentUserId={user?.id}
                          onSelect={() => selectConversation(item.id)}
                          onTogglePin={() =>
                            pinMutation.mutate({ id: item.id, isPinned: !item.isPinned })
                          }
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>

            <section
              className={cn(
                "relative min-w-0 flex-1 flex-col overflow-hidden",
                showMessages ? "flex" : "hidden",
                isDesktop && "flex",
              )}
            >
              {selectedConversation && selectedConversationId ? (
                <ConversationMessagePane
                  key={selectedConversationId}
                  conversation={selectedConversation}
                  conversationId={selectedConversationId}
                  workspaceId={workspaceId}
                  currentUserId={user?.id}
                  canRenameGeneral={canRenameGeneral}
                  showBackButton={!isDesktop}
                  onBack={handleBackToList}
                  onPinnedChange={(isPinned) =>
                    pinMutation.mutate({ id: selectedConversationId, isPinned })
                  }
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-6">
                  <EmptyState
                    icon={Users}
                    title={t("chat.selectConversation")}
                    description={t("chat.selectConversationHint")}
                    compact
                    className="max-w-md border-0 bg-transparent shadow-none"
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {user ? (
        <>
          <NewDirectMessageDialog
            open={directDialogOpen}
            onOpenChange={setDirectDialogOpen}
            currentUserId={user.id}
            onConversationReady={(conversation) => selectConversation(conversation.id)}
          />
          <NewChannelDialog
            open={channelDialogOpen}
            onOpenChange={setChannelDialogOpen}
            currentUserId={user.id}
            onConversationReady={(conversation) => selectConversation(conversation.id)}
          />
        </>
      ) : null}
    </AppShell>
  );
}

function ChatRealtimeStatus({ status }: { status: ReturnType<typeof getChatSocketStatus> }) {
  const { t } = useI18n();

  if (status === "connected") {
    // Connection is healthy: keep status for assistive tech only (no visible "Online").
    return (
      <p className="sr-only" aria-live="polite">
        {t("chat.realtimeConnected")}
      </p>
    );
  }

  const label =
    status === "connecting"
      ? t("chat.realtimeConnecting")
      : status === "reconnecting"
        ? t("chat.realtimeReconnecting")
        : status === "disconnected"
          ? t("chat.realtimeDisconnected")
          : null;

  if (!label) {
    return null;
  }

  return (
    <p className="shrink-0 text-xs text-amber-700 dark:text-amber-400" aria-live="polite">
      {label}
    </p>
  );
}

function ConversationRow({
  conversation,
  active,
  currentUserId,
  onSelect,
  onTogglePin,
}: {
  conversation: ChatConversation;
  active: boolean;
  currentUserId?: string;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  const { t } = useI18n();
  const otherParticipantId =
    conversation.type === "DIRECT" ? conversation.otherParticipant?.id : null;
  const participantOnline = useIsUserOnline(otherParticipantId);
  const showOnline = shouldShowDirectPresence(conversation, currentUserId, participantOnline);
  const name = conversationDisplayName(conversation, t("chat.generalChat"));
  const previewLabels = {
    file: t("chat.previewFile"),
    files: t("chat.previewFiles"),
    task: t("chat.previewTask"),
    tasks: t("chat.previewTasks"),
    project: t("chat.previewProject"),
    projects: t("chat.previewProjects"),
  };
  const preview = conversation.latestMessage
    ? localizeChatPreviewContent(conversation.latestMessage.content, previewLabels) ||
      t("chat.noPreview")
    : t("chat.noPreview");

  return (
    <li>
      <div
        className={cn(
          "group flex w-full min-w-0 items-center gap-1 rounded-xl px-1.5 py-1 transition",
          active
            ? "bg-auxiliary/12 text-foreground ring-1 ring-auxiliary/15"
            : "hover:bg-auxiliary/7",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-1 py-1.5 text-left"
        >
          {conversation.type === "DIRECT" && conversation.otherParticipant ? (
            <span className="relative flex size-8 shrink-0 items-center justify-center">
              <UserAvatar
                id={conversation.otherParticipant.id}
                name={conversation.otherParticipant.name}
                avatar={conversation.otherParticipant.avatar}
                avatarUrl={conversation.otherParticipant.avatarUrl}
                size="sm"
                className="shrink-0"
              />
              {showOnline ? (
                <ChatOnlineDot
                  label={t("chat.online")}
                  className={cn(
                    "absolute right-0 bottom-0 ring-2",
                    active ? "ring-accent" : "ring-card",
                  )}
                />
              ) : null}
            </span>
          ) : (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
              aria-hidden="true"
            >
              {conversation.type === "CHANNEL" ? (
                <Hash className="size-3.5 shrink-0" />
              ) : (
                <Users className="size-3.5 shrink-0" />
              )}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
            <span className="flex min-w-0 items-center gap-2 leading-none">
              <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5">{name}</span>
              <SidebarTime iso={conversation.latestMessageAt} />
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs leading-4 text-muted-foreground">
                {preview}
              </span>
              {conversation.unreadCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </span>
              ) : null}
            </span>
          </span>
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition lg:size-8",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
            conversation.isPinned && "text-primary md:opacity-100",
            "hover:bg-background/70 hover:text-foreground",
          )}
          aria-label={conversation.isPinned ? t("chat.unpinChat") : t("chat.pinChat")}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
        >
          {conversation.isPinned ? (
            <PinOff className="size-3.5" aria-hidden="true" />
          ) : (
            <Pin className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </li>
  );
}

function ConversationMessagePane({
  conversation,
  conversationId,
  workspaceId,
  currentUserId,
  canRenameGeneral,
  showBackButton,
  onBack,
  onPinnedChange,
}: {
  conversation: ChatConversation;
  conversationId: string;
  workspaceId: string | null;
  currentUserId?: string;
  canRenameGeneral: boolean;
  showBackButton: boolean;
  onBack: () => void;
  onPinnedChange: (isPinned: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => chatMessagesQueryKey(workspaceId, conversationId),
    [workspaceId, conversationId],
  );
  const conversationsQueryKey = useMemo(
    () => chatConversationsQueryKey(workspaceId),
    [workspaceId],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  /** Set after send success/error; applied once textarea is enabled again. */
  const composerFocusRequestRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  /** Captured once per open; used before mark-as-read clears the server cursor. */
  const capturedLastReadAtRef = useRef<string | null | undefined>(undefined);
  const unreadAnchorIdRef = useRef<string | null>(null);
  const layoutAnchorModeRef = useRef<"bottom" | "unread" | null>(null);
  const pendingScrollRestoreRef = useRef<{ previousHeight: number; previousTop: number } | null>(
    null,
  );
  const pollInFlightRef = useRef(false);
  const markedReadForNewestRef = useRef<string | null>(null);
  const readyToMarkReadRef = useRef(false);
  const ignoreScrollEventsRef = useRef(false);
  /** Active bubble long-press timer (cleared on up / cancel / move / unmount). */
  const messageLongPressTimerRef = useRef<number | null>(null);
  /** Suppress the click that follows a successful long press. */
  const messageLongPressOpenedIdRef = useRef<string | null>(null);

  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingChatFile[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingChatTask[]>([]);
  const [pendingProjects, setPendingProjects] = useState<PendingChatProject[]>([]);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false);
  const [jumpingToPinned, setJumpingToPinned] = useState(false);
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  /** Narrow viewports: which message shows the inline actions trigger. */
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  /** Which message has the actions dropdown open (tap on ⋮ or long press). */
  const [actionsMenuMessageId, setActionsMenuMessageId] = useState<string | null>(null);
  const { highlightedMessageId, setHighlightedMessageId } = useTemporaryMessageHighlight();

  const clearMessageLongPressTimer = () => {
    if (messageLongPressTimerRef.current != null) {
      window.clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
  };

  const clearActiveMessage = () => {
    setActiveMessageId(null);
    setActionsMenuMessageId(null);
  };

  useEffect(() => {
    return () => {
      clearMessageLongPressTimer();
    };
  }, []);

  useEffect(() => {
    setDraft("");
    setDraftError(null);
    setPendingFiles([]);
    setActiveMessageId(null);
    setActionsMenuMessageId(null);
    setPendingTasks([]);
    setPendingProjects([]);
    setPinnedPanelOpen(false);
    setProfileMemberId(null);
    setProfileOpen(false);
    setHighlightedMessageId(null);
    clearMessageLongPressTimer();
    // Reset only; do not auto-focus on conversation switch / chat open (mobile keyboard).
    composerFocusRequestRef.current = false;
  }, [conversationId, setHighlightedMessageId]);

  useEffect(() => {
    if (!activeMessageId) {
      setActionsMenuMessageId(null);
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest(`[data-message-id="${activeMessageId}"]`)) {
        return;
      }
      // Radix menus/popovers render in a portal outside the message node.
      if (
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[data-radix-menu-content]") ||
        target.closest("[role='menu']")
      ) {
        return;
      }
      clearActiveMessage();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        clearActiveMessage();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMessageId]);

  const messagesQuery = useQuery({
    queryKey,
    queryFn: () => fetchChatMessages(conversationId, { limit: CHAT_MESSAGES_PAGE_SIZE }),
    enabled: Boolean(workspaceId && conversationId),
    refetchOnWindowFocus: false,
    structuralSharing: false,
  });

  const page = messagesQuery.data;
  const messages = page?.messages ?? [];
  const title = conversationDisplayName(conversation, t("chat.generalChat"));
  const headerPresenceUserId =
    conversation.type === "DIRECT" ? conversation.otherParticipant?.id : null;
  const headerParticipantOnline = useIsUserOnline(headerPresenceUserId);
  const showHeaderOnline = shouldShowDirectPresence(
    conversation,
    currentUserId,
    headerParticipantOnline,
  );

  // Capture the unread boundary once before any mark-as-read call.
  if (capturedLastReadAtRef.current === undefined) {
    capturedLastReadAtRef.current = conversation.lastReadAt ?? null;
  }

  const unreadBoundaryId = useMemo(() => {
    if (!currentUserId || messages.length === 0) {
      return null;
    }
    const target = resolveInitialScrollTarget({
      messages: messages.map((message) => ({
        id: message.id,
        senderId: message.sender.id,
        createdAt: message.createdAt,
      })),
      currentUserId,
      lastReadAt: capturedLastReadAtRef.current ?? null,
    });
    return target.type === "message" ? target.messageId : null;
  }, [messages, currentUserId]);

  useEffect(() => {
    unreadAnchorIdRef.current = unreadBoundaryId;
  }, [unreadBoundaryId]);

  function applyScrollAnchor() {
    const el = listRef.current;
    if (!el) {
      return;
    }

    const mode = layoutAnchorModeRef.current;
    if (mode === "bottom" && stickToBottomRef.current) {
      ignoreScrollEventsRef.current = true;
      el.scrollTop = el.scrollHeight;
      setShowNewMessages(false);
      requestAnimationFrame(() => {
        ignoreScrollEventsRef.current = false;
      });
      return;
    }

    if (mode === "unread" && unreadAnchorIdRef.current) {
      const target = el.querySelector<HTMLElement>(
        `[data-message-id="${unreadAnchorIdRef.current}"]`,
      );
      if (target) {
        ignoreScrollEventsRef.current = true;
        target.scrollIntoView({ block: "start" });
        requestAnimationFrame(() => {
          ignoreScrollEventsRef.current = false;
        });
      }
    }
  }

  function handlePreviewLayoutSettle() {
    if (!initialScrollDoneRef.current) {
      return;
    }
    applyScrollAnchor();
  }

  useEffect(() => {
    if (!workspaceId || !conversationId) {
      return;
    }

    let cancelled = false;

    async function pollNewer() {
      if (document.visibilityState === "hidden" || pollInFlightRef.current) {
        return;
      }

      // While Socket.IO is connected, skip frequent REST polling.
      if (isChatSocketConnected()) {
        return;
      }

      pollInFlightRef.current = true;
      try {
        const current = queryClient.getQueryData<ChatMessagesPage>(queryKey);
        if (!current) {
          return;
        }

        const after = current.pageInfo.newestCursor;
        if (!after) {
          try {
            const fresh = await fetchChatMessages(conversationId, {
              limit: CHAT_MESSAGES_PAGE_SIZE,
            });
            if (cancelled || fresh.messages.length === 0) {
              return;
            }
            queryClient.setQueryData<ChatMessagesPage>(queryKey, (old) => {
              if (!old || old.messages.length === 0) {
                return fresh;
              }
              return {
                messages: mergeChatMessages(old.messages, fresh.messages),
                pageInfo: {
                  hasMoreOlder: old.pageInfo.hasMoreOlder || fresh.pageInfo.hasMoreOlder,
                  oldestCursor: old.pageInfo.oldestCursor ?? fresh.pageInfo.oldestCursor,
                  newestCursor: fresh.pageInfo.newestCursor ?? old.pageInfo.newestCursor,
                },
              };
            });
            if (!stickToBottomRef.current) {
              setShowNewMessages(true);
            }
          } catch {
            // Next tick retries.
          }
          return;
        }

        try {
          const newer = await fetchChatMessages(conversationId, {
            limit: CHAT_MESSAGES_PAGE_SIZE,
            after,
          });
          if (cancelled || newer.messages.length === 0) {
            return;
          }

          queryClient.setQueryData<ChatMessagesPage>(queryKey, (old) => {
            if (!old) {
              return newer;
            }

            const merged = mergeChatMessages(old.messages, newer.messages);
            return {
              messages: merged,
              pageInfo: {
                hasMoreOlder: old.pageInfo.hasMoreOlder,
                oldestCursor: old.pageInfo.oldestCursor,
                newestCursor: newer.pageInfo.newestCursor ?? old.pageInfo.newestCursor,
              },
            };
          });

          if (!stickToBottomRef.current) {
            setShowNewMessages(true);
          }
        } catch {
          // Keep the last successful page; next poll retries.
        }
      } finally {
        pollInFlightRef.current = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void pollNewer();
    }, CHAT_MESSAGES_FALLBACK_POLL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void pollNewer();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [workspaceId, conversationId, queryClient, queryKey]);

  const previousNewestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const newest = messages[messages.length - 1] ?? null;
    const newestId = newest?.id ?? null;

    if (!initialScrollDoneRef.current) {
      previousNewestIdRef.current = newestId;
      return;
    }

    if (newestId && newestId !== previousNewestIdRef.current) {
      previousNewestIdRef.current = newestId;
      if (
        !stickToBottomRef.current &&
        newest &&
        currentUserId &&
        newest.sender.id !== currentUserId
      ) {
        setShowNewMessages(true);
      }
    }
  }, [messages, currentUserId]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || messages.length === 0) {
      return;
    }

    const restore = pendingScrollRestoreRef.current;
    if (restore) {
      const delta = el.scrollHeight - restore.previousHeight;
      el.scrollTop = restore.previousTop + delta;
      pendingScrollRestoreRef.current = null;
      return;
    }

    if (!initialScrollDoneRef.current) {
      const target = currentUserId
        ? resolveInitialScrollTarget({
            messages: messages.map((message) => ({
              id: message.id,
              senderId: message.sender.id,
              createdAt: message.createdAt,
            })),
            currentUserId,
            lastReadAt: capturedLastReadAtRef.current ?? null,
          })
        : ({ type: "bottom" } as const);

      ignoreScrollEventsRef.current = true;

      if (target.type === "message") {
        const node = el.querySelector<HTMLElement>(`[data-message-id="${target.messageId}"]`);
        if (node) {
          node.scrollIntoView({ block: "start" });
          stickToBottomRef.current = false;
          layoutAnchorModeRef.current = "unread";
          unreadAnchorIdRef.current = target.messageId;
        } else {
          // Oldest unread is older than the loaded window: stay at the oldest loaded.
          el.scrollTop = 0;
          stickToBottomRef.current = false;
          layoutAnchorModeRef.current = "unread";
        }
      } else {
        el.scrollTop = el.scrollHeight;
        stickToBottomRef.current = true;
        layoutAnchorModeRef.current = "bottom";
      }

      initialScrollDoneRef.current = true;
      readyToMarkReadRef.current = true;
      requestAnimationFrame(() => {
        ignoreScrollEventsRef.current = false;
      });
      return;
    }

    if (stickToBottomRef.current) {
      ignoreScrollEventsRef.current = true;
      el.scrollTop = el.scrollHeight;
      setShowNewMessages(false);
      layoutAnchorModeRef.current = "bottom";
      requestAnimationFrame(() => {
        ignoreScrollEventsRef.current = false;
      });
    }
  }, [messages, currentUserId]);

  useEffect(() => {
    if (!conversationId || !page?.pageInfo.newestCursor) {
      return;
    }
    // Wait until the unread boundary was used for the first scroll.
    if (!readyToMarkReadRef.current || !initialScrollDoneRef.current) {
      return;
    }
    if (!stickToBottomRef.current && document.visibilityState !== "visible") {
      return;
    }
    if (markedReadForNewestRef.current === page.pageInfo.newestCursor) {
      return;
    }
    if (conversation.unreadCount === 0 && markedReadForNewestRef.current) {
      return;
    }

    markedReadForNewestRef.current = page.pageInfo.newestCursor;

    void markConversationRead(conversationId)
      .then((result) => {
        updateChatConversationsCache(queryClient, (old) =>
          old.map((item) =>
            item.id === conversationId
              ? {
                  ...item,
                  unreadCount: result.unreadCount,
                  lastReadAt: result.lastReadAt,
                }
              : item,
          ),
        );
        void queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
      })
      .catch(() => {
        markedReadForNewestRef.current = null;
      });
  }, [
    conversation.unreadCount,
    conversationId,
    page?.pageInfo.newestCursor,
    queryClient,
    messages.length,
  ]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    if (ignoreScrollEventsRef.current) {
      return;
    }

    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowNewMessages(false);
      layoutAnchorModeRef.current = "bottom";
    } else if (layoutAnchorModeRef.current === "bottom") {
      layoutAnchorModeRef.current = null;
    } else if (layoutAnchorModeRef.current === "unread") {
      // User moved away from the unread anchor: stop chasing image layout shifts.
      layoutAnchorModeRef.current = null;
    }
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) {
      return;
    }
    ignoreScrollEventsRef.current = true;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    layoutAnchorModeRef.current = "bottom";
    setShowNewMessages(false);
    requestAnimationFrame(() => {
      ignoreScrollEventsRef.current = false;
    });
  }

  async function handleLoadOlder() {
    if (!page?.pageInfo.hasMoreOlder || !page.pageInfo.oldestCursor || loadingOlder) {
      return;
    }

    const el = listRef.current;
    if (el) {
      pendingScrollRestoreRef.current = {
        previousHeight: el.scrollHeight,
        previousTop: el.scrollTop,
      };
    }

    setLoadingOlder(true);
    try {
      const older = await fetchChatMessages(conversationId, {
        limit: CHAT_MESSAGES_PAGE_SIZE,
        before: page.pageInfo.oldestCursor,
      });

      queryClient.setQueryData<ChatMessagesPage>(queryKey, (old) => {
        if (!old) {
          return older;
        }

        const merged = mergeChatMessages(older.messages, old.messages);
        return {
          messages: merged,
          pageInfo: {
            hasMoreOlder: older.pageInfo.hasMoreOlder,
            oldestCursor: older.pageInfo.oldestCursor ?? old.pageInfo.oldestCursor,
            newestCursor: old.pageInfo.newestCursor,
          },
        };
      });
    } catch (error) {
      pendingScrollRestoreRef.current = null;
      toast.error(friendlyChatErrorMessage(error, t, "chat.errorTitle"));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function ensurePinnedMessageLoaded(messageId: string): Promise<"found" | "missing"> {
    let current = queryClient.getQueryData<ChatMessagesPage>(queryKey);
    if (current?.messages.some((message) => message.id === messageId)) {
      return "found";
    }

    // Load older pages until the target appears or history is exhausted.
    // Cap iterations to avoid an infinite loop if cursors stall.
    for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
      current = queryClient.getQueryData<ChatMessagesPage>(queryKey);
      if (!current?.pageInfo.hasMoreOlder || !current.pageInfo.oldestCursor) {
        break;
      }

      const older = await fetchChatMessages(conversationId, {
        limit: CHAT_MESSAGES_PAGE_SIZE,
        before: current.pageInfo.oldestCursor,
      });

      queryClient.setQueryData<ChatMessagesPage>(queryKey, (old) => {
        if (!old) {
          return older;
        }
        return {
          messages: mergeChatMessages(older.messages, old.messages),
          pageInfo: {
            hasMoreOlder: older.pageInfo.hasMoreOlder,
            oldestCursor: older.pageInfo.oldestCursor ?? old.pageInfo.oldestCursor,
            newestCursor: old.pageInfo.newestCursor,
          },
        };
      });

      const merged = queryClient.getQueryData<ChatMessagesPage>(queryKey);
      if (merged?.messages.some((message) => message.id === messageId)) {
        return "found";
      }

      if (!older.pageInfo.hasMoreOlder || older.messages.length === 0) {
        break;
      }
    }

    return "missing";
  }

  async function handleJumpToPinnedMessage(messageId: string) {
    if (jumpingToPinned) {
      return;
    }

    setPinnedPanelOpen(false);
    setJumpingToPinned(true);
    stickToBottomRef.current = false;
    layoutAnchorModeRef.current = null;

    try {
      const result = await ensurePinnedMessageLoaded(messageId);
      if (result === "missing") {
        const pinnedKey = chatPinnedMessagesQueryKey(workspaceId, conversationId);
        queryClient.setQueryData<{ messages: ChatMessage[] }>(pinnedKey, (old) => {
          if (!old) {
            return old;
          }
          return {
            messages: old.messages.filter((message) => message.id !== messageId),
          };
        });
        toast.error(t("chat.pinnedMessageMissing"));
        return;
      }

      // Wait a frame so newly merged DOM nodes are available.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const target = listRef.current?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
      if (target instanceof HTMLElement) {
        ignoreScrollEventsRef.current = true;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(messageId);
        window.setTimeout(() => {
          ignoreScrollEventsRef.current = false;
        }, 400);
      }
    } catch (error) {
      toast.error(friendlyChatErrorMessage(error, t, "chat.errorTitle"));
    } finally {
      setJumpingToPinned(false);
    }
  }

  const sendMutation = useMutation({
    mutationFn: (input: {
      content: string;
      files: File[];
      taskIds: string[];
      projectIds: string[];
    }) => sendChatMessage(conversationId, input),
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessagesPage>(queryKey, (old) => {
        if (!old) {
          return {
            messages: [message],
            pageInfo: {
              hasMoreOlder: false,
              oldestCursor: encodeChatCursor(message.createdAt, message.id),
              newestCursor: encodeChatCursor(message.createdAt, message.id),
            },
          };
        }

        const merged = mergeChatMessages(old.messages, [message]);
        return {
          messages: merged,
          pageInfo: {
            hasMoreOlder: old.pageInfo.hasMoreOlder,
            oldestCursor:
              old.pageInfo.oldestCursor ?? encodeChatCursor(message.createdAt, message.id),
            newestCursor: encodeChatCursor(message.createdAt, message.id),
          },
        };
      });

      const preview = buildChatAttachmentPreviewLabel(message.content, message.attachments, {
        file: t("chat.previewFile"),
        files: t("chat.previewFiles"),
        task: t("chat.previewTask"),
        tasks: t("chat.previewTasks"),
        project: t("chat.previewProject"),
        projects: t("chat.previewProjects"),
      });

      updateChatConversationsCache(queryClient, (old) =>
        old.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                latestMessage: {
                  id: message.id,
                  content: preview || message.content,
                  createdAt: message.createdAt,
                  senderId: message.sender.id,
                },
                latestMessageAt: message.createdAt,
                unreadCount: 0,
                updatedAt: message.createdAt,
              }
            : item,
        ),
      );

      stickToBottomRef.current = true;
      layoutAnchorModeRef.current = "bottom";
      setShowNewMessages(false);
      setDraft("");
      setPendingFiles([]);
      setPendingTasks([]);
      setPendingProjects([]);
      setDraftError(null);
      composerFocusRequestRef.current = true;
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
    onError: (error) => {
      toast.error(friendlyChatErrorMessage(error, t, "chat.sendFailed"));
      // Keep draft + attachments; restore focus so the user can retry.
      composerFocusRequestRef.current = true;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChatMessage(conversationId, id),
    onSuccess: (_data, id) => {
      updateChatMessagesCache(queryClient, conversationId, (old) => ({
        ...old,
        messages: old.messages.filter((message) => message.id !== id),
      }));
      const pinnedKey = chatPinnedMessagesQueryKey(workspaceId, conversationId);
      queryClient.setQueryData<{ messages: ChatMessage[] }>(pinnedKey, (old) => {
        if (!old) {
          return old;
        }
        return {
          messages: old.messages.filter((message) => message.id !== id),
        };
      });
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
    onError: (error) => {
      toast.error(friendlyChatErrorMessage(error, t, "chat.deleteFailed"));
    },
  });

  const renameMutation = useMutation({
    mutationFn: (nextTitle: string) => renameChatConversation(conversationId, nextTitle),
    onMutate: async (nextTitle) => {
      await queryClient.cancelQueries({ queryKey: conversationsQueryKey });
      const previous = queryClient.getQueryData<ChatConversation[]>(conversationsQueryKey);
      updateChatConversationsCache(queryClient, (old) =>
        old.map((item) =>
          item.id === conversationId ? { ...item, title: nextTitle, displayName: nextTitle } : item,
        ),
      );
      return { previous };
    },
    onSuccess: (result) => {
      updateChatConversationsCache(queryClient, (old) =>
        old.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                title: result.title,
                displayName: result.displayName,
                updatedAt: result.updatedAt,
              }
            : item,
        ),
      );
      setRenameOpen(false);
      setRenameError(null);
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(conversationsQueryKey, context.previous);
      }
      toast.error(friendlyChatErrorMessage(error, t, "chat.renameFailed"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  function openRenameDialog() {
    setRenameDraft(conversation.title?.trim() || title);
    setRenameError(null);
    setRenameOpen(true);
  }

  function submitRename() {
    const validated = validateChatConversationTitle(renameDraft);
    if (!validated.ok) {
      setRenameError(
        validated.reason === "too_long"
          ? t("chat.renameValidationTooLong").replace(
              "{max}",
              String(CHAT_CONVERSATION_TITLE_MAX_LENGTH),
            )
          : t("chat.renameValidationEmpty"),
      );
      return;
    }
    renameMutation.mutate(validated.title);
  }

  function submitDraft() {
    const hasAttachments =
      pendingFiles.length > 0 || pendingTasks.length > 0 || pendingProjects.length > 0;
    const validation = validateChatDraft(draft, { allowEmpty: hasAttachments });
    if (!validation.ok) {
      setDraftError(
        validation.reason === "too_long"
          ? t("chat.validationTooLong").replace("{max}", String(CHAT_MESSAGE_MAX_LENGTH))
          : t("chat.validationEmpty"),
      );
      return;
    }

    // Fast path: DevTools Offline (and real offline) often leave fetch pending forever.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error(t("common.offline"));
      composerFocusRequestRef.current = true;
      return;
    }

    setDraftError(null);
    sendMutation.mutate({
      content: validation.content,
      files: pendingFiles.map((item) => item.file),
      taskIds: pendingTasks.map((task) => task.id),
      projectIds: pendingProjects.map((project) => project.id),
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sendMutation.isPending) {
      return;
    }
    submitDraft();
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      !shouldSubmitOnComposerKeyDown({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
        isSending: sendMutation.isPending,
      })
    ) {
      return;
    }
    // Prevent Enter from also submitting the form (duplicate send).
    event.preventDefault();
    submitDraft();
  }

  useLayoutEffect(() => {
    if (
      !shouldRestoreComposerFocus({
        focusRequested: composerFocusRequestRef.current,
        isSending: sendMutation.isPending,
        isFocusInAttachmentPicker: isFocusInsideAttachmentPicker(document.activeElement),
      })
    ) {
      return;
    }

    const el = composerRef.current;
    if (!el || el.disabled) {
      return;
    }

    composerFocusRequestRef.current = false;
    // After React applied cleared/restored draft; rAF keeps caret after layout height sync.
    requestAnimationFrame(() => {
      const latest = composerRef.current;
      if (!latest || latest.disabled) {
        return;
      }
      if (isFocusInsideAttachmentPicker(document.activeElement)) {
        return;
      }
      focusChatComposer(latest);
    });
  }, [sendMutation.isPending, draft, pendingFiles, pendingTasks, pendingProjects]);

  const hasAttachments =
    pendingFiles.length > 0 || pendingTasks.length > 0 || pendingProjects.length > 0;
  const remaining = CHAT_MESSAGE_MAX_LENGTH - draft.length;
  const canSend =
    (draft.trim().length > 0 || hasAttachments) && draft.trim().length <= CHAT_MESSAGE_MAX_LENGTH;
  const showCharCounter = draft.length >= COMPOSER_COUNTER_SOFT_LIMIT || remaining < 0;
  const showComposerMeta = Boolean(draftError) || showCharCounter;
  const showConversationMeta = page?.pageInfo.hasMoreOlder;

  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) {
      return;
    }
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [draft]);

  return (
    <>
      <ChatConversationHeader
        conversation={conversation}
        title={title}
        showBackButton={showBackButton}
        showOnline={showHeaderOnline}
        canRenameGeneral={canRenameGeneral}
        pinnedPanelOpen={pinnedPanelOpen}
        onBack={onBack}
        onOpenProfile={(memberId) => {
          setProfileMemberId(memberId);
          setProfileOpen(true);
        }}
        onPinnedChange={onPinnedChange}
        onOpenRename={openRenameDialog}
        onPinnedPanelOpenChange={setPinnedPanelOpen}
      />

      {workspaceId ? (
        <ChatPinnedMessagesPanel
          open={pinnedPanelOpen}
          onOpenChange={setPinnedPanelOpen}
          conversationId={conversationId}
          workspaceId={workspaceId}
          onSelectMessage={(messageId) => {
            void handleJumpToPinnedMessage(messageId);
          }}
        />
      ) : null}

      {messagesQuery.isLoading ? (
        <ChatSkeleton />
      ) : messagesQuery.isError ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <ApiErrorState
            titleKey="chat.errorTitle"
            error={messagesQuery.error}
            onRetry={() => void messagesQuery.refetch()}
            isRetrying={messagesQuery.isFetching}
            compact
          />
        </div>
      ) : (
        <>
          {showConversationMeta ? (
            <div className="flex shrink-0 items-center justify-center border-b border-border/60 px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                disabled={loadingOlder}
                onClick={() => void handleLoadOlder()}
              >
                {loadingOlder ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    {t("common.loading")}
                  </>
                ) : (
                  t("chat.loadOlder")
                )}
              </Button>
            </div>
          ) : null}

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="relative min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
            role="log"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={MessageSquare}
                  title={t("chat.emptyTitle")}
                  description={t("chat.emptyDescription")}
                  compact
                  className="max-w-md border-0 bg-transparent shadow-none"
                />
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = currentUserId === message.sender.id;
                const showUnreadDivider = message.id === unreadBoundaryId;
                const align = isOwn ? "end" : "start";
                return (
                  <div key={message.id} className="space-y-3">
                    {showUnreadDivider ? (
                      <div
                        className="flex items-center gap-3 py-1"
                        role="separator"
                        aria-label={t("chat.unreadBoundary")}
                      >
                        <div className="h-px flex-1 bg-border" />
                        <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground">
                          {t("chat.unreadBoundary")}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    ) : null}
                    <div
                      data-message-id={message.id}
                      className={cn(
                        "group flex min-w-0 gap-2 rounded-2xl transition-[box-shadow,background-color] duration-500 sm:gap-2.5",
                        isOwn ? "flex-row-reverse" : "flex-row",
                        highlightedMessageId === message.id &&
                          "bg-primary/10 ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
                      )}
                    >
                      <UserAvatar
                        id={message.sender.id}
                        name={message.sender.name}
                        avatar={message.sender.avatar}
                        avatarUrl={message.sender.avatarUrl}
                        size="sm"
                        className="mt-0.5 shrink-0"
                      />
                      {currentUserId ? (
                        <ChatMessageReactionProvider
                          conversationId={conversationId}
                          message={message}
                          currentUserId={currentUserId}
                          align={align}
                        >
                          <div
                            className={cn(
                              "flex min-w-0 max-w-[min(100%,calc(100%-2.75rem),36rem)] flex-1 gap-1",
                              isOwn ? "flex-row-reverse" : "flex-row",
                            )}
                          >
                            <div
                              tabIndex={0}
                              className={cn(
                                "min-w-0 max-w-full overflow-hidden rounded-2xl border px-3 py-2.5 text-left sm:px-3.5",
                                "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                                isOwn
                                  ? "border-primary/25 bg-primary/10"
                                  : "border-border/80 bg-background/60",
                                activeMessageId === message.id &&
                                  "bg-muted/40 ring-1 ring-border/80",
                              )}
                              onClick={() => {
                                if (messageLongPressOpenedIdRef.current === message.id) {
                                  messageLongPressOpenedIdRef.current = null;
                                  return;
                                }
                                setActiveMessageId(message.id);
                              }}
                              onFocus={() => setActiveMessageId(message.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  clearActiveMessage();
                                  (event.currentTarget as HTMLElement).blur();
                                }
                              }}
                              onPointerDown={(event) => {
                                if (!isMessageLongPressPointer(event.pointerType)) {
                                  return;
                                }
                                if (shouldIgnoreMessageLongPress(event.target)) {
                                  return;
                                }

                                const startX = event.clientX;
                                const startY = event.clientY;
                                const bubble = event.currentTarget;

                                clearMessageLongPressTimer();
                                messageLongPressTimerRef.current = window.setTimeout(() => {
                                  messageLongPressTimerRef.current = null;
                                  messageLongPressOpenedIdRef.current = message.id;
                                  setActiveMessageId(message.id);
                                  setActionsMenuMessageId(message.id);
                                }, MESSAGE_LONG_PRESS_MS);

                                const clear = () => {
                                  clearMessageLongPressTimer();
                                  bubble.removeEventListener("pointermove", onMove);
                                  bubble.removeEventListener("pointerup", clear);
                                  bubble.removeEventListener("pointercancel", clear);
                                };

                                const onMove = (moveEvent: PointerEvent) => {
                                  const dx = moveEvent.clientX - startX;
                                  const dy = moveEvent.clientY - startY;
                                  if (Math.hypot(dx, dy) > MESSAGE_LONG_PRESS_MOVE_PX) {
                                    clear();
                                  }
                                };

                                bubble.addEventListener("pointermove", onMove);
                                bubble.addEventListener("pointerup", clear);
                                bubble.addEventListener("pointercancel", clear);
                              }}
                            >
                              {message.pin ? <ChatMessagePinBadge pin={message.pin} /> : null}
                              <div className="mb-1 flex min-w-0 items-start gap-x-1.5">
                                <div
                                  className={cn(
                                    "flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5",
                                    isOwn ? "justify-end" : "justify-start",
                                  )}
                                >
                                  <span className="max-w-full truncate text-xs font-medium text-foreground/90">
                                    {isOwn ? t("chat.you") : message.sender.name}
                                  </span>
                                  <ChatTimestamp iso={message.createdAt} />
                                </div>
                                <ChatMessageActions
                                  variant="menu"
                                  conversationId={conversationId}
                                  message={message}
                                  workspaceId={workspaceId}
                                  isOwn={isOwn}
                                  align={align}
                                  isActive={activeMessageId === message.id}
                                  menuOpen={actionsMenuMessageId === message.id}
                                  onMenuOpenChange={(open) => {
                                    setActionsMenuMessageId(open ? message.id : null);
                                    if (open) {
                                      setActiveMessageId(message.id);
                                    }
                                  }}
                                  onDelete={() => setDeleteTarget(message)}
                                />
                              </div>
                              {message.content.trim() ? (
                                <p className="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-foreground/95">
                                  {message.content}
                                </p>
                              ) : null}
                              <ChatMessageAttachments
                                attachments={message.attachments ?? []}
                                onPreviewLayoutSettle={handlePreviewLayoutSettle}
                              />
                              <ChatMessageReactionChips />
                            </div>
                            <ChatMessageActions
                              variant="toolbar"
                              conversationId={conversationId}
                              message={message}
                              workspaceId={workspaceId}
                              isOwn={isOwn}
                              align={align}
                              onDelete={() => setDeleteTarget(message)}
                            />
                          </div>
                        </ChatMessageReactionProvider>
                      ) : (
                        <div
                          className={cn(
                            "min-w-0 max-w-[min(100%,calc(100%-2.75rem),36rem)] overflow-hidden rounded-2xl border px-3 py-2.5 sm:px-3.5",
                            isOwn
                              ? "border-primary/25 bg-primary/10"
                              : "border-border/80 bg-background/60",
                          )}
                        >
                          {message.pin ? <ChatMessagePinBadge pin={message.pin} /> : null}
                          <div
                            className={cn(
                              "mb-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5",
                              isOwn ? "justify-end" : "justify-start",
                            )}
                          >
                            <span className="max-w-full truncate text-xs font-medium text-foreground/90">
                              {isOwn ? t("chat.you") : message.sender.name}
                            </span>
                            <ChatTimestamp iso={message.createdAt} />
                          </div>
                          {message.content.trim() ? (
                            <p className="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-foreground/95">
                              {message.content}
                            </p>
                          ) : null}
                          <ChatMessageAttachments
                            attachments={message.attachments ?? []}
                            onPreviewLayoutSettle={handlePreviewLayoutSettle}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {showNewMessages ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
              <Button
                type="button"
                size="sm"
                className="pointer-events-auto h-10 gap-1.5 rounded-full shadow-md lg:h-8"
                onClick={scrollToBottom}
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
                {t("chat.newMessages")}
              </Button>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-border/60 bg-background/40 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          >
            <ChatPendingAttachmentChips
              files={pendingFiles}
              tasks={pendingTasks}
              projects={pendingProjects}
              disabled={sendMutation.isPending}
              onFilesChange={setPendingFiles}
              onTasksChange={setPendingTasks}
              onProjectsChange={setPendingProjects}
            />
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card to-primary/[0.055] p-1.5 shadow-[0_14px_45px_rgba(0,0,0,.16)] transition focus-within:border-primary/45 focus-within:shadow-glow">
              <div className="flex min-w-0 items-end gap-1">
                <ChatAttachMenu
                  files={pendingFiles}
                  tasks={pendingTasks}
                  projects={pendingProjects}
                  disabled={sendMutation.isPending}
                  onFilesChange={setPendingFiles}
                  onTasksChange={setPendingTasks}
                  onProjectsChange={setPendingProjects}
                  onValidationError={setDraftError}
                />
                <ChatComposerEmojiPicker
                  textareaRef={composerRef}
                  value={draft}
                  disabled={sendMutation.isPending}
                  onChange={(next) => {
                    setDraft(next);
                    if (draftError) {
                      setDraftError(null);
                    }
                  }}
                />
                <div className="min-w-0 flex-1">
                  <Textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (draftError) {
                        setDraftError(null);
                      }
                    }}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={t("chat.placeholder")}
                    disabled={sendMutation.isPending}
                    rows={1}
                    maxLength={CHAT_MESSAGE_MAX_LENGTH + 50}
                    className="min-h-10 max-h-40 resize-none overflow-x-hidden overflow-y-auto border-0 bg-transparent px-2 py-2 leading-5 shadow-none break-words placeholder:whitespace-nowrap hover:bg-transparent focus-visible:ring-0 sm:px-3 [overflow-wrap:anywhere]"
                  />
                  {showComposerMeta ? (
                    <div className="mt-1 flex items-center justify-between gap-2 px-0.5">
                      <p className="text-[11px] text-destructive">{draftError ?? ""}</p>
                      {showCharCounter ? (
                        <p
                          className={cn(
                            "ml-auto text-[11px] tabular-nums text-muted-foreground",
                            remaining < 0 && "text-destructive",
                          )}
                        >
                          {draft.length}/{CHAT_MESSAGE_MAX_LENGTH}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  variant="brand"
                  disabled={!canSend || sendMutation.isPending}
                  className="mb-0.5 h-10 w-10 shrink-0 rounded-xl px-0 shadow-glow sm:w-auto sm:min-w-28 sm:px-3.5"
                  aria-label={t("chat.send")}
                  title={t("chat.send")}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">
                    {sendMutation.isPending
                      ? hasAttachments
                        ? t("chat.uploading")
                        : t("chat.sending")
                      : t("chat.send")}
                  </span>
                </Button>
              </div>
            </div>
          </form>
        </>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("chat.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                }
              }}
            >
              {deleteMutation.isPending ? t("common.loading") : t("chat.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) {
            setRenameError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.renameTitle")}</DialogTitle>
            <DialogDescription>{t("chat.renameDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={renameDraft}
              onChange={(event) => {
                setRenameDraft(event.target.value);
                if (renameError) {
                  setRenameError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitRename();
                }
              }}
              maxLength={CHAT_CONVERSATION_TITLE_MAX_LENGTH + 20}
              disabled={renameMutation.isPending}
              autoFocus
            />
            {renameError ? <p className="text-xs text-destructive">{renameError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renameMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={submitRename}
              variant="brand"
              disabled={renameMutation.isPending}
            >
              {renameMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                t("chat.renameSave")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberProfileDrawer
        memberId={profileMemberId}
        open={profileOpen}
        onClose={() => {
          setProfileOpen(false);
          setProfileMemberId(null);
        }}
      />
    </>
  );
}

function ChatPageSkeleton() {
  return (
    <div className="flex w-full">
      <div className="hidden w-[300px] shrink-0 flex-col gap-2 border-r border-border p-3 xl:flex">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <ChatSkeleton />
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={cn("flex gap-2.5", index % 2 === 0 ? "flex-row" : "flex-row-reverse")}
        >
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className={cn("h-16 rounded-2xl", index % 2 === 0 ? "w-2/3" : "w-1/2")} />
        </div>
      ))}
    </div>
  );
}
