import { Bell, ChevronDown, HelpCircle } from "lucide-react";
import { GlobalSearch } from "@/components/app/GlobalSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { toast } from "sonner";
import { logout } from "@/lib/api/auth";
import { getSelectedWorkspaceId, preserveWorkspaceSelectionForUser } from "@/lib/api/client";
import { resetWorkspaceValidationSession } from "@/lib/auth/auth-cache";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { useCurrentUser, workspaceRoleLabel } from "@/lib/auth/use-current-user";
import { UserAvatar } from "@/components/app/UserAvatar";
import type { WorkspaceRole } from "@/lib/api/auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchNotifications,
  isWorkspaceInvitationNotification,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
  type NotificationItem,
} from "@/lib/api/notifications";
import { activateWorkspace } from "@/lib/workspace-queries";
const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
const NOTIFICATIONS_POLL_MS = 45_000;

function formatNotificationTime(createdAt: string, lang: string) {
  const date = new Date(createdAt);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return lang === "ru" ? "только что" : "just now";
  }
  if (diffMinutes < 60) {
    return lang === "ru" ? `${diffMinutes} мин назад` : `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return lang === "ru" ? `${diffHours} ч назад` : `${diffHours}h ago`;
  }

  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function getNotificationTitle(
  notification: NotificationItem,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (isWorkspaceInvitationNotification(notification)) {
    return t("invite.bellTitle");
  }
  return notification.title;
}

function getNotificationBody(
  notification: NotificationItem,
  t: ReturnType<typeof useI18n>["t"],
): string | null {
  if (isWorkspaceInvitationNotification(notification)) {
    const role = notification.invitationRole
      ? workspaceRoleLabel(notification.invitationRole as WorkspaceRole, t)
      : "";
    const workspace = notification.workspaceName ?? notification.body ?? "";
    return t("invite.bellBody").replace("{workspace}", workspace).replace("{role}", role);
  }
  return notification.body;
}

export function AppTopbar({ workspaceRole }: { workspaceRole?: WorkspaceRole | null }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasToken = typeof window !== "undefined" && !!getAuthToken();
  const { data: me, isPending, isError } = useCurrentUser();
  const currentUser = me?.user;
  const showProfile = hasToken && !isError && !!currentUser;
  const showProfilePlaceholder = hasToken && !isError && !currentUser;
  const profileRoleLabel = workspaceRole ? workspaceRoleLabel(workspaceRole, t) : t("role.member");
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    enabled: hasToken,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (currentUser) {
        preserveWorkspaceSelectionForUser(currentUser.id, currentUser.email);
      }
      try {
        await logout();
      } finally {
        clearAuthToken();
      }
    },
    onSuccess: async () => {
      resetWorkspaceValidationSession();
      await queryClient.removeQueries({ queryKey: ["auth"] });
      void router.navigate({ to: "/signin" });
    },
    onError: () => {
      if (currentUser) {
        preserveWorkspaceSelectionForUser(currentUser.id, currentUser.email);
      }
      clearAuthToken();
      resetWorkspaceValidationSession();
      void queryClient.removeQueries({ queryKey: ["auth"] });
      void router.navigate({ to: "/signin" });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      toast.success(t("top.allMarkedAsRead"));
    },
  });

  function handleNotificationClick(notification: NotificationItem) {
    setNotificationsOpen(false);

    void (async () => {
      try {
        const shouldSwitchWorkspace =
          notification.workspaceId &&
          !isWorkspaceInvitationNotification(notification) &&
          notification.workspaceId !== getSelectedWorkspaceId();

        if (shouldSwitchWorkspace) {
          await activateWorkspace(queryClient, notification.workspaceId!);
          toast.success(t("workspace.switched"));
        }

        if (!notification.isRead && !isWorkspaceInvitationNotification(notification)) {
          await markNotificationRead(notification.id);
          void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        }

        const target = resolveNotificationTarget(notification);
        if (target) {
          await router.navigate({
            to: target.to,
            ...(target.search ? { search: target.search } : {}),
          });
        }
      } catch {
        toast.error(t("top.couldNotOpenNotification"));
      }
    })();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur sm:gap-3 sm:px-6">
      <GlobalSearch />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        <button
          onClick={() => setHelpOpen(true)}
          className="hidden sm:grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <HelpCircle className="size-4" />
        </button>
        <DropdownMenu
          modal={false}
          open={notificationsOpen}
          onOpenChange={(open) => {
            setNotificationsOpen(open);
            if (open) {
              void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground outline-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30"
            >
              <Bell className="size-4" />
              <span
                className={
                  "absolute -right-0.5 -top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full px-1 text-[10px] font-semibold leading-none " +
                  (unreadCount > 0
                    ? "bg-primary text-primary-foreground"
                    : "pointer-events-none opacity-0")
                }
                aria-hidden={unreadCount === 0}
              >
                {unreadCount > 9 ? "9+" : unreadCount || "0"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="flex w-80 flex-col overflow-hidden p-1"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuLabel className="flex shrink-0 items-center justify-between">
              {t("top.notifications")}
              {unreadCount > 0 && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {t("top.notificationsUnread").replace("{count}", String(unreadCount))}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="shrink-0" />
            {notificationsQuery.isLoading && (
              <p className="shrink-0 px-2 py-3 text-xs text-muted-foreground">…</p>
            )}
            {!notificationsQuery.isLoading && notifications.length === 0 && (
              <div className="flex shrink-0 flex-col items-center gap-1 px-3 py-6 text-center">
                <span className="grid size-9 place-items-center rounded-full bg-muted/60 text-muted-foreground">
                  <Bell className="size-4" />
                </span>
                <p className="text-sm font-medium text-foreground">{t("top.notificationsEmpty")}</p>
              </div>
            )}
            {notifications.length > 0 && (
              <div className="app-scrollbar max-h-80 min-h-0 overflow-y-auto overscroll-contain">
                {notifications.map((item) => {
                  const body = getNotificationBody(item, t);
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      className={
                        "items-start gap-2 py-2 " + (!item.isRead ? "bg-secondary/50" : "")
                      }
                      onClick={() => handleNotificationClick(item)}
                    >
                      <span
                        className={
                          "mt-1.5 size-2 shrink-0 rounded-full " +
                          (item.isRead ? "bg-muted" : "bg-primary")
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug">
                          {getNotificationTitle(item, t)}
                        </span>
                        {body && (
                          <span className="block text-xs text-muted-foreground line-clamp-2">
                            {body}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {formatNotificationTime(item.createdAt, lang)}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            )}
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator className="shrink-0" />
                <DropdownMenuItem
                  className="shrink-0"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={unreadCount === 0 || markAllReadMutation.isPending}
                >
                  {t("top.markAllAsRead")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {showProfilePlaceholder && (
          <div className="flex items-center gap-2 rounded-lg p-1 pr-2" aria-hidden>
            <Skeleton className="size-8 rounded-md" />
            <span className="hidden space-y-1 xl:block">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </span>
          </div>
        )}
        {showProfile && currentUser && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex shrink-0 items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-secondary outline-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30"
              >
                <UserAvatar
                  id={currentUser.id}
                  name={currentUser.name}
                  avatar={currentUser.avatar}
                  avatarUrl={currentUser.avatarUrl}
                  size="md"
                  className="rounded-md"
                />
                <span className="hidden text-left xl:block">
                  <span className="block text-sm font-medium leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-tight">
                    {profileRoleLabel}
                  </span>
                </span>
                <ChevronDown className="hidden size-3.5 text-muted-foreground xl:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <DropdownMenuLabel>{currentUser.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/settings" search={{ tab: "profile" }}>
                  {t("settings.profileSettings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/settings" search={{ tab: "workspace" }}>
                  {t("settings.workspaceSettings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/billing">{t("side.billing")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {t("common.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TeamFlow {t("top.help")}</DialogTitle>
            <DialogDescription>{t("top.helpDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {t("top.helpTip")}
          </div>
        </DialogContent>
      </Dialog>

    </header>
  );
}
