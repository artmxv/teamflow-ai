import {
  LayoutDashboard,
  FolderKanban,
  Trello,
  Users,
  Settings,
  Sparkles,
  ListChecks,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import type { TKey } from "@/lib/i18n";

export type AppNavItem = {
  to: string;
  key: TKey;
  icon: typeof LayoutDashboard;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: "/app/dashboard", key: "side.dashboard", icon: LayoutDashboard },
  { to: "/app/projects", key: "side.projects", icon: FolderKanban },
  { to: "/app/board", key: "side.kanban", icon: Trello },
  { to: "/app/tasks", key: "side.tasks", icon: ListChecks },
  { to: "/app/team", key: "side.team", icon: Users },
  { to: "/app/chat", key: "side.chat", icon: MessageSquare },
  { to: "/app/ai", key: "side.assistant", icon: Sparkles },
  { to: "/app/settings", key: "side.settings", icon: Settings },
  { to: "/app/billing", key: "side.plans", icon: CreditCard },
];

/** Whether a sidebar nav item should appear active for the current pathname. */
export function isAppNavItemActive(pathname: string, to: string): boolean {
  if (pathname === to) {
    return true;
  }
  if (to === "/app/projects") {
    return pathname.startsWith("/app/projects/");
  }
  return false;
}
