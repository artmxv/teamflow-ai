import { Link, useRouterState } from "@tanstack/react-router";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";

const nav: { to: string; key: TKey; icon: typeof LayoutDashboard }[] = [
  { to: "/app/dashboard", key: "side.dashboard", icon: LayoutDashboard },
  { to: "/app/projects", key: "side.projects", icon: FolderKanban },
  { to: "/app/board", key: "side.kanban", icon: Trello },
  { to: "/app/tasks", key: "side.tasks", icon: ListChecks },
  { to: "/app/team", key: "side.team", icon: Users },
  { to: "/app/assistant", key: "side.assistant", icon: Sparkles },
  { to: "/app/settings", key: "side.settings", icon: Settings },
  { to: "/app/billing", key: "side.billing", icon: CreditCard },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
          <Sparkles className="size-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">TeamFlow</div>
          <div className="text-[11px] text-muted-foreground">AI workspace</div>
        </div>
      </div>

      <div className="px-3">
        <button className="flex w-full items-center justify-between rounded-xl border border-sidebar-border bg-card px-3 py-2 text-left text-sm transition hover:bg-sidebar-accent">
          <span className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">
              AC
            </span>
            <span className="font-medium">Acme Studio</span>
          </span>
          <span className="text-xs text-muted-foreground">Pro</span>
        </button>
      </div>

      <nav className="mt-6 flex-1 px-3">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Projects
        </div>
        <ul className="space-y-0.5">
          {["Orion Web App", "Mobile App v3", "Marketing Site"].map((p) => (
            <li key={p}>
              <a
                href="#"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
              >
                <span className="size-2 rounded-full bg-gradient-brand" />
                {p}
              </a>
            </li>
          ))}
          <li>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Plus className="size-3.5" /> New project
            </button>
          </li>
        </ul>
      </nav>

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
          <a className="text-primary hover:underline" href="#">Upgrade</a>
        </div>
      </div>
    </aside>
  );
}
