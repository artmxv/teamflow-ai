import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import { toast } from "sonner";
import { ArrowDown, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";

import { requireAuth } from "@/lib/auth/route-guards";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_MESSAGES_PAGE_SIZE,
  CHAT_POLL_MS,
  chatMessagesQueryKey,
  deleteChatMessage,
  encodeChatCursor,
  fetchChatMessages,
  mergeChatMessages,
  sendChatMessage,
  updateChatMessagesCache,
  validateChatDraft,
  type ChatMessage,
  type ChatMessagesPage,
} from "@/lib/api/chat";
import { getSelectedWorkspaceId } from "@/lib/api/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Chat — TeamFlow AI" }] }),
  component: WorkspaceChatPage,
});

const NEAR_BOTTOM_PX = 80;

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

function WorkspaceChatPage() {
  const { t } = useI18n();
  const { data: me } = useCurrentUser();
  const user = me?.user;
  const queryClient = useQueryClient();
  const workspaceId = me?.workspace?.id ?? getSelectedWorkspaceId();
  const queryKey = chatMessagesQueryKey(workspaceId);

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const pendingScrollRestoreRef = useRef<{ previousHeight: number; previousTop: number } | null>(
    null,
  );

  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

  const messagesQuery = useQuery({
    queryKey,
    queryFn: () => fetchChatMessages({ limit: CHAT_MESSAGES_PAGE_SIZE }),
    enabled: Boolean(workspaceId),
    refetchOnWindowFocus: true,
    structuralSharing: false,
  });

  const page = messagesQuery.data;
  const messages = page?.messages ?? [];

  // Lightweight polling for newer messages. Keeps already-loaded older history.
  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    async function pollNewer() {
      if (document.visibilityState === "hidden") {
        return;
      }

      const current = queryClient.getQueryData<ChatMessagesPage>(queryKey);
      if (!current) {
        return;
      }

      const after = current.pageInfo.newestCursor;
      if (!after) {
        // Empty chat: refresh the latest page.
        try {
          const fresh = await fetchChatMessages({ limit: CHAT_MESSAGES_PAGE_SIZE });
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
        const newer = await fetchChatMessages({
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
    }

    const intervalId = window.setInterval(() => {
      void pollNewer();
    }, CHAT_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [workspaceId, queryClient, queryKey]);

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
    setShowNewMessages(false);
  }, [workspaceId]);

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
      const older = await fetchChatMessages({
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
    mutationFn: (content: string) => sendChatMessage(content),
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

      stickToBottomRef.current = true;
      setShowNewMessages(false);
      setDraft("");
      setDraftError(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("chat.sendFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChatMessage(id),
    onSuccess: (_data, id) => {
      updateChatMessagesCache(queryClient, (old) => ({
        ...old,
        messages: old.messages.filter((message) => message.id !== id),
      }));
      setDeleteTarget(null);
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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!sendMutation.isPending) {
        submitDraft();
      }
    }
  }

  const remaining = CHAT_MESSAGE_MAX_LENGTH - draft.length;
  const canSend = draft.trim().length > 0 && draft.trim().length <= CHAT_MESSAGE_MAX_LENGTH;

  return (
    <AppShell>
      <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} className="mb-4" />

      <div className="relative flex h-[calc(100vh-11rem)] min-h-112 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
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
                  {messages.length > 0 ? t("chat.title") : ""}
                </span>
              )}
            </div>

            <div
              ref={listRef}
              onScroll={handleScroll}
              className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4"
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
                  const isOwn = user?.id === message.sender.id;
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
                          "max-w-[min(100%,36rem)] rounded-2xl border px-3.5 py-2.5",
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
              <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center">
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
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Textarea
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
                    rows={2}
                    maxLength={CHAT_MESSAGE_MAX_LENGTH + 50}
                    className="min-h-[64px] resize-none bg-card"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
                    <p className="text-[11px] text-destructive">{draftError ?? "\u00a0"}</p>
                    <p
                      className={cn(
                        "text-[11px] tabular-nums text-muted-foreground",
                        remaining < 0 && "text-destructive",
                      )}
                    >
                      {Math.max(0, remaining)}
                    </p>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={!canSend || sendMutation.isPending}
                  className="mb-6 shrink-0"
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
      </div>

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
    </AppShell>
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
