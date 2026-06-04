import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FolderKanban,
  Trello,
  Users,
  Settings,
  Sparkles,
  Plus,
  ListChecks,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Check,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";
import { nameToInitials, isWorkspaceManager, useCurrentUser } from "@/lib/auth/use-current-user";
import { NewProjectDialog } from "./QuickActionDialogs";
import type { Workspace } from "./AppShell";
import { fetchProjects } from "@/lib/api/projects";
import { getProjectAccent } from "@/lib/project-color";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

const nav: { to: string; key: TKey; icon: typeof LayoutDashboard }[] = [
  { to: "/app/dashboard", key: "side.dashboard", icon: LayoutDashboard },
  { to: "/app/projects", key: "side.projects", icon: FolderKanban },
  { to: "/app/board", key: "side.kanban", icon: Trello },
  { to: "/app/tasks", key: "side.tasks", icon: ListChecks },
  { to: "/app/team", key: "side.team", icon: Users },
  { to: "/app/ai", key: "side.assistant", icon: Sparkles },
  { to: "/app/settings", key: "side.settings", icon: Settings },
  { to: "/app/billing", key: "side.billing", icon: CreditCard },
];

function SidebarTip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!collapsed) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
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
  const { t } = useI18n();

  if (loading && !workspace) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 items-center rounded-xl border border-sidebar-border bg-card",
          collapsed ? "justify-center p-2" : "gap-2 px-3 py-2",
        )}
        aria-hidden
      >
        <Skeleton className="size-6 shrink-0 rounded-md" />
        {!collapsed && (
          <>
            <Skeleton className="h-4 min-w-0 flex-1" />
            <Skeleton className="size-4 shrink-0 rounded-sm" />
          </>
        )}
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  const trigger = (
    <button
      type="button"
      title={workspace.name}
      className={cn(
        "flex w-full min-w-0 items-center rounded-xl border border-sidebar-border bg-card text-left text-sm transition hover:bg-sidebar-accent outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        collapsed ? "justify-center p-2" : "gap-2 px-3 py-2",
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">
        {workspace.initials}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </>
      )}
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" side={collapsed ? "right" : "bottom"}>
        <DropdownMenuLabel>{t("workspace.switchWorkspace")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 opacity-100 focus:bg-secondary/50">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">
            {workspace.initials}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/settings" search={{ tab: "workspace" }} className="cursor-pointer">
            {t("settings.workspaceSettings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="flex items-center justify-between gap-2">
          <span>{t("workspace.createWorkspace")}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {t("common.comingSoon")}
          </span>
        </DropdownMenuItem>
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
  const { t } = useI18n();
  const { data: me } = useCurrentUser();
  const canManageProjects = isWorkspaceManager(me?.workspace?.role);
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });
  const activeProjectId = pathname.match(/^\/app\/projects\/([^/]+)/)?.[1];
  const toggleLabel = collapsed ? t("side.expandSidebar") : t("side.collapseSidebar");

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-linear",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 py-5",
            collapsed ? "flex-col justify-center px-2" : "px-5",
          )}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="size-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold text-sidebar-foreground">TeamFlow</div>
              <div className="text-[11px] text-muted-foreground">AI workspace</div>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={toggleLabel}
            aria-label={toggleLabel}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "" : "ml-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
          </button>
        </div>

        <div className={cn(collapsed ? "px-2" : "px-3")}>
          <WorkspaceSwitcher
            workspace={workspace}
            loading={workspaceLoading}
            collapsed={collapsed}
          />
        </div>

        <nav className={cn("mt-6 flex-1", collapsed ? "px-2" : "px-3")}>
          {!collapsed && (
            <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("side.workspace")}
            </div>
          )}
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              const label = t(item.key);
              return (
                <li key={item.to}>
                  <SidebarTip collapsed={collapsed} label={label}>
                    <Link
                      to={item.to}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "group flex items-center rounded-lg text-sm transition",
                        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  </SidebarTip>
                </li>
              );
            })}
          </ul>

          {!collapsed && (
            <div className="mt-8 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("side.projects")}
            </div>
          )}
          {collapsed && <div className="mt-6" aria-hidden />}
          <ul className="space-y-0.5">
            {!collapsed && projectsLoading && (
              <li className="px-3 py-1.5 text-xs text-muted-foreground">
                {t("side.loadingProjects")}
              </li>
            )}
            {!collapsed && !projectsLoading && projects.length === 0 && (
              <li className="px-3 py-1.5 text-xs text-muted-foreground">
                {t("side.noProjectsYet")}
              </li>
            )}
            {projects.map((project) => {
              const projectActive = activeProjectId === project.id;
              const projectLabel = project.name;
              const { dot: accentDot, gradient: accentGradient } = getProjectAccent(project);
              return (
                <li key={project.id}>
                  <SidebarTip collapsed={collapsed} label={projectLabel}>
                    <Link
                      to="/app/projects/$projectId"
                      params={{ projectId: project.id }}
                      title={collapsed ? projectLabel : undefined}
                      className={cn(
                        "flex w-full items-center rounded-lg text-left text-sm hover:bg-sidebar-accent/60",
                        collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-1.5",
                        projectActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80",
                      )}
                    >
                      {collapsed ? (
                        <span
                          className={cn(
                            "grid size-7 place-items-center rounded-md text-[10px] font-semibold",
                            projectActive
                              ? cn("bg-gradient-to-br text-white", accentGradient)
                              : "border border-sidebar-border bg-card text-sidebar-foreground",
                          )}
                        >
                          {nameToInitials(project.name)}
                        </span>
                      ) : (
                        <>
                          <span className={cn("size-2 shrink-0 rounded-full", accentDot)} />
                          <span className="truncate">{project.name}</span>
                        </>
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
                    className={cn(
                      "flex w-full items-center rounded-lg text-sm text-muted-foreground hover:text-foreground",
                      collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-1.5",
                    )}
                  >
                    <Plus className={cn("shrink-0", collapsed ? "size-4" : "size-3.5")} />
                    {!collapsed && t("common.newProject")}
                  </button>
                </NewProjectDialog>
              </li>
            ) : null}
          </ul>
        </nav>

        {!collapsed && (
          <div className="m-3 rounded-xl border border-sidebar-border bg-card p-3 shadow-soft">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Sparkles className="size-3.5 text-primary" />
              AI credits
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 rounded-full bg-gradient-brand" />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>1,340 / 2,000</span>
              <Link className="text-primary hover:underline" to="/app/billing">
                {t("billing.changePlan")}
              </Link>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
