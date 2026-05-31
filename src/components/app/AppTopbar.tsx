import { Bell, Search, ChevronDown, HelpCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";

export function AppTopbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold tracking-tight">{title}</span>
      </div>

      <div className="relative ml-auto hidden md:block w-80">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search tasks, projects, people…"
          className="h-9 w-full rounded-lg border border-input bg-secondary/60 pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring/40"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <button className="ml-auto md:ml-0 grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
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
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight">Alex Morgan</span>
              <span className="block text-[11px] text-muted-foreground leading-tight">Owner</span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>alex@teamflow.ai</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link to="/app/settings">Profile settings</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/app/settings">Workspace settings</Link></DropdownMenuItem>
          <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link to="/signin">Sign out</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
