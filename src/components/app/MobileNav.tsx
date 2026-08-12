import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_NAV_ITEMS, isAppNavItemActive } from "@/lib/app-nav";
import { useChatUnreadCount } from "@/lib/api/use-chat-unread-count";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandAiBadge, BrandMark } from "@/components/brand/BrandLogo";
import { WorkspaceSwitcher } from "@/components/app/AppSidebar";
import type { Workspace } from "@/components/app/AppShell";
import { fetchProjects } from "@/lib/api/projects";
import { displayProjectName } from "@/lib/starter-content";
import { getProjectAccent } from "@/lib/project-color";

export function MobileNav({
  pathname,
  workspace,
  workspaceLoading,
}: {
  pathname: string;
  workspace: Workspace | null;
  workspaceLoading: boolean;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const { unreadCount } = useChatUnreadCount();
  const activeProjectId = pathname.match(/^\/app\/projects\/([^/]+)/)?.[1];
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: open && Boolean(workspace),
    staleTime: 30_000,
  });
  const projects = projectsQuery.data ?? [];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 lg:hidden"
          aria-label={t("nav.openMenu")}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex h-dvh w-[calc(100vw-0.5rem)] max-w-80 flex-col gap-0 overflow-hidden border-sidebar-border bg-sidebar p-0"
      >
        <SheetHeader className="shrink-0 border-b border-sidebar-border/70 pb-4 pl-[max(1rem,env(safe-area-inset-left))] pr-14 pt-[max(1rem,env(safe-area-inset-top))] text-left">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8 rounded-[10px]" />
            <div className="min-w-0">
              <SheetTitle className="inline-flex items-baseline gap-1.5 text-base tracking-tight">
                <span>TeamFlow</span>
                <BrandAiBadge />
              </SheetTitle>
              <SheetDescription className="mt-0.5 truncate text-xs text-muted-foreground">
                {t("side.tagline")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="px-3 pt-3">
            <WorkspaceSwitcher
              workspace={workspace}
              loading={workspaceLoading}
              collapsed={false}
              onNavigate={() => setOpen(false)}
            />
          </div>

          <nav className="px-3 pt-4" aria-label={t("side.workspace")}>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/70">
              {t("side.workspace")}
            </p>
            <ul className="space-y-0.5">
              {APP_NAV_ITEMS.map((item) => {
                const active = isAppNavItemActive(pathname, item.to);
                const Icon = item.icon;
                const label = t(item.key);
                const showUnread = item.to === "/app/chat" && unreadCount > 0;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring/40",
                        active
                          ? "border-l-2 border-l-primary bg-sidebar-accent pl-[calc(0.75rem-2px)] font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
                      )}
                      aria-label={
                        showUnread
                          ? t("chat.navUnread").replace("{count}", String(unreadCount))
                          : undefined
                      }
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {showUnread ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <nav className="px-3 pb-3 pt-6" aria-label={t("side.projects")}>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/70">
              {t("side.projects")}
            </p>
            {projectsQuery.isLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t("side.loadingProjects")}</p>
            ) : projects.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t("side.noProjectsYet")}</p>
            ) : (
              <ul className="space-y-0.5">
                {projects.map((project) => {
                  const projectLabel = displayProjectName(project.name, lang);
                  const projectActive = activeProjectId === project.id;
                  return (
                    <li key={project.id}>
                      <Link
                        to="/app/projects/$projectId"
                        params={{ projectId: project.id }}
                        onClick={() => setOpen(false)}
                        aria-current={projectActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 min-w-0 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring/40",
                          projectActive
                            ? "border-l-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "border-l-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            getProjectAccent(project).dot,
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{projectLabel}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
