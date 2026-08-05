import { ArrowLeft, MoreHorizontal, Pencil, Pin, PinOff, Users } from "lucide-react";

import { ChatPinnedMessagesHeaderButton } from "@/components/app/chat/ChatMessagePins";
import { ChatOnlineDot } from "@/components/app/chat/ChatOnlineDot";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatConversation } from "@/lib/api/chat";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChatConversationHeaderProps = {
  conversation: ChatConversation;
  title: string;
  showBackButton: boolean;
  showOnline: boolean;
  canRenameGeneral: boolean;
  pinnedPanelOpen: boolean;
  onBack: () => void;
  onOpenProfile: (memberId: string) => void;
  onPinnedChange: (isPinned: boolean) => void;
  onOpenRename: () => void;
  onPinnedPanelOpenChange: (open: boolean) => void;
};

/**
 * Stable-height chat header. Secondary actions go into a compact menu on narrow screens.
 * Pin (conversation) uses Pin icons; pinned messages use Bookmark in ChatPinnedMessagesHeaderButton.
 */
export function ChatConversationHeader({
  conversation,
  title,
  showBackButton,
  showOnline,
  canRenameGeneral,
  pinnedPanelOpen,
  onBack,
  onOpenProfile,
  onPinnedChange,
  onOpenRename,
  onPinnedPanelOpenChange,
}: ChatConversationHeaderProps) {
  const { t } = useI18n();
  const directParticipant = conversation.type === "DIRECT" ? conversation.otherParticipant : null;
  const showRename = conversation.type === "WORKSPACE" && canRenameGeneral;
  const pinLabel = conversation.isPinned ? t("chat.unpinChat") : t("chat.pinChat");

  return (
    <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border/60 px-2 sm:gap-2 sm:px-3">
      {showBackButton ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 md:size-8"
          onClick={onBack}
          aria-label={t("chat.backToList")}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
      ) : null}

      {directParticipant ? (
        <>
          <span className="relative shrink-0">
            <UserAvatar
              id={directParticipant.id}
              name={directParticipant.name}
              avatar={directParticipant.avatar}
              avatarUrl={directParticipant.avatarUrl}
              size="sm"
              className="shrink-0"
            />
            {showOnline ? (
              <ChatOnlineDot
                label={t("chat.online")}
                className="absolute right-0 bottom-0 ring-2 ring-card"
              />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className={cn(
                "block max-w-full cursor-pointer truncate rounded-sm text-left text-sm font-semibold transition-colors",
                "hover:text-foreground/80 hover:underline hover:underline-offset-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
              aria-label={t("chat.openUserProfile").replace("{name}", directParticipant.name)}
              onClick={() => onOpenProfile(directParticipant.id)}
            >
              {title}
            </button>
            <p className="h-4 truncate text-[11px] leading-4 text-muted-foreground">
              {conversation.unreadCount > 0
                ? conversation.unreadCount === 1
                  ? t("chat.unreadOne")
                  : t("chat.unreadMany").replace("{count}", String(conversation.unreadCount))
                : showOnline
                  ? t("chat.online")
                  : "\u00a0"}
            </p>
          </div>
        </>
      ) : (
        <>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
            aria-hidden="true"
          >
            <Users className="size-3.5 shrink-0" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h3 className="truncate text-sm font-semibold leading-5">{title}</h3>
            <p className="mt-0.5 h-4 truncate text-[11px] leading-4 text-muted-foreground">
              {conversation.unreadCount > 0
                ? conversation.unreadCount === 1
                  ? t("chat.unreadOne")
                  : t("chat.unreadMany").replace("{count}", String(conversation.unreadCount))
                : "\u00a0"}
            </p>
          </div>
        </>
      )}

      <ChatPinnedMessagesHeaderButton
        open={pinnedPanelOpen}
        onOpenChange={onPinnedPanelOpenChange}
      />

      {/* Desktop: pin + rename visible */}
      <div className="hidden items-center gap-0.5 sm:flex">
        {showRename ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t("chat.renameChat")}
            onClick={onOpenRename}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          title={pinLabel}
          aria-label={pinLabel}
          onClick={() => onPinnedChange(!conversation.isPinned)}
        >
          {conversation.isPinned ? (
            <PinOff className="size-4" aria-hidden="true" />
          ) : (
            <Pin className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Mobile: secondary actions in overflow menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 sm:hidden"
            aria-label={t("chat.conversationActions")}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={12} className="min-w-44">
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => onPinnedChange(!conversation.isPinned)}
          >
            {conversation.isPinned ? (
              <PinOff className="size-4" aria-hidden="true" />
            ) : (
              <Pin className="size-4" aria-hidden="true" />
            )}
            {pinLabel}
          </DropdownMenuItem>
          {showRename ? (
            <DropdownMenuItem className="gap-2" onSelect={onOpenRename}>
              <Pencil className="size-4" aria-hidden="true" />
              {t("chat.renameChat")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
