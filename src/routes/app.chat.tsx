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
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import { requireAuth } from "@/lib/auth/route-guards";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { UserAvatar } from "@/components/app/UserAvatar";
import { NewDirectMessageDialog } from "@/components/app/chat/NewDirectMessageDialog";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CHAT_CONVERSATIONS_FALLBACK_POLL_MS,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_MESSAGES_FALLBACK_POLL_MS,
  CHAT_MESSAGES_PAGE_SIZE,
  chatConversationsQueryKey,
  chatMessagesQueryKey,
  conversationDisplayName,
  deleteChatMessage,
  encodeChatCursor,
  fetchChatConversations,
  fetchChatMessages,
  markConversationRead,
  mergeChatMessages,
  resolveInitialConversationId,
  sendChatMessage,
  setConversationPinned,
  updateChatConversationsCache,
  updateChatMessagesCache,
  validateChatDraft,
  type ChatConversation,
  type ChatMessage,
  type ChatMessagesPage,
} from "@/lib/api/chat";
import { getSelectedWorkspaceId } from "@/lib/api/client";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  getChatSocketStatus,
  isChatSocketConnected,
  setOpenChatConversationId,
  subscribeChatSocketStatus,
} from "@/lib/realtime/chat-socket-state";
import { cn } from "@/lib/utils";

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
    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums" suppressHydrationWarning>
      {label}
    </span>
  );
}

function useIsDesktopMd() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function WorkspaceChatPage() {
  const { t } = useI18n();
  const { data: me } = useCurrentUser();
  const user = me?.user;
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const { conversation: conversationFromUrl } = Route.useSearch();
  const workspaceId = me?.workspace?.id ?? getSelectedWorkspaceId();
  const isDesktop = useIsDesktopMd();

  const [directDialogOpen, setDirectDialogOpen] = useState(false);
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
    return resolveInitialConversationId({
      requestedId: conversationFromUrl,
      conversations,
    });
  }, [conversationFromUrl, conversations]);

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
    }
  }, [conversationFromUrl]);

  function selectConversation(conversationId: string) {
    setMobileShowList(false);
    void navigate({
      search: { conversation: conversationId },
      replace: true,
    });
  }

  function handleBackToList() {
    setMobileShowList(true);
    void navigate({
      search: { conversation: undefined },
      replace: true,
    });
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
  const general = filteredConversations.filter(
    (item) => !item.isPinned && item.type === "WORKSPACE",
  );
  const directs = filteredConversations.filter(
    (item) => !item.isPinned && item.type === "DIRECT",
  );

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
      toast.error(error instanceof Error ? error.message : t("chat.pinFailed"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  return (
    <AppShell>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("chat.chats")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("chat.subtitle")}</p>
        </div>
        <ChatRealtimeStatus status={socketStatus} />
      </div>

      <div className="relative flex h-[calc(100dvh-10.5rem)] min-h-0 overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:h-[calc(100vh-11rem)] md:min-h-112">
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
                "flex w-full min-w-0 flex-col border-border md:w-[300px] md:shrink-0 md:border-r",
                showSidebar ? "flex" : "hidden",
                isDesktop && "flex",
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-3">
                <h2 className="truncate text-sm font-semibold">{t("chat.chats")}</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1.5 px-2.5"
                  onClick={() => setDirectDialogOpen(true)}
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">{t("chat.newMessage")}</span>
                </Button>
              </div>

              <div className="border-b border-border/60 px-3 py-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={conversationFilter}
                    onChange={(event) => setConversationFilter(event.target.value)}
                    placeholder={t("chat.searchConversations")}
                    className="h-8 bg-background/60 pl-8 text-sm"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {filteredConversations.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title={t("chat.noConversations")}
                    description={t("chat.noConversationsHint")}
                    compact
                    className="border-0 bg-transparent py-10 shadow-none"
                  />
                ) : (
                  <div className="space-y-3 p-2">
                    {pinned.length > 0 ? (
                      <ConversationSection title={t("chat.pinned")}>
                        {pinned.map((item) => (
                          <ConversationRow
                            key={item.id}
                            conversation={item}
                            active={item.id === selectedConversationId && !mobileShowList}
                            onSelect={() => selectConversation(item.id)}
                            onTogglePin={() =>
                              pinMutation.mutate({ id: item.id, isPinned: !item.isPinned })
                            }
                          />
                        ))}
                      </ConversationSection>
                    ) : null}

                    {general.length > 0 ? (
                      <ConversationSection title={t("chat.generalChat")}>
                        {general.map((item) => (
                          <ConversationRow
                            key={item.id}
                            conversation={item}
                            active={item.id === selectedConversationId && !mobileShowList}
                            onSelect={() => selectConversation(item.id)}
                            onTogglePin={() =>
                              pinMutation.mutate({ id: item.id, isPinned: !item.isPinned })
                            }
                          />
                        ))}
                      </ConversationSection>
                    ) : null}

                    {directs.length > 0 ? (
                      <ConversationSection title={t("chat.directMessages")}>
                        {directs.map((item) => (
                          <ConversationRow
                            key={item.id}
                            conversation={item}
                            active={item.id === selectedConversationId && !mobileShowList}
                            onSelect={() => selectConversation(item.id)}
                            onTogglePin={() =>
                              pinMutation.mutate({ id: item.id, isPinned: !item.isPinned })
                            }
                          />
                        ))}
                      </ConversationSection>
                    ) : null}
                  </div>
                )}
              </div>
            </aside>

            <section
              className={cn(
                "min-w-0 flex-1 flex-col",
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
        <NewDirectMessageDialog
          open={directDialogOpen}
          onOpenChange={setDirectDialogOpen}
          currentUserId={user.id}
          onConversationReady={(conversation) => selectConversation(conversation.id)}
        />
      ) : null}
    </AppShell>
  );
}

