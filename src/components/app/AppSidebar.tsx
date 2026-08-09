import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, PanelLeftClose, PanelLeftOpen, ChevronDown, Check, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";
import { displayWorkspaceName } from "@/lib/workspace-display";
import { displayProjectName } from "@/lib/starter-content";
import { nameToInitials, isWorkspaceManager, useCurrentUser } from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { ApiError, setSelectedWorkspaceId } from "@/lib/api/client";
import { fetchWorkspaces, switchWorkspace } from "@/lib/api/workspaces";
import { invalidateWorkspaceScopedQueries, WORKSPACES_QUERY_KEY } from "@/lib/workspace-queries";
import { getWorkspaceAccent, type WorkspaceColorInput } from "@/lib/workspace-color";
import { BrandAiBadge, BrandMark } from "@/components/brand/BrandLogo";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { DeleteWorkspaceDialog } from "./DeleteWorkspaceDialog";
import { NewProjectDialog } from "./QuickActionDialogs";
import type { Workspace } from "./AppShell";
import { fetchProjects } from "@/lib/api/projects";
import {
  BILLING_SUMMARY_QUERY_KEY,
  fetchBillingSummary,
  type BillingPlanId,
} from "@/lib/api/billing";
import { getProjectAccent } from "@/lib/project-color";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_NAV_ITEMS, isAppNavItemActive } from "@/lib/app-nav";
import { useChatUnreadCount } from "@/lib/api/use-chat-unread-count";

const PLAN_LABEL_KEYS: Record<BillingPlanId, TKey> = {
  FREE: "billing.plan.free",
  TEAM: "billing.plan.team",
  BUSINESS: "billing.plan.business",
  ENTERPRISE: "billing.plan.enterprise",
};

function SidebarTip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {collapsed ? <TooltipContent side="right">{label}</TooltipContent> : null}
    </Tooltip>
  );
}

function SidebarSectionHeading({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  if (collapsed) {
    return <div className="h-6 shrink-0" aria-hidden />;
  }

  return (
    <div className="app-sidebar__reveal flex h-6 shrink-0 items-center gap-2 overflow-hidden px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/70">
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-sidebar-border" aria-hidden />
    </div>
  );
}

function WorkspaceAvatar({
  item,
  initials,
  size = "size-6",
}: {
  item: WorkspaceColorSource;
  initials: string;
  size?: string;
}) {
  const accent = getWorkspaceAccent(item);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-gradient-to-br text-[10px] font-semibold text-white shadow-sm",
        size,
        accent.gradient,
      )}
    >
      {initials}
    </span>
  );
}

type WorkspaceColorSource = WorkspaceColorInput;

function WorkspaceSwitcherSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
  );
}

