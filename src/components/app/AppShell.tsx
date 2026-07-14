import { useMemo, type ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { AppBootScreen } from "@/components/app/AppBootScreen";
import type { AuthWorkspace } from "@/lib/api/auth";
import { nameToInitials, useCurrentUser } from "@/lib/auth/use-current-user";
import { useSidebarCollapsed } from "@/lib/sidebar-preference";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

export type Workspace = {
  id: string;
  name: string;
  initials: string;
  slug?: string;
};

export function authWorkspaceToShell(workspace: AuthWorkspace): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    initials: nameToInitials(workspace.name),
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, isPending, isFetching, isError, error, refetch } = useCurrentUser();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebarCollapsed } = useSidebarCollapsed();

  const workspace = useMemo(
    () => (me?.workspace ? authWorkspaceToShell(me.workspace) : null),
    [me?.workspace],
  );

  const workspaceLoading = !workspace && (isPending || isFetching);
  const isBootstrapping = (isPending || isFetching) && !me;

  return (
    <AuthGuard>
      {isBootstrapping ? (
        <AppBootScreen />
      ) : isError && !me ? (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
          <ApiErrorState
            titleKey="loading.workspaceLoadErrorTitle"
            error={error}
            onRetry={() => void refetch()}
            className="w-full max-w-lg"
          />
        </div>
      ) : (
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar
          workspace={workspace}
          workspaceLoading={workspaceLoading}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar workspaceRole={me?.workspace?.role ?? null} />
          <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
      )}
    </AuthGuard>
  );
}
