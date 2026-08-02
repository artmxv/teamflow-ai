import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { APP_NAV_ITEMS, isAppNavItemActive } from "@/lib/app-nav";
import { useChatUnreadCount } from "@/lib/api/use-chat-unread-count";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ pathname }: { pathname: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { unreadCount } = useChatUnreadCount();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t("nav.openMenu")}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border/70 px-4 py-4 text-left">
          <SheetTitle className="text-base tracking-tight">TeamFlow</SheetTitle>
          <p className="text-xs text-muted-foreground">{t("side.tagline")}</p>
        </SheetHeader>
        <nav className="p-3">
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
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring/40",
                      active
                        ? "border-l-2 border-l-primary bg-sidebar-accent pl-[calc(0.75rem-2px)] font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
                    )}
                    aria-label={
                      showUnread
                        ? t("chat.navUnread").replace("{count}", String(unreadCount))
                        : undefined
                    }
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
      </SheetContent>
    </Sheet>
  );
}
