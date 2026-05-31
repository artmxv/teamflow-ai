import { Bell, Search, ChevronDown, HelpCircle, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";

const workspaces = [
  { id: "ws1", name: "Acme Studio", plan: "Pro", initials: "AC" },
  { id: "ws2", name: "Northwind Labs", plan: "Free", initials: "NL" },
  { id: "ws3", name: "Atlas Design Co.", plan: "Business", initials: "AD" },
];

export function AppTopbar({ title }: { title: string }) {
  const { t } = useI18n();
  const [active, setActive] = useState(workspaces[0]);

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
              {active.initials}
            </span>
            <span className="hidden font-medium sm:inline">{active.name}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => setActive(w)} className="gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-gradient-brand text-[10px] font-semibold text-white">{w.initials}</span>
              <span className="flex-1">
                <span className="block text-sm font-medium leading-tight">{w.name}</span>
                <span className="block text-[11px] text-muted-foreground leading-tight">{w.plan}</span>
              </span>
              {active.id === w.id && <Check className="size-4 text-primary" />}
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
        <button className="hidden sm:grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <HelpCircle className="size-4" />
        </button>
        <button className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-secondary">
              <span className="grid size-8 place-items-center rounded-md bg-gradient-brand text-xs font-semibold text-white">
                AM
              </span>
              <span className="hidden text-left xl:block">
                <span className="block text-sm font-medium leading-tight">Alex Morgan</span>
                <span className="block text-[11px] text-muted-foreground leading-tight">Owner</span>
              </span>
              <ChevronDown className="hidden size-3.5 text-muted-foreground xl:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>alex@teamflow.ai</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/app/settings">Profile settings</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/app/settings">Workspace settings</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/app/billing">Billing</Link></DropdownMenuItem>
            <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/signin">Sign out</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
