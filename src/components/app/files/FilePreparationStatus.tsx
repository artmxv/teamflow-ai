import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type FilePreparationStatusProps = {
  isPreparing: boolean;
  isError: boolean;
  isOffline: boolean;
  onRetry: () => void;
};

/** Inline readiness hint for task attachments / project documents. */
export function FilePreparationStatus({
  isPreparing,
  isError,
  isOffline,
  onRetry,
}: FilePreparationStatusProps) {
  const { t } = useI18n();

  if (isPreparing) {
    return (
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        <span>{t("files.preparingFile")}</span>
      </div>
    );
  }

  if (!isError) {
    return null;
  }

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
      <span className="text-destructive">
        {isOffline ? t("common.offline") : t("files.preparationFailed")}
      </span>
      <Button type="button" variant="link" className="h-auto p-0 text-[11px]" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