function WorkspaceSwitcher({
  workspace,
  loading,
  collapsed,
}: {
  workspace: Workspace | null;
  loading: boolean;
  collapsed: boolean;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: fetchWorkspaces,
    enabled: !!workspace,
  });

  const switchMutation = useMutation({
    mutationFn: switchWorkspace,
    onSuccess: async (selected) => {
      setSelectedWorkspaceId(selected.id);
      await invalidateWorkspaceScopedQueries(queryClient);
      toast.success(t("workspace.switched"));
      void navigate({ to: "/app/dashboard" });
    },
    onError: () => {
      toast.error(t("workspace.switchFailed"));
    },
  });

  if (loading && !workspace) {
    return (
      <div
        className="grid h-12 w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-xl border border-sidebar-border bg-card px-2"
        aria-hidden
      >
        <span className="grid size-8 place-items-center">
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </span>
        {!collapsed ? (
          <span className="app-sidebar__reveal flex min-w-0 items-center gap-2 pl-2.5">
            <Skeleton className="h-4 min-w-0 flex-1" />
            <span className="grid size-4 shrink-0 place-items-center">
              <Skeleton className="size-4 shrink-0 rounded-sm" />
            </span>
          </span>
        ) : (
          <span className="min-w-0" aria-hidden />
        )}
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  const currentWorkspaceItem = workspaces.find((item) => item.id === workspace.id);
  const canDeleteCurrent = currentWorkspaceItem?.role === "OWNER";
  const otherWorkspaces = workspaces.filter((item) => item.id !== workspace.id);
  const currentAccentSource: WorkspaceColorSource = {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
  };

  const displayName = displayWorkspaceName(workspace.name, lang);

  const trigger = (
    <button
      type="button"
      title={displayName}
      className="grid h-12 w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-xl border border-sidebar-border/80 bg-card px-2 text-left shadow-soft outline-none transition-colors hover:border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-sidebar-ring/40 focus-visible:ring-offset-0 data-[state=open]:border-border data-[state=open]:shadow-soft"
    >
      <span className="grid size-8 place-items-center">
        <WorkspaceAvatar item={currentAccentSource} initials={workspace.initials} size="size-7" />
      </span>
      {!collapsed ? (
        <span className="app-sidebar__reveal flex min-w-0 items-center gap-2.5 overflow-hidden pl-2.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium leading-none">
            {displayName}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </span>
      ) : (
        <span className="min-w-0" aria-hidden />
      )}
    </button>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-72 rounded-xl border border-border/80 bg-popover p-1.5 shadow-xl ring-1 ring-black/5 dark:border-border dark:bg-popover dark:ring-white/10"
        side={collapsed ? "right" : "bottom"}
      >
        <WorkspaceSwitcherSectionLabel>
          {t("workspace.currentWorkspace")}
        </WorkspaceSwitcherSectionLabel>
        <DropdownMenuItem
          disabled
          className="gap-2.5 rounded-lg px-2 py-2 opacity-100 focus:bg-muted/60 data-[disabled]:opacity-100"
        >
          <WorkspaceAvatar item={currentAccentSource} initials={workspace.initials} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName}</span>
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5 bg-border/60" />

        <WorkspaceSwitcherSectionLabel>
          {t("workspace.switchWorkspace")}
        </WorkspaceSwitcherSectionLabel>
        {workspacesLoading && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("common.loading")}</div>
        )}
        {!workspacesLoading && otherWorkspaces.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t("workspace.noOtherWorkspaces")}
          </div>
        )}
        {otherWorkspaces.map((item) => (
          <DropdownMenuItem
            key={item.id}
            className="gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent/80 focus:bg-accent/80"
            disabled={switchMutation.isPending}
            onSelect={() => switchMutation.mutate(item.id)}
          >
            <WorkspaceAvatar item={item} initials={nameToInitials(item.name)} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {displayWorkspaceName(item.name, lang)}
            </span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="my-1.5 bg-border/60" />

        <WorkspaceSwitcherSectionLabel>{t("workspace.actions")}</WorkspaceSwitcherSectionLabel>
        <DropdownMenuItem asChild className="rounded-lg px-2 py-2 text-sm">
          <Link to="/app/settings" search={{ tab: "workspace" }} className="cursor-pointer">
            {t("settings.workspaceSettings")}
          </Link>
        </DropdownMenuItem>
        <CreateWorkspaceDialog>
          <DropdownMenuItem
            className="cursor-pointer rounded-lg px-2 py-2 text-sm"
            onSelect={(event) => event.preventDefault()}
          >
            {t("workspace.createWorkspace")}
          </DropdownMenuItem>
        </CreateWorkspaceDialog>
        {canDeleteCurrent ? (
          <DeleteWorkspaceDialog workspaceId={workspace.id}>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg px-2 py-2 text-sm text-destructive focus:text-destructive"
              onSelect={(event) => event.preventDefault()}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("workspace.deleteWorkspace")}
            </DropdownMenuItem>
          </DeleteWorkspaceDialog>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar({
  workspace,
  workspaceLoading,
  collapsed,
  onToggleCollapsed,
}: {
  workspace: Workspace | null;
  workspaceLoading: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t, lang } = useI18n();
  const { data: me } = useCurrentUser();
  const { unreadCount: chatUnreadCount } = useChatUnreadCount(Boolean(workspace));
  const canManageProjects = isWorkspaceManager(me?.workspace?.role);
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });
  const billingQuery = useQuery({
    queryKey: BILLING_SUMMARY_QUERY_KEY,
    queryFn: fetchBillingSummary,
  });
  const currentPlanLabel =
    billingQuery.isSuccess && billingQuery.data
      ? t(PLAN_LABEL_KEYS[billingQuery.data.currentPlan])
      : null;
  const activeProjectId = pathname.match(/^\/app\/projects\/([^/]+)/)?.[1];
  const toggleLabel = collapsed ? t("side.expandSidebar") : t("side.collapseSidebar");

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "app-sidebar sticky top-0 hidden h-svh shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(.22,.8,.22,1)] md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="relative h-16 shrink-0 overflow-hidden border-b border-sidebar-border/70">
          <div className="app-sidebar__expanded-icon absolute left-4 top-4 grid size-8 place-items-center">
            <BrandMark className="size-7 rounded-[10px]" />
          </div>
          {!collapsed ? (
            <div className="app-sidebar__reveal absolute inset-y-0 left-14 flex w-36 flex-col justify-center overflow-hidden leading-tight">
              <div className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-sidebar-foreground">
                TeamFlow
                <BrandAiBadge />
              </div>
              <div className="text-[11px] text-muted-foreground">{t("side.tagline")}</div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={toggleLabel}
            aria-label={toggleLabel}
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/40"
          >
            <PanelLeftOpen
              className="app-sidebar__collapse-only absolute inset-0 m-auto size-4"
              aria-hidden
            />
            <PanelLeftClose
              className="app-sidebar__expanded-icon absolute inset-0 m-auto size-4"
              aria-hidden
            />
          </button>
        </div>

        <div className="shrink-0 px-2 pt-3">
          <WorkspaceSwitcher
            workspace={workspace}
            loading={workspaceLoading}
            collapsed={collapsed}
          />
        </div>

        <nav className="mt-5 flex min-h-0 flex-1 flex-col px-2">
          <div className="shrink-0">
            <SidebarSectionHeading collapsed={collapsed}>
              {t("side.workspace")}
            </SidebarSectionHeading>
            <ul className="space-y-0.5">
              {APP_NAV_ITEMS.map((item) => {
                const active = isAppNavItemActive(pathname, item.to);
                const Icon = item.icon;
                const label = t(item.key);
                const isPlansItem = item.to === "/app/billing";
                const planBadge = isPlansItem ? currentPlanLabel : null;
                const showUnread = item.to === "/app/chat" && chatUnreadCount > 0;
                const tipLabel = showUnread
                  ? `${label} (${chatUnreadCount > 99 ? "99+" : chatUnreadCount})`
                  : isPlansItem && planBadge
                    ? `${label} — ${planBadge}`
                    : label;
                return (
                  <li key={item.to}>
                    <SidebarTip collapsed={collapsed} label={tipLabel}>
                      <Link
                        to={item.to}
                        title={collapsed ? tipLabel : undefined}
                        aria-current={active ? "page" : undefined}
                        aria-label={
                          showUnread
                            ? t("chat.navUnread").replace("{count}", String(chatUnreadCount))
                            : undefined
                        }
                        className={cn(
                          "group relative grid h-9 grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-lg border-l-2 pl-1.5 pr-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring/40",
                          active
                            ? "border-l-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "border-l-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center">
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              active
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-sidebar-foreground",
                            )}
                          />
                        </span>
                        {!collapsed ? (
                          <span className="app-sidebar__reveal flex min-w-0 items-center gap-2 overflow-hidden">
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {planBadge ? (
                              <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                                {planBadge}
                              </span>
                            ) : null}
                            {showUnread ? (
                              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                                {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="min-w-0" aria-hidden />
                        )}
                        {showUnread ? (
                          <span
                            className="app-sidebar__collapse-only absolute right-1.5 top-1.5 size-2 rounded-full bg-primary"
                            aria-hidden
                          />
                        ) : null}
                      </Link>
                    </SidebarTip>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-7 flex min-h-0 flex-1 flex-col pb-3 pt-2">
            <SidebarSectionHeading collapsed={collapsed}>
              {t("side.projects")}
            </SidebarSectionHeading>
            <ul className="app-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
              {!collapsed && projectsLoading ? (
                <li className="app-sidebar__reveal flex h-8 items-center px-3 text-xs text-muted-foreground">
                  {t("side.loadingProjects")}
                </li>
              ) : null}
              {!collapsed && !projectsLoading && projects.length === 0 ? (
                <li className="app-sidebar__reveal flex h-8 items-center px-3 text-xs text-muted-foreground">
                  {t("side.noProjectsYet")}
                </li>
              ) : null}
              {projects.map((project) => {
                const projectActive = activeProjectId === project.id;
                const projectLabel = displayProjectName(project.name, lang);
                const { dot: accentDot } = getProjectAccent(project);
                return (
                  <li key={project.id}>
                    <SidebarTip collapsed={collapsed} label={projectLabel}>
                      <Link
                        to="/app/projects/$projectId"
                        params={{ projectId: project.id }}
                        title={collapsed ? projectLabel : undefined}
                        aria-current={projectActive ? "page" : undefined}
                        className={cn(
                          "grid h-9 w-full grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-lg border-l-2 pl-1.5 pr-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent/55 focus-visible:ring-2 focus-visible:ring-sidebar-ring/40",
                          projectActive
                            ? "border-l-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "border-l-transparent text-sidebar-foreground/75",
                        )}
                      >
                        <span
                          className="relative grid size-8 shrink-0 place-items-center"
                          aria-hidden
                        >
                          <span
                            className={cn(
                              "app-sidebar__collapse-only absolute size-3 rounded-full shadow-sm ring-2",
                              accentDot,
                              projectActive ? "ring-primary/25" : "ring-sidebar-border/70",
                            )}
                          />
                          <span className="app-sidebar__expanded-icon absolute grid size-5 place-items-center">
                            <span className={cn("size-2 rounded-full", accentDot)} />
                          </span>
                        </span>
                        {!collapsed ? (
                          <span className="app-sidebar__reveal min-w-0 truncate">
                            {projectLabel}
                          </span>
                        ) : (
                          <span className="min-w-0" aria-hidden />
                        )}
                      </Link>
                    </SidebarTip>
                  </li>
                );
              })}
              {canManageProjects ? (
                <li>
                  <NewProjectDialog workspaceId={workspace?.id}>
                    <button
                      type="button"
                      title={collapsed ? t("common.newProject") : undefined}
                      className="group grid h-9 w-full grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-lg border border-transparent pl-[7px] pr-2 text-sm font-medium text-sidebar-foreground/78 outline-none transition-[color,background-color,border-color,box-shadow] hover:border-primary/20 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_13%,transparent)] focus-visible:ring-2 focus-visible:ring-sidebar-ring/40"
                    >
                      <span className="grid size-8 shrink-0 place-items-center">
                        <span className="grid size-5 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Plus className="size-3.5 shrink-0" />
                        </span>
                      </span>
                      {!collapsed ? (
                        <span className="app-sidebar__reveal min-w-0 truncate text-left">
                          {t("common.newProject")}
                        </span>
                      ) : (
                        <span className="min-w-0" aria-hidden />
                      )}
                    </button>
                  </NewProjectDialog>
                </li>
              ) : null}
            </ul>
          </div>
        </nav>
      </aside>
    </TooltipProvider>
  );
}
