import type { QueryClient } from "@tanstack/react-query";
import { getMe, type AuthMeData, type AuthUser } from "@/lib/api/auth";

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

/** Seed header/sidebar immediately after login, then load workspace from /me. */
export function primeAuthMeAfterAuth(queryClient: QueryClient, user: AuthUser): void {
  setAuthMeCache(queryClient, { user, workspace: null });
  void refreshAuthMe(queryClient);
}
