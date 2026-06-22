import { Button } from "@/components/ui/button";
import { friendlyApiErrorMessage } from "@/lib/api-error";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ApiErrorStateProps = {
  titleKey: TKey;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
};

export function ApiErrorState({ titleKey, error, onRetry, className }: ApiErrorStateProps) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-soft",
        className,
      )}
    >
      <h3 className="text-base font-semibold">{t(titleKey)}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {friendlyApiErrorMessage(error, t)}
      </p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-5">
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
