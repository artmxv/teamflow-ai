import { BrandLogo } from "@/components/brand/BrandLogo";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <BrandLogo size="sm" className="w-fit" />
        <p className="text-xs leading-[1.4] text-muted-foreground">
          {t("landing.footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
