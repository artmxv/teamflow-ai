import { BrandMark } from "@/components/brand/BrandLogo";
import { useSlowLoadingMessage } from "@/hooks/use-slow-loading-message";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AppBootScreenProps = {
  /** Brief auth check or the longer workspace bootstrap. */
  variant?: "minimal" | "shell";
};

/**
 * Branded application boot state. It never delays navigation: the screen remains
 * visible only while auth or workspace data is genuinely being resolved.
 */
export function AppBootScreen({ variant = "shell" }: AppBootScreenProps) {
  const { t } = useI18n();
  const slowMessageKey = useSlowLoadingMessage(variant === "shell");
  const statusText = slowMessageKey ? t(slowMessageKey) : t("common.loading");

  return (
    <div
      className={cn(
        "app-boot relative isolate flex min-h-svh w-full items-center justify-center overflow-hidden bg-background px-6 py-12",
        variant === "minimal" && "app-boot--minimal",
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusText}
    >
      <div className="app-boot__ambient absolute inset-0 -z-20" aria-hidden />
      <div className="app-boot__grid absolute inset-0 -z-10" aria-hidden />

      <div className="app-boot__content flex w-full max-w-sm flex-col items-center text-center">
        <div className="app-boot__mark-frame" aria-hidden>
          <div className="app-boot__mark-surface">
            <BrandMark className="app-boot__mark h-12 w-[62px]" />
          </div>
        </div>

        <div className="mt-7 flex items-baseline gap-1.5 tracking-tight" aria-hidden>
          <span className="text-2xl font-semibold text-foreground">TeamFlow</span>
          <span className="text-2xl font-semibold text-[color:var(--public-ai,#67e8f9)]">AI</span>
        </div>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {t("side.tagline")}
        </p>

        <div className="app-boot__progress mt-8 h-px w-52 overflow-hidden bg-border" aria-hidden>
          <span className="app-boot__progress-bar block h-full w-2/5" />
        </div>

        <p
          className={cn(
            "mt-4 min-h-5 max-w-sm text-sm text-muted-foreground transition-opacity duration-300",
            slowMessageKey ? "opacity-100" : "opacity-75",
          )}
        >
          {statusText}
        </p>
      </div>

      <div
        className="app-boot__signature absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 sm:flex"
        aria-hidden
      >
        <span>{t("landing.hero.title")}</span>
      </div>
    </div>
  );
}
