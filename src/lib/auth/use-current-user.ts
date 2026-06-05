import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getMe, type AuthWorkspace } from "@/lib/api/auth";
import {
  clearSelectedWorkspaceId,
  getSelectedWorkspaceId,
  setSelectedWorkspaceId,
} from "@/lib/api/client";
import { AUTH_ME_QUERY_KEY } from "@/lib/auth/auth-cache";
import type { TKey } from "@/lib/i18n";
import { clearAuthToken, getAuthToken } from "./token";

export function useCurrentUser() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasToken = typeof window !== "undefined" && !!getAuthToken();

  const query = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: getMe,
    enabled: hasToken,
    retry: false,
    staleTime: 30 * 60 * 1000,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!hasToken || !query.isError) {
      return;
    }
    clearAuthToken();
    clearSelectedWorkspaceId();
    void queryClient.removeQueries({ queryKey: ["auth"] });
    void router.navigate({ to: "/signin", replace: true });
  }, [hasToken, query.isError, queryClient, router]);

  useEffect(() => {
    const workspaceId = query.data?.workspace?.id;
    if (!workspaceId) {
      return;
    }
    if (!getSelectedWorkspaceId()) {
      setSelectedWorkspaceId(workspaceId);
    }
  }, [query.data?.workspace?.id]);

  return query;
}

export function useCurrentWorkspace() {
  const query = useCurrentUser();
  return {
    ...query,
    data: query.data?.workspace ?? null,
  };
}

export function workspaceRoleLabel(role: AuthWorkspace["role"], t: (k: TKey) => string): string {
  const keys: Record<AuthWorkspace["role"], TKey> = {
    OWNER: "role.owner",
    ADMIN: "role.admin",
    MEMBER: "role.member",
  };
  return t(keys[role]);
}

export function isWorkspaceManager(role: AuthWorkspace["role"] | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageWorkspaceTeam(role: AuthWorkspace["role"] | null | undefined): boolean {
  return role === "OWNER";
}

export function canEditWorkspaceSettings(role: AuthWorkspace["role"] | null | undefined): boolean {
  return role === "OWNER";
}

export function nameToInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