function ChatRealtimeStatus({
  status,
}: {
  status: ReturnType<typeof getChatSocketStatus>;
}) {
  const { t } = useI18n();

  const label =
    status === "connected"
      ? t("chat.realtimeConnected")
      : status === "connecting"
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
    <p
      className={cn(
        "shrink-0 text-xs",
        status === "connected" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400",
      )}
      aria-live="polite"
    >
      {label}
    </p>
  );
}

function ConversationSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onTogglePin,
}: {
  conversation: ChatConversation;
  active: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  const { t } = useI18n();
  const name = conversationDisplayName(conversation, t("chat.generalChat"));
  const preview = conversation.latestMessage?.content ?? t("chat.noPreview");

  return (
    <li>
      <div
        className={cn(
          "group flex w-full items-start gap-2 rounded-xl px-2 py-2 transition",
          active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
        )}
      >
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
          {conversation.type === "DIRECT" && conversation.otherParticipant ? (
            <UserAvatar
              id={conversation.otherParticipant.id}
              name={conversation.otherParticipant.name}
              avatar={conversation.otherParticipant.avatar}
              avatarUrl={conversation.otherParticipant.avatarUrl}
              size="sm"
              className="mt-0.5 shrink-0"
            />
          ) : (
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Users className="size-3.5" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{name}</span>
              <SidebarTime iso={conversation.latestMessageAt} />
            </span>
            <span className="mt-0.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{preview}</span>
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
            "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100",
            conversation.isPinned && "text-primary md:opacity-100",
            "hover:bg-background/70 hover:text-foreground",
          )}
          aria-label={conversation.isPinned ? t("chat.unpinChat") : t("chat.pinChat")}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
        >
          {conversation.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
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
  showBackButton,
  onBack,
  onPinnedChange,
}: {
  conversation: ChatConversation;
  conversationId: string;
  workspaceId: string | null;
  currentUserId?: string;
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
  const stickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const pendingScrollRestoreRef = useRef<{ previousHeight: number; previousTop: number } | null>(
    null,
  );
  const pollInFlightRef = useRef(false);
  const markedReadForNewestRef = useRef<string | null>(null);

  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

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
      el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = true;
      initialScrollDoneRef.current = true;
      return;
    }

    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setShowNewMessages(false);
    }
  }, [messages]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
    stickToBottomRef.current = true;
    previousNewestIdRef.current = null;
    setShowNewMessages(false);
    markedReadForNewestRef.current = null;
    setDraft("");
    setDraftError(null);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !page?.pageInfo.newestCursor) {
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
              ? { ...item, unreadCount: result.unreadCount }
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
  ]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowNewMessages(false);
    }
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowNewMessages(false);
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
      toast.error(error instanceof Error ? error.message : t("chat.errorTitle"));
    } finally {
      setLoadingOlder(false);
    }
  }

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendChatMessage(conversationId, content),
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

      updateChatConversationsCache(queryClient, (old) =>
        old.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                latestMessage: {
                  id: message.id,
                  content: message.content,
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
      setShowNewMessages(false);
      setDraft("");
      setDraftError(null);
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("chat.sendFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChatMessage(conversationId, id),
    onSuccess: (_data, id) => {
      updateChatMessagesCache(queryClient, conversationId, (old) => ({
        ...old,
        messages: old.messages.filter((message) => message.id !== id),
      }));
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("chat.deleteFailed"));
    },
  });

  function submitDraft() {
    const validation = validateChatDraft(draft);
    if (!validation.ok) {
      setDraftError(
        validation.reason === "too_long"
          ? t("chat.validationTooLong").replace("{max}", String(CHAT_MESSAGE_MAX_LENGTH))
          : t("chat.validationEmpty"),
      );
      return;
    }

    setDraftError(null);
    sendMutation.mutate(validation.content);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sendMutation.isPending) {
      return;
    }
    submitDraft();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!sendMutation.isPending) {
        submitDraft();
      }
    }
  }

  const remaining = CHAT_MESSAGE_MAX_LENGTH - draft.length;
  const canSend = draft.trim().length > 0 && draft.trim().length <= CHAT_MESSAGE_MAX_LENGTH;
  const showCharCounter = draft.length >= COMPOSER_COUNTER_SOFT_LIMIT || remaining < 0;
  const showComposerMeta = Boolean(draftError) || showCharCounter;

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
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        {showBackButton ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onBack}
            aria-label={t("chat.backToList")}
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}
        {conversation.type === "DIRECT" && conversation.otherParticipant ? (
          <UserAvatar
            id={conversation.otherParticipant.id}
            name={conversation.otherParticipant.name}
            avatar={conversation.otherParticipant.avatar}
            avatarUrl={conversation.otherParticipant.avatarUrl}
            size="sm"
            className="shrink-0"
          />
        ) : (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Users className="size-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {conversation.unreadCount > 0 ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {conversation.unreadCount === 1
                ? t("chat.unreadOne")
                : t("chat.unreadMany").replace("{count}", String(conversation.unreadCount))}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={conversation.isPinned ? t("chat.unpinChat") : t("chat.pinChat")}
          onClick={() => onPinnedChange(!conversation.isPinned)}
        >
          {conversation.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </Button>
      </div>

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
          <div className="flex items-center justify-center border-b border-border/60 px-4 py-2">
            {page?.pageInfo.hasMoreOlder ? (
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
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : (
                  t("chat.loadOlder")
                )}
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground/70">
                {messages.length > 0 ? title : ""}
              </span>
            )}
          </div>

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="relative min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
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
                return (
                  <div
                    key={message.id}
                    className={cn("flex gap-2.5", isOwn ? "flex-row-reverse" : "flex-row")}
                  >
                    <UserAvatar
                      id={message.sender.id}
                      name={message.sender.name}
                      avatar={message.sender.avatar}
                      avatarUrl={message.sender.avatarUrl}
                      size="sm"
                      className="mt-0.5 shrink-0"
                    />
                    <div
                      className={cn(
                        "max-w-[min(100%,36rem)] min-w-0 rounded-2xl border px-3.5 py-2.5",
                        isOwn
                          ? "border-primary/25 bg-primary/10"
                          : "border-border/80 bg-background/60",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
                          isOwn ? "justify-end" : "justify-start",
                        )}
                      >
                        <span className="text-xs font-medium text-foreground/90">
                          {isOwn ? t("chat.you") : message.sender.name}
                        </span>
                        <ChatTimestamp iso={message.createdAt} />
                        {isOwn ? (
                          <button
                            type="button"
                            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 transition hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t("chat.deleteConfirm")}
                            onClick={() => setDeleteTarget(message)}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-foreground/95">
                        {message.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {showNewMessages ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center md:left-[300px]">
              <Button
                type="button"
                size="sm"
                className="pointer-events-auto h-8 gap-1.5 rounded-full shadow-md"
                onClick={scrollToBottom}
              >
                <ArrowDown className="size-3.5" />
                {t("chat.newMessages")}
              </Button>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="border-t border-border/60 bg-background/40 px-4 py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
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
                  className="min-h-9 max-h-40 resize-none overflow-x-hidden overflow-y-auto bg-card py-2 leading-5 wrap-break-word"
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
                disabled={!canSend || sendMutation.isPending}
                className="h-9 w-full shrink-0 sm:w-auto"
              >
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("chat.sending")}
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    {t("chat.send")}
                  </>
                )}
              </Button>
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
    </>
  );
}

function ChatPageSkeleton() {
  return (
    <div className="flex w-full">
      <div className="hidden w-[300px] shrink-0 flex-col gap-2 border-r border-border p-3 md:flex">
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
