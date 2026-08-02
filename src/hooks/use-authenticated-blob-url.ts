import { useEffect, useRef, useState } from "react";

import { isBrowserOffline } from "@/lib/api-error";
import { fetchAuthenticatedBlob } from "@/lib/api/authenticated-blob";
import {
  acquireAuthenticatedBlobUrl,
  releaseAuthenticatedBlobUrl,
} from "@/lib/api/authenticated-blob-cache";

export {
  acquireAuthenticatedBlobUrl,
  clearAuthenticatedBlobCache,
  getAuthenticatedBlobObjectUrl,
  invalidateAuthenticatedBlobUrl,
  releaseAuthenticatedBlobUrl,
} from "@/lib/api/authenticated-blob-cache";

type UseAuthenticatedBlobUrlResult = {
  objectUrl: string | null;
  isLoading: boolean;
  isError: boolean;
  isOffline: boolean;
};

/**
 * Loads an authenticated blob when `enabled` is true (e.g. image thumbnails).
 * Do not enable for list rows that only need Open-on-demand — use
 * `useOnDemandFilePreparation` + open helpers instead.
 */
export function useAuthenticatedBlobUrl(
  downloadUrl: string | null | undefined,
  enabled = true,
  fetcher?: () => Promise<Blob>,
  retryKey = 0,
): UseAuthenticatedBlobUrlResult {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(downloadUrl && enabled));
  const [isError, setIsError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!downloadUrl || !enabled) {
      setObjectUrl(null);
      setIsLoading(false);
      setIsError(false);
      setIsOffline(false);
      return;
    }

    if (isBrowserOffline()) {
      setObjectUrl(null);
      setIsLoading(false);
      setIsError(true);
      setIsOffline(true);
      return;
    }

    let cancelled = false;
    setObjectUrl(null);
    setIsLoading(true);
    setIsError(false);
    setIsOffline(false);

    void acquireAuthenticatedBlobUrl(downloadUrl, () =>
      (fetcherRef.current ?? ((url: string) => fetchAuthenticatedBlob(url)))(downloadUrl),
    )
      .then((url) => {
        if (!cancelled) {
          setObjectUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsError(true);
          setIsLoading(false);
          setIsOffline(isBrowserOffline());
        }
      });

    return () => {
      cancelled = true;
      releaseAuthenticatedBlobUrl(downloadUrl);
      setObjectUrl(null);
    };
  }, [downloadUrl, enabled, retryKey]);

  return { objectUrl, isLoading, isError, isOffline };
}
