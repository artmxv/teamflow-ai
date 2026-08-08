import { BrandAiBadge, BrandMark } from "@/components/brand/BrandLogo";
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
  const isShell = variant === "shell";
  const slowMessageKey = useSlowLoadingMessage(isShell);
  const statusText = slowMessageKey ? t(slowMessageKey) : t("common.loading");

  return (
    <div
      className={cn(
        "app-boot relative isolate flex min-h-svh w-full items-center justify-center overflow-hidden bg-background px-6 py-12",
        !isShell && "app-boot--minimal",
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusText}
    >
      <div className="app-boot__ambient absolute inset-0 -z-20" aria-hidden />
      {isShell ? <div className="app-boot__grid absolute inset-0 -z-10" aria-hidden /> : null}

      <div className="app-boot__content flex w-full max-w-sm flex-col items-center text-center">
        <div className="app-boot__mark-frame" aria-hidden>
          <BrandMark
            className={cn(
              "app-boot__mark",
              isShell ? "size-16 rounded-[1.15rem]" : "size-12 rounded-[0.9rem]",
            )}
          />
        </div>

        <div className="mt-7 flex items-center gap-2 tracking-tight" aria-hidden>
          <span className="text-2xl font-semibold text-foreground">TeamFlow</span>
          <BrandAiBadge className="px-1.5 py-0.5 text-sm" />
        </div>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {t("side.tagline")}
        </p>

        {isShell ? (
          <div
            className="app-boot__progress mt-8 h-0.5 w-44 overflow-hidden rounded-full bg-border/80"
            aria-hidden
          >
            <span className="app-boot__progress-bar block h-full w-2/5 rounded-full" />
          </div>
        ) : null}

        <p
          className={cn(
            "mt-4 min-h-5 max-w-sm text-sm text-muted-foreground transition-opacity duration-300",
            slowMessageKey ? "opacity-100" : "opacity-75",
            !isShell && "mt-5",
          )}
        >
          {statusText}
        </p>
      </div>
    </div>
  );
}
