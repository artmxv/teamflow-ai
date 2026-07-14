import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlowLoadingMessage } from "@/hooks/use-slow-loading-message";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AppBootScreenProps = {
  /** Centered spinner only — used while checking local auth token. */
  variant?: "minimal" | "shell";
};

export function AppBootScreen({ variant = "shell" }: AppBootScreenProps) {
  const { t } = useI18n();
  const slowMessageKey = useSlowLoadingMessage(true);
  const statusText = slowMessageKey ? t(slowMessageKey) : t("common.loading");

  if (variant === "minimal") {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="max-w-sm text-center text-sm text-muted-foreground">{statusText}</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen w-full bg-muted/30"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusText}
    >
      <aside
        className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar p-3 md:flex"
        aria-hidden
      >
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="mt-4 space-y-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-auto h-9 w-full rounded-lg" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-6"
          aria-hidden
        >
          <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </header>

        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 space-y-2" aria-hidden>
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <Skeleton className="size-9 rounded-xl" />
                <Skeleton className="mt-4 h-9 w-16" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
            <p
              className={cn(
                "max-w-md text-center text-sm text-muted-foreground transition-opacity",
                slowMessageKey ? "opacity-100" : "opacity-80",
              )}
            >
              {statusText}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
