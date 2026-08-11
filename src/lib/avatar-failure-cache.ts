/**
 * Session-wide registry of avatar URLs that already failed to load.
 * Prevents remounts / multiple UserAvatar instances from re-requesting the same broken URL.
 *
 * Uploaded `/uploads/avatars/…` failures also persist in sessionStorage for the tab session
 * so a full client remount does not spam 404 again. External (e.g. Google) URLs stay
 * in-memory only so a transient CDN glitch can recover on reload.
 */

const SESSION_STORAGE_KEY = "teamflow:failed-avatar-urls";

const failedUrls = new Set<string>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;

function isUploadedAvatarUrl(url: string) {
  return /\/uploads\/avatars\/[^/?#]+/i.test(url);
}

function notify() {
  snapshotVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

function persistUploadedFailures() {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  const uploaded = [...failedUrls].filter(isUploadedAvatarUrl);
  try {
    if (uploaded.length === 0) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(uploaded));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function hydrateFromSessionStorage() {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return;
    }
    for (const entry of parsed) {
      if (typeof entry === "string" && entry && isUploadedAvatarUrl(entry)) {
        failedUrls.add(entry);
      }
    }
  } catch {
    // Ignore corrupt storage.
  }
}

hydrateFromSessionStorage();

export function markAvatarUrlFailed(url: string | null | undefined): void {
  if (!url) {
    return;
  }
  const trimmed = url.trim();
  if (!trimmed || failedUrls.has(trimmed)) {
    return;
  }

  failedUrls.add(trimmed);
  if (isUploadedAvatarUrl(trimmed)) {
    persistUploadedFailures();
  }
  notify();
}

export function isAvatarUrlFailed(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return failedUrls.has(url.trim());
}

export function clearAvatarUrlFailure(url: string | null | undefined): void {
  if (!url) {
    return;
  }
  const trimmed = url.trim();
  if (!failedUrls.delete(trimmed)) {
    return;
  }
  if (isUploadedAvatarUrl(trimmed)) {
    persistUploadedFailures();
  }
  notify();
}

/** Test helper: wipe in-memory + session failure state. */
export function resetAvatarFailureCacheForTests(): void {
  failedUrls.clear();
  snapshotVersion += 1;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  notify();
}

export function subscribeAvatarFailures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAvatarFailureSnapshot(): number {
  return snapshotVersion;
}
