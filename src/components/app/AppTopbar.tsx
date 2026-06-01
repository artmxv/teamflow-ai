import { Bell, Search, ChevronDown, HelpCircle, Check } from "lucide-react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { toast } from "sonner";
import { logout } from "@/lib/api/auth";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import {
  nameToInitials,
  useCurrentUser,
  workspaceRoleLabel,
} from "@/lib/auth/use-current-user";
import type { WorkspaceRole } from "@/lib/api/auth";
import { Skeleton } from "@/components/ui/skeleton";
import type { Workspace } from "./AppShell";

const notifications = [
  { id: "n1", title: "Priya mentioned you", detail: "Review the billing edge case task." },
  { id: "n2", title: "Sprint digest ready", detail: "12 tasks moved this week." },
  { id: "n3", title: "Invite accepted", detail: "Lina joined Acme Studio." },
  { id: "n4", title: "AI credits update", detail: "67% of monthly credits used." },
];

export function AppTopbar({
  title,
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  workspaceRole,
}: {
  title: string;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  onWorkspaceChange: (workspace: Workspace) => void;
  workspaceRole?: WorkspaceRole | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasToken = typeof window !== "undefined" && !!getAuthToken();
  const { data: me, isPending, isError } = useCurrentUser();
  const currentUser = me?.user;
  const showProfile = hasToken && !isError && !!currentUser;
  const showProfilePlaceholder = hasToken && isPending && !currentUser;
  const profileRoleLabel = workspaceRole ? workspaceRoleLabel(workspaceRole) : "Member";
  const [helpOpen, setHelpOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [unread, setUnread] = useState(notifications.length);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await logout();
      } finally {
        clearAuthToken();
      }
    },
    onSuccess: async () => {
      await queryClient.removeQueries({ queryKey: ["auth"] });
      void router.navigate({ to: "/signin" });
    },
    onError: () => {
      clearAuthToken();
      void queryClient.removeQueries({ queryKey: ["auth"] });
      void router.navigate({ to: "/signin" });
    },
  });

  function markAllAsRead() {
    setUnread(0);
    toast.success(t("top.notifications"));
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur sm:gap-3 sm:px-6">
      <div className="hidden items-center gap-2 text-sm md:flex">
        <span className="font-semibold tracking-tight">{title}</span>
      </div>

      {/* Workspace switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="md:ml-2 flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm transition hover:bg-secondary">
            <span className="grid size-6 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">
              {activeWorkspace.initials}
            </span>
            <span className="hidden font-medium sm:inline">{activeWorkspace.name}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{t("top.workspaceSwitcher")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => onWorkspaceChange(w)} className="gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">{w.initials}</span>
              <span className="flex-1">
                <span className="block text-sm font-medium leading-tight">{w.name}</span>
                <span className="block text-[11px] text-muted-foreground leading-tight">
                  {w.slug ?? w.plan}
                </span>
              </span>
              {activeWorkspace.id === w.id && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="relative ml-auto hidden lg:block w-72 xl:w-80">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder={t("top.search")}
          className="h-9 w-full rounded-lg border border-input bg-secondary/60 pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring/40"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        <button
          onClick={() => setHelpOpen(true)}
          className="hidden sm:grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <HelpCircle className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <Bell className="size-4" />
              {unread > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              {t("top.notifications")}
              <span className="text-[11px] font-normal text-muted-foreground">{unread} unread</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((item, index) => (
              <DropdownMenuItem key={item.id} className="items-start gap-2 py-2">
                <span
                  className={
                    "mt-1 size-2 rounded-full " +
                    (index < unread ? "bg-primary" : "bg-muted")
                  }
                />
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={markAllAsRead}>{t("top.markAllAsRead")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {showProfilePlaceholder && (
          <div
            className="flex items-center gap-2 rounded-lg p-1 pr-2"
            aria-hidden
          >
            <Skeleton className="size-8 rounded-md" />
            <span className="hidden space-y-1 xl:block">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </span>
          </div>
        )}
        {showProfile && currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-secondary">
                <span className="grid size-8 place-items-center rounded-md bg-gradient-brand text-xs font-semibold text-white">
                  {nameToInitials(currentUser.name)}
                </span>
                <span className="hidden text-left xl:block">
                  <span className="block text-sm font-medium leading-tight">{currentUser.name}</span>
                  <span className="block text-[11px] text-muted-foreground leading-tight">
                  {profileRoleLabel}
                </span>
                </span>
                <ChevronDown className="hidden size-3.5 text-muted-foreground xl:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{currentUser.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/app/settings">{t("settings.profileSettings")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/app/settings">{t("settings.workspaceSettings")}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/app/billing">{t("side.billing")}</Link></DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>{t("top.keyboardShortcuts")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TeamFlow {t("top.help")}</DialogTitle>
            <DialogDescription>
              This demo runs on mock data. Use the sidebar to explore projects, tasks, billing, and AI assistant flows.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Need help? Try opening the task board, filtering by assignee, or using the AI suggested prompts.
          </div>
        </DialogContent>
      </Dialog>

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("top.keyboardShortcuts")}</DialogTitle>
          <DialogDescription>Quick actions available in the mock workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {[
            ["Cmd/Ctrl + K", t("top.search")],
            ["N", t("common.newTask")],
            ["G then D", t("side.dashboard")],
            ["G then B", t("side.kanban")],
          ].map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="rounded border border-border bg-card px-2 py-1 text-xs font-medium">{keys}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
