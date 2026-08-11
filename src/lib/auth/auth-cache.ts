import type { QueryClient } from "@tanstack/react-query";
import { getMe, type AuthMeData, type AuthUser } from "@/lib/api/auth";
import {
  clearActiveWorkspaceId,
  getPersistedWorkspaceId,
  getSelectedWorkspaceId,
  migrateLegacyWorkspaceKey,
  setSelectedWorkspaceId,
  setWorkspaceStorageUser,
} from "@/lib/api/client";
import { fetchWorkspaces, switchWorkspace } from "@/lib/api/workspaces";
import { shouldIdentifyUserBeforeWorkspaceRestore } from "@/lib/auth/auth-bootstrap";
import { getAuthToken, setAuthToken } from "@/lib/auth/token";
import { WORKSPACES_QUERY_KEY } from "@/lib/workspace-queries";

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

export function setAuthMeCache(queryClient: QueryClient, data: AuthMeData): void {
  queryClient.setQueryData(AUTH_ME_QUERY_KEY, data);
}

export function patchAuthMeUser(queryClient: QueryClient, user: AuthUser): void {
  queryClient.setQueryData<AuthMeData | undefined>(AUTH_ME_QUERY_KEY, (prev) => {
    if (!prev) {
      return { user, workspace: null };
    }
    return { ...prev, user };
  });
}

export async function refreshAuthMe(queryClient: QueryClient): Promise<void> {
  await queryClient.fetchQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: getMe,
  });
}

let workspaceValidationPromise: Promise<void> | null = null;
let validatedAuthToken: string | null = null;

export function resetWorkspaceValidationSession(): void {
  validatedAuthToken = null;
  workspaceValidationPromise = null;
}

type WorkspaceRestoreUser = Pick<AuthUser, "id" | "email">;

function resolveRestoreUser(
  queryClient: QueryClient,
  user?: WorkspaceRestoreUser | null,
): WorkspaceRestoreUser | null {
  if (user) {
    return user;
  }
  const cached = queryClient.getQueryData<AuthMeData>(AUTH_ME_QUERY_KEY);
  if (cached?.user) {
    return { id: cached.user.id, email: cached.user.email };
  }
  return null;
}

/**
 * Validate persisted workspace against /api/workspaces, set active header workspace,
 * then refresh /me so the UI matches X-Workspace-Id (not the other way around).
 */
export async function ensureValidSelectedWorkspace(
  queryClient: QueryClient,
  loginUser?: WorkspaceRestoreUser | null,
): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    resetWorkspaceValidationSession();
    return;
  }

  // Fresh login must win over a concurrent restore from useCurrentUser (stale active workspace).
  if (loginUser) {
    workspaceValidationPromise = null;
    validatedAuthToken = null;
  }

  if (validatedAuthToken === token && !workspaceValidationPromise && !loginUser) {
    return;
  }

  if (workspaceValidationPromise && !loginUser) {
    return workspaceValidationPromise;
  }

  workspaceValidationPromise = (async () => {
    let restoreUser = resolveRestoreUser(queryClient, loginUser);

    if (restoreUser) {
      setWorkspaceStorageUser(restoreUser.id, restoreUser.email);
      migrateLegacyWorkspaceKey(restoreUser.id, restoreUser.email);
    }

    // Fresh login: ignore stale active workspace from a previous session/user.
    if (loginUser) {
      clearActiveWorkspaceId();
    }

    if (
      shouldIdentifyUserBeforeWorkspaceRestore({
        hasRestoreUser: Boolean(restoreUser),
        hasActiveWorkspaceId: Boolean(getSelectedWorkspaceId()),
      })
    ) {
      const me = await getMe();
      restoreUser = { id: me.user.id, email: me.user.email };
      setWorkspaceStorageUser(restoreUser.id, restoreUser.email);
      migrateLegacyWorkspaceKey(restoreUser.id, restoreUser.email);
    }

    const workspaces = await fetchWorkspaces({ skipWorkspaceHeader: true });
    queryClient.setQueryData(WORKSPACES_QUERY_KEY, workspaces);

    if (workspaces.length === 0) {
      await refreshAuthMe(queryClient);
      validatedAuthToken = token;
      return;
    }

    const storedId = loginUser
      ? getPersistedWorkspaceId(restoreUser?.id, restoreUser?.email)
      : (getSelectedWorkspaceId() ?? getPersistedWorkspaceId(restoreUser?.id, restoreUser?.email));

    const validId =
      storedId && workspaces.some((workspace) => workspace.id === storedId)
        ? storedId
        : workspaces[0].id;

    if (import.meta.env.DEV && loginUser) {
      console.debug("[workspace-restore]", {
        userId: restoreUser?.id,
        email: restoreUser?.email,
        storedWorkspaceId: storedId,
        availableWorkspaceIds: workspaces.map((workspace) => workspace.id),
        chosenWorkspaceId: validId,
      });
    }

    if (getSelectedWorkspaceId() !== validId) {
      setSelectedWorkspaceId(validId, restoreUser?.id, restoreUser?.email);
    }

    try {
      await switchWorkspace(validId);
    } catch {
      // /me still resolves workspace from X-Workspace-Id when validation fails softly.
    }

    await refreshAuthMe(queryClient);
    validatedAuthToken = token;
  })().finally(() => {
    workspaceValidationPromise = null;
  });

  return workspaceValidationPromise;
}

/** @deprecated Use ensureValidSelectedWorkspace */
export const restoreSelectedWorkspaceAfterAuth = ensureValidSelectedWorkspace;

/** Seed header/sidebar immediately after login, then restore workspace and load /me. */
export async function primeAuthMeAfterAuth(
  queryClient: QueryClient,
  user: AuthUser,
): Promise<void> {
  setAuthMeCache(queryClient, { user, workspace: null });
  await ensureValidSelectedWorkspace(queryClient, user);
}

/**
 * Persist a fresh OAuth/JWT session and clear stale auth/workspace client state.
 * Does not await /me or workspace bootstrap — AppShell + useCurrentUser do that
 * after navigation so /auth/callback is not blocked on sequential API calls.
 */
export function completeAuthWithToken(queryClient: QueryClient, token: string): void {
  resetWorkspaceValidationSession();
  clearActiveWorkspaceId();
  setWorkspaceStorageUser(null, null);
  // Drop previous-user caches so protected UI cannot flash stale data.
  queryClient.clear();
  setAuthToken(token);
}
