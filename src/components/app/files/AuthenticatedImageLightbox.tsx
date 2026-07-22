import { Download, Loader2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  acquireAuthenticatedBlobUrl,
  releaseAuthenticatedBlobUrl,
} from "@/hooks/use-authenticated-blob-url";
import { fetchAuthenticatedBlob } from "@/lib/api/authenticated-blob";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LightboxImage = {
  downloadUrl: string;
  filename: string;
  objectUrl?: string | null;
  onDownload?: () => void | Promise<void>;
};

type AuthenticatedImageLightboxContextValue = {
  openLightbox: (image: LightboxImage) => void;
};

const AuthenticatedImageLightboxContext =
  createContext<AuthenticatedImageLightboxContextValue | null>(null);

export function useAuthenticatedImageLightbox() {
  const context = useContext(AuthenticatedImageLightboxContext);
  if (!context) {
    throw new Error(
      "useAuthenticatedImageLightbox must be used within AuthenticatedImageLightboxProvider",
    );
  }
  return context;
}

export function AuthenticatedImageLightboxProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<LightboxImage | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const activeDownloadUrlRef = useRef<string | null>(null);

  const releaseActiveUrl = useCallback(() => {
    if (activeDownloadUrlRef.current) {
      releaseAuthenticatedBlobUrl(activeDownloadUrlRef.current);
      activeDownloadUrlRef.current = null;
    }
    setObjectUrl(null);
  }, []);

  const openLightbox = useCallback((nextImage: LightboxImage) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setImage(nextImage);
    setLoadFailed(false);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        releaseActiveUrl();
        setImage(null);
        setIsLoading(false);
        setLoadFailed(false);
        setIsDownloading(false);
        const trigger = triggerRef.current;
        triggerRef.current = null;
        window.requestAnimationFrame(() => {
          trigger?.focus();
        });
      }
    },
    [releaseActiveUrl],
  );

  useEffect(() => {
    if (!open || !image) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);
    activeDownloadUrlRef.current = image.downloadUrl;

    void acquireAuthenticatedBlobUrl(image.downloadUrl, () =>
      fetchAuthenticatedBlob(image.downloadUrl),
    )
      .then((url) => {
        if (!cancelled) {
          setObjectUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (activeDownloadUrlRef.current === image.downloadUrl) {
        releaseAuthenticatedBlobUrl(image.downloadUrl);
        activeDownloadUrlRef.current = null;
      }
    };
  }, [open, image]);

  return (
    <AuthenticatedImageLightboxContext.Provider value={{ openLightbox }}>
      {children}
      <AuthenticatedImageLightboxDialog
        open={open}
        onOpenChange={handleOpenChange}
        filename={image?.filename ?? ""}
        objectUrl={objectUrl}
        isLoading={isLoading}
        loadFailed={loadFailed}
        isDownloading={isDownloading}
        onDownload={
          image?.onDownload
            ? () => {
                if (!image.onDownload || isDownloading) {
                  return;
                }
                setIsDownloading(true);
                void Promise.resolve(image.onDownload()).finally(() => {
                  setIsDownloading(false);
                });
              }
            : undefined
        }
      />
    </AuthenticatedImageLightboxContext.Provider>
  );
}

function AuthenticatedImageLightboxDialog({
  open,
  onOpenChange,
  filename,
  objectUrl,
  isLoading,
  loadFailed,
  isDownloading,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  objectUrl: string | null;
  isLoading: boolean;
  loadFailed: boolean;
  isDownloading: boolean;
  onDownload?: () => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(96vw,1200px)] gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:rounded-xl"
        closeClassName="right-3 top-3 z-20 bg-background/80 text-foreground hover:bg-background"
        closeLabel={t("files.closePreview")}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <DialogTitle className="sr-only">
          {filename
            ? t("files.imagePreviewTitleWithName").replace("{name}", filename)
            : t("files.imagePreviewTitle")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("files.imagePreviewDescription")}
        </DialogDescription>

        <div className="relative flex max-h-[min(90vh,900px)] min-h-[12rem] w-full flex-col items-center justify-center">
          {isLoading ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <Loader2 className="size-8 animate-spin text-background" aria-hidden />
              <span className="sr-only">{t("common.loading")}</span>
            </div>
          ) : loadFailed ? (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl bg-background/95 px-6 py-8 text-center shadow-lg">
              <p className="text-sm text-muted-foreground">{t("files.imagePreviewFailed")}</p>
              {onDownload ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isDownloading}
                  onClick={onDownload}
                >
                  {isDownloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {t("files.downloadImage")}
                </Button>
              ) : null}
            </div>
          ) : objectUrl ? (
            <>
              <img
                src={objectUrl}
                alt={filename || t("files.imagePreviewTitle")}
                className="max-h-[min(85vh,820px)] w-full max-w-full object-contain"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              />
              {filename ? (
                <p className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-center text-xs text-white/90">
                  {filename}
                </p>
              ) : null}
              {onDownload ? (
                <div className="absolute bottom-3 right-3 z-10">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn("h-8 gap-1.5 bg-background/90", filename && "mb-6")}
                    disabled={isDownloading}
                    onClick={onDownload}
                  >
                    {isDownloading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    {t("files.downloadImage")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
