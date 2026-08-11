type CacheEntry = {
  objectUrl: string | null;
  promise: Promise<string> | null;
  refCount: number;
  lastAccessedAt: number;
};

/** Soft cap: oldest idle entries are evicted first. */
const MAX_CACHE_ENTRIES = 32;
/** Idle entries older than this may be evicted. */
const CACHE_TTL_MS = 10 * 60 * 1000;

const blobUrlCache = new Map<string, CacheEntry>();

function touch(entry: CacheEntry) {
  entry.lastAccessedAt = Date.now();
}

function revokeEntry(entry: CacheEntry) {
  if (entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
    entry.objectUrl = null;
  }
}

function evictStaleAndOverflow() {
  const now = Date.now();

  for (const [key, entry] of blobUrlCache) {
    if (entry.refCount > 0 || entry.promise) {
      continue;
    }
    if (now - entry.lastAccessedAt > CACHE_TTL_MS) {
      revokeEntry(entry);
      blobUrlCache.delete(key);
    }
  }

  if (blobUrlCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const idle = [...blobUrlCache.entries()]
    .filter(([, entry]) => entry.refCount === 0 && !entry.promise)
    .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

  for (const [key, entry] of idle) {
    if (blobUrlCache.size <= MAX_CACHE_ENTRIES) {
      break;
    }
    revokeEntry(entry);
    blobUrlCache.delete(key);
  }
}

function getOrCreateEntry(downloadUrl: string, fetcher: () => Promise<Blob>): CacheEntry {
  const existing = blobUrlCache.get(downloadUrl);
  if (existing) {
    touch(existing);
    return existing;
  }

  evictStaleAndOverflow();

  const entry: CacheEntry = {
    objectUrl: null,
    promise: null,
    refCount: 0,
    lastAccessedAt: Date.now(),
  };

  entry.promise = fetcher()
    .then((blob) => {
      entry.objectUrl = URL.createObjectURL(blob);
      entry.promise = null;
      touch(entry);
      return entry.objectUrl;
    })
    .catch((error) => {
      // Never keep a rejected Promise in cache (Retry must fetch again).
      blobUrlCache.delete(downloadUrl);
      throw error;
    });

  blobUrlCache.set(downloadUrl, entry);
  return entry;
}

/** Sync peek for a ready object URL (same user-gesture open when already cached). */
export function getAuthenticatedBlobObjectUrl(downloadUrl: string): string | null {
  const entry = blobUrlCache.get(downloadUrl);
  if (!entry?.objectUrl) {
    return null;
  }
  touch(entry);
  return entry.objectUrl;
}

export function acquireAuthenticatedBlobUrl(
  downloadUrl: string,
  fetcher: () => Promise<Blob>,
): Promise<string> {
  const entry = getOrCreateEntry(downloadUrl, fetcher);
  entry.refCount += 1;
  touch(entry);

  if (entry.objectUrl) {
    return Promise.resolve(entry.objectUrl);
  }

  return entry.promise!;
}

/**
 * Drop the consumer ref. Object URLs stay cached until TTL/LRU eviction,
 * invalidate, or clearAuthenticatedBlobCache (e.g. logout).
 */
export function releaseAuthenticatedBlobUrl(downloadUrl: string): void {
  const entry = blobUrlCache.get(downloadUrl);
  if (!entry) {
    return;
  }

  entry.refCount = Math.max(0, entry.refCount - 1);
  touch(entry);
  evictStaleAndOverflow();
}

/** Remove one file's cache entry (e.g. after delete). Always revokes the object URL. */
export function invalidateAuthenticatedBlobUrl(downloadUrl: string): void {
  const entry = blobUrlCache.get(downloadUrl);
  if (!entry) {
    return;
  }
  revokeEntry(entry);
  blobUrlCache.delete(downloadUrl);
}

/** Clear all private blobs — call on logout / auth token change. */
export function clearAuthenticatedBlobCache(): void {
  for (const entry of blobUrlCache.values()) {
    revokeEntry(entry);
  }
  blobUrlCache.clear();
}
