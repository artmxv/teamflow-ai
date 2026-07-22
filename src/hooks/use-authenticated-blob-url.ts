import { useEffect, useRef, useState } from "react";

import { fetchAuthenticatedBlob } from "@/lib/api/authenticated-blob";

type CacheEntry = {
  blob: Blob;
  objectUrl: string;
  refCount: number;
  promise: Promise<Blob> | null;
};

const blobUrlCache = new Map<string, CacheEntry>();

function getOrCreateEntry(downloadUrl: string, fetcher: () => Promise<Blob>): CacheEntry {
  const existing = blobUrlCache.get(downloadUrl);
  if (existing) {
    return existing;
  }

  const entry: CacheEntry = {
    blob: new Blob(),
    objectUrl: "",
    refCount: 0,
    promise: fetcher()
      .then((blob) => {
        entry.blob = blob;
        entry.objectUrl = URL.createObjectURL(blob);
        entry.promise = null;
        if (entry.refCount === 0) {
          URL.revokeObjectURL(entry.objectUrl);
          blobUrlCache.delete(downloadUrl);
        }
        return blob;
      })
      .catch((error) => {
        blobUrlCache.delete(downloadUrl);
        throw error;
      }),
  };

  blobUrlCache.set(downloadUrl, entry);
  return entry;
}

export function acquireAuthenticatedBlobUrl(
  downloadUrl: string,
  fetcher: () => Promise<Blob> = () => fetchAuthenticatedBlob(downloadUrl),
): Promise<string> {
  const entry = getOrCreateEntry(downloadUrl, fetcher);

  if (entry.objectUrl) {
    entry.refCount += 1;
    return Promise.resolve(entry.objectUrl);
  }

  entry.refCount += 1;
  return entry.promise!.then(() => entry.objectUrl);
}

export function releaseAuthenticatedBlobUrl(downloadUrl: string): void {
  const entry = blobUrlCache.get(downloadUrl);
  if (!entry) {
    return;
  }

  entry.refCount = Math.max(0, entry.refCount - 1);
  if (entry.refCount === 0 && entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
    blobUrlCache.delete(downloadUrl);
  }
}

type UseAuthenticatedBlobUrlResult = {
  objectUrl: string | null;
  isLoading: boolean;
  isError: boolean;
};

export function useAuthenticatedBlobUrl(
  downloadUrl: string | null | undefined,
  enabled = true,
  fetcher?: () => Promise<Blob>,
): UseAuthenticatedBlobUrlResult {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(downloadUrl && enabled));
  const [isError, setIsError] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!downloadUrl || !enabled) {
      setObjectUrl(null);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    let cancelled = false;
    setObjectUrl(null);
    setIsLoading(true);
    setIsError(false);

    void acquireAuthenticatedBlobUrl(downloadUrl, () =>
      (fetcherRef.current ?? fetchAuthenticatedBlob)(downloadUrl),
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
        }
      });

    return () => {
      cancelled = true;
      releaseAuthenticatedBlobUrl(downloadUrl);
      setObjectUrl(null);
    };
  }, [downloadUrl, enabled]);

  return { objectUrl, isLoading, isError };
}
