import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" className="w-fit" />
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
            aria-label={t("landing.footer.navLabel")}
          >
            <Link
              to="/privacy"
              className="outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {t("landing.footer.privacy")}
            </Link>
            <Link
              to="/personal-data-consent"
              className="outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {t("landing.footer.consent")}
            </Link>
            <Link
              to="/terms"
              className="outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {t("landing.footer.terms")}
            </Link>
          </nav>
        </div>
        <p className="border-t border-border/60 pt-3 text-xs leading-[1.4] text-muted-foreground">
          {t("landing.footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
