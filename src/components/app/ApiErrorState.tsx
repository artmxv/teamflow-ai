import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { friendlyApiErrorMessage } from "@/lib/api-error";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ApiErrorStateProps = {
  title?: string;
  titleKey?: TKey;
  error?: unknown;
  hintKey?: TKey;
  onRetry?: () => void;
  retryLabelKey?: TKey;
  isRetrying?: boolean;
  compact?: boolean;
  className?: string;
};

export function ApiErrorState({
  title,
  titleKey,
  error,
  hintKey = "common.errorServerHint",
  onRetry,
  retryLabelKey = "common.retry",
  isRetrying = false,
  compact = false,
  className,
}: ApiErrorStateProps) {
  const { t } = useI18n();
  const resolvedTitle = title ?? (titleKey ? t(titleKey) : "");
  const description = friendlyApiErrorMessage(error, t, hintKey);

  return (
    <div
      className={cn(
        "rounded-2xl border border-destructive/20 bg-card text-center shadow-soft",
        compact ? "px-4 py-8" : "p-8",
        className,
      )}
      role="alert"
    >
      <div
        className={cn(
          "mx-auto grid place-items-center rounded-2xl bg-destructive/10 text-destructive",
          compact ? "size-10" : "size-12",
        )}
      >
        <AlertCircle className={compact ? "size-5" : "size-6"} aria-hidden />
      </div>
      <h3 className={cn("font-semibold tracking-tight", compact ? "mt-3 text-sm" : "mt-4 text-base")}>
        {resolvedTitle}
      </h3>
      <p
        className={cn(
          "mx-auto max-w-md text-muted-foreground",
          compact ? "mt-1 text-xs" : "mt-1.5 text-sm",
        )}
      >
        {description}
      </p>
      {onRetry ? (
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className={cn(compact ? "mt-4" : "mt-5")}
        >
          {isRetrying ? <Loader2 className="size-4 animate-spin" /> : null}
          {t(retryLabelKey)}
        </Button>
      ) : null}
    </div>
  );
}
