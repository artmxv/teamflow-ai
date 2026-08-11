import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#ai", labelKey: "nav.aiCopilot" as const },
  { href: "#product", labelKey: "nav.product" as const },
  { href: "#collaboration", labelKey: "nav.howItWorks" as const },
];

export function SiteHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_oklch,var(--background)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <BrandLogo className="shrink-0" />

        <nav className="ml-2 hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="outline-none transition hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t(link.labelKey)}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher className="shrink-0" />
          <Link
            to="/signin"
            className="hidden shrink-0 px-1 text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline"
          >
            {t("nav.signin")}
          </Link>
          <Button asChild size="sm" variant="brand" className="public-primary-button hidden shrink-0 sm:inline-flex">
            <Link to="/signup">
              {t("nav.start")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="brand" className="public-primary-button shrink-0 sm:hidden">
            <Link to="/signup">{t("landing.cta.createAccountShort")}</Link>
          </Button>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-md text-muted-foreground outline-none transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id={menuId}
        hidden={!open}
        className={cn(
          "border-t border-border/70 bg-[color-mix(in_oklch,var(--background)_96%,transparent)] md:hidden",
          open && "block",
        )}
      >
        <nav
          className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6"
          aria-label={t("nav.features")}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2.5 text-sm text-foreground outline-none transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40"
              onClick={() => setOpen(false)}
            >
              {t(link.labelKey)}
            </a>
          ))}
          <Link
            to="/signin"
            className="rounded-md px-3 py-2.5 text-sm text-foreground outline-none transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => setOpen(false)}
          >
            {t("nav.signin")}
          </Link>
          <Link
            to="/signup"
            className="rounded-md px-3 py-2.5 text-sm font-medium text-primary outline-none transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => setOpen(false)}
          >
            {t("nav.start")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
