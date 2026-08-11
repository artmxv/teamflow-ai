import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/app/UserAvatar";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createDirectConversation,
  type ChatConversation,
  updateChatConversationsCache,
} from "@/lib/api/chat";
import { fetchWorkspaceMembers, type WorkspaceMemberItem } from "@/lib/api/workspace-members";
import { useI18n } from "@/lib/i18n";
import { friendlyChatErrorMessage } from "@/lib/chat-errors";
import { cn } from "@/lib/utils";

type NewDirectMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationReady: (conversation: ChatConversation) => void;
};

export function NewDirectMessageDialog({
  open,
  onOpenChange,
  currentUserId,
  onConversationReady,
}: NewDirectMessageDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const membersQuery = useQuery({
    queryKey: ["workspace-members"],
    queryFn: fetchWorkspaceMembers,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createDirectConversation,
    onSuccess: (conversation) => {
      updateChatConversationsCache(queryClient, (old) => {
        if (old.some((item) => item.id === conversation.id)) {
          return old.map((item) => (item.id === conversation.id ? conversation : item));
        }
        return [conversation, ...old];
      });
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
      onConversationReady(conversation);
      onOpenChange(false);
      setQuery("");
    },
    onError: (error) => {
      toast.error(friendlyChatErrorMessage(error, t, "chat.directCreateFailed"));
    },
  });

  const members = useMemo(() => {
    const list = (membersQuery.data ?? []).filter((member) => member.id !== currentUserId);
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return list;
    }
    return list.filter(
      (member) =>
        member.name.toLowerCase().includes(normalized) ||
        member.email.toLowerCase().includes(normalized),
    );
  }, [membersQuery.data, currentUserId, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>{t("chat.newMessage")}</DialogTitle>
          <DialogDescription className="sr-only">{t("chat.searchMembers")}</DialogDescription>
        </DialogHeader>

        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("chat.searchMembers")}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {membersQuery.isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : membersQuery.isError ? (
            <div className="p-4">
              <ApiErrorState
                titleKey="chat.conversationsErrorTitle"
                error={membersQuery.error}
                onRetry={() => void membersQuery.refetch()}
                isRetrying={membersQuery.isFetching}
                compact
              />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title={query.trim() ? t("chat.noMembersFound") : t("chat.membersEmpty")}
              compact
              className="border-0 bg-transparent py-10 shadow-none"
            />
          ) : (
            <ul className="space-y-0.5">
              {members.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    disabled={createMutation.isPending}
                    onClick={() => createMutation.mutate(member.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                      "hover:bg-accent/70",
                      createMutation.isPending &&
                        createMutation.variables === member.id &&
                        "bg-accent/50",
                    )}
                  >
                    <UserAvatar
                      id={member.id}
                      name={member.name}
                      avatar={member.avatar}
                      avatarUrl={member.avatarUrl}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{member.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </span>
                    {createMutation.isPending && createMutation.variables === member.id ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {createMutation.isPending ? (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export type { WorkspaceMemberItem };
