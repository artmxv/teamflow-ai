import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/app/UserAvatar";
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
import {
  createChannelConversation,
  type ChatConversation,
  updateChatConversationsCache,
} from "@/lib/api/chat";
import { fetchWorkspaceMembers } from "@/lib/api/workspace-members";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NewChannelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationReady: (conversation: ChatConversation) => void;
};

export function NewChannelDialog({
  open,
  onOpenChange,
  currentUserId,
  onConversationReady,
}: NewChannelDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const membersQuery = useQuery({
    queryKey: ["workspace-members"],
    queryFn: fetchWorkspaceMembers,
    enabled: open,
  });

  const members = (membersQuery.data ?? []).filter((member) => member.id !== currentUserId);
  const createMutation = useMutation({
    mutationFn: createChannelConversation,
    onSuccess: (conversation) => {
      updateChatConversationsCache(queryClient, (old) => [
        conversation,
        ...old.filter((item) => item.id !== conversation.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      toast.success(t("chat.channelCreated"));
      setTitle("");
      setSelectedIds([]);
      onOpenChange(false);
      onConversationReady(conversation);
    },
    onError: () => toast.error(t("chat.channelCreateFailed")),
  });

  function toggleMember(memberId: string) {
    setSelectedIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !createMutation.isPending) {
          setTitle("");
          setSelectedIds([]);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-h-0 max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/14 text-primary">
              <Users className="size-4" aria-hidden="true" />
            </span>
            {t("chat.createChannel")}
          </DialogTitle>
          <DialogDescription>{t("chat.channelMembersHint")}</DialogDescription>
        </DialogHeader>

        <div className="app-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <label className="grid gap-2 text-sm font-medium">
            {t("chat.channelName")}
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("chat.channelNamePlaceholder")}
              maxLength={80}
              autoFocus
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{t("chat.channelMembers")}</span>
              <span className="text-xs text-muted-foreground">{selectedIds.length}</span>
            </div>
            <div className="app-scrollbar max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/25 p-2">
              {membersQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {t("common.loading")}
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                  <Users className="size-5" /> {t("chat.membersEmpty")}
                </div>
              ) : (
                members.map((member) => {
                  const selected = selectedIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleMember(member.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                        selected
                          ? "border-primary/30 bg-primary/10"
                          : "border-transparent hover:bg-accent/60",
                      )}
                    >
                      <UserAvatar
                        id={member.id}
                        name={member.name}
                        avatar={member.avatar}
                        avatarUrl={member.avatarUrl}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{member.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-md border",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background",
                        )}
                      >
                        {selected ? <Check className="size-3.5" /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-muted/20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:py-3">
          <Button
            variant="brand"
            disabled={!title.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({ title: title.trim(), memberIds: selectedIds })}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Users className="size-4" aria-hidden="true" />
            )}
            {createMutation.isPending ? t("chat.channelCreating") : t("chat.channelCreate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
