import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

import { ChatMessagePinButton } from "@/components/app/chat/ChatMessagePins";
import {
  ChatMessageReactionPicker,
  useChatMessageReactionActions,
} from "@/components/app/chat/ChatMessageReactions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatMessage } from "@/lib/api/chat";
import { CHAT_REACTION_EMOJI } from "@/lib/chat/reactions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChatMessageActionsProps = {
  conversationId: string;
  message: ChatMessage;
  workspaceId: string | null;
  isOwn: boolean;
  align: "start" | "end";
  onDelete: () => void;
  /**
   * `toolbar` — hover/focus strip beside the bubble (xl+).
   * `menu` — compact MoreHorizontal inside the bubble (below xl, only when active).
   */
  variant: "toolbar" | "menu";
  /** For `menu`: show the trigger (selected / focused message). */
  isActive?: boolean;
  /** Controlled open state for the mobile actions menu (e.g. long press). */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
};

/**
 * Desktop (xl+): compact hover/focus toolbar next to the bubble.
 * Narrow viewports: one MoreHorizontal inside the bubble, only while the message is active.
 */
export function ChatMessageActions({
  conversationId,
  message,
  workspaceId,
  isOwn,
  align,
  onDelete,
  variant,
  isActive = false,
  menuOpen,
  onMenuOpenChange,
}: ChatMessageActionsProps) {
  const { t } = useI18n();
  const { reactions, pendingEmoji, toggleReaction, currentUserId } =
    useChatMessageReactionActions();
  const [uncontrolledMenuOpen, setUncontrolledMenuOpen] = useState(false);
  const isMenuControlled = menuOpen !== undefined;
  const mobileMenuOpen = isMenuControlled ? menuOpen : uncontrolledMenuOpen;
  const setMobileMenuOpen = (open: boolean) => {
    if (!isMenuControlled) {
      setUncontrolledMenuOpen(open);
    }
    onMenuOpenChange?.(open);
  };
  const isPinned = Boolean(message.pin);

  if (variant === "toolbar") {
    return (
      <div
        className={cn(
          "hidden shrink-0 flex-col items-center gap-0.5 pt-0.5 xl:flex",
          "opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          "has-[[data-state=open]]:opacity-100",
          isPinned && "opacity-100",
        )}
      >
        <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/90 p-0.5 shadow-sm">
          <ChatMessageReactionPicker alwaysVisible />
          {workspaceId ? (
            <ChatMessagePinButton
              conversationId={conversationId}
              message={message}
              workspaceId={workspaceId}
              alwaysVisible
            />
          ) : null}
          {isOwn ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground/80 hover:bg-destructive/10 hover:text-destructive"
              aria-label={t("chat.deleteConfirm")}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // Inline menu trigger: reserve no layout space until the message is active / menu open.
  if (!isActive && !mobileMenuOpen) {
    return null;
  }

  return (
    <div className="shrink-0 xl:hidden">
      <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-message-actions-trigger=""
            className="size-10 shrink-0 text-muted-foreground"
            aria-label={t("chat.messageActions")}
            onClick={(event) => {
              // Keep the parent message selected; don't bubble as a new "select".
              event.stopPropagation();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align === "end" ? "end" : "start"}
          side="bottom"
          collisionPadding={12}
          className="min-w-44"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div
            className="flex items-center justify-center gap-0.5 px-1 py-1"
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
                    "inline-flex size-10 items-center justify-center rounded-md text-base transition hover:bg-muted",
                    reactedByMe && "bg-primary/15",
                  )}
                  aria-label={reactedByMe ? t("chat.removeReaction") : t("chat.addReaction")}
                  aria-pressed={reactedByMe}
                  disabled={Boolean(pendingEmoji)}
                  onClick={() => {
                    toggleReaction(emoji);
                    setMobileMenuOpen(false);
                  }}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              );
            })}
          </div>
          {workspaceId ? (
            <>
              <DropdownMenuSeparator />
              <ChatMessagePinButton
                conversationId={conversationId}
                message={message}
                workspaceId={workspaceId}
                asMenuItem
                onDone={() => setMobileMenuOpen(false)}
              />
            </>
          ) : null}
          {isOwn ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onSelect={() => {
                  setMobileMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t("chat.deleteConfirm")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
