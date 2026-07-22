import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

import { useAuthenticatedImageLightbox } from "@/components/app/files/AuthenticatedImageLightbox";
import { useAuthenticatedBlobUrl } from "@/hooks/use-authenticated-blob-url";
import { isPreviewableImageMimeType } from "@/lib/files/image-preview";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AuthenticatedImagePreviewProps = {
  downloadUrl: string;
  filename: string;
  mimeType: string;
  className?: string;
  imageClassName?: string;
  objectFit?: "cover" | "contain";
  fallback: ReactNode;
  onDownload?: () => void | Promise<void>;
  fetchBlob?: () => Promise<Blob>;
};

export function AuthenticatedImagePreview({
  downloadUrl,
  filename,
  mimeType,
  className,
  imageClassName,
  objectFit = "contain",
  fallback,
  onDownload,
  fetchBlob,
}: AuthenticatedImagePreviewProps) {
  const { t } = useI18n();
  const { openLightbox } = useAuthenticatedImageLightbox();
  const isImage = isPreviewableImageMimeType(mimeType);
  const { objectUrl, isLoading, isError } = useAuthenticatedBlobUrl(
    downloadUrl,
    isImage,
    fetchBlob,
  );

  if (!isImage) {
    return <>{fallback}</>;
  }

  if (isError) {
    return <>{fallback}</>;
  }

  if (isLoading || !objectUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-border/60 bg-muted/30",
          className,
        )}
        aria-hidden
      >
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-0 text-left transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={t("files.viewImage").replace("{name}", filename)}
      onClick={() => {
        openLightbox({
          downloadUrl,
          filename,
          objectUrl,
          onDownload,
        });
      }}
    >
      <img
        src={objectUrl}
        alt={filename}
        className={cn(
          "block size-full",
          objectFit === "cover" ? "object-cover" : "object-contain",
          imageClassName,
        )}
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}
