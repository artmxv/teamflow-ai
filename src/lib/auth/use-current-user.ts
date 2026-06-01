import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getMe, type AuthWorkspace } from "@/lib/api/auth";
import { clearAuthToken, getAuthToken } from "./token";

export function useCurrentUser() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasToken = typeof window !== "undefined" && !!getAuthToken();

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: hasToken,
    retry: false,
  });

  useEffect(() => {
    if (!hasToken || !query.isError) {
      return;
    }
    clearAuthToken();
    void queryClient.removeQueries({ queryKey: ["auth"] });
    void router.navigate({ to: "/signin", replace: true });
  }, [hasToken, query.isError, queryClient, router]);

  return query;
}

export function useCurrentWorkspace() {
  const query = useCurrentUser();
  return {
    ...query,
    data: query.data?.workspace ?? null,
  };
}

export function workspaceRoleLabel(role: AuthWorkspace["role"]): string {
  const labels: Record<AuthWorkspace["role"], string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
  };
  return labels[role];
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
