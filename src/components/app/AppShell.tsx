import { useMemo, useState, type ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { AppBootScreen } from "@/components/app/AppBootScreen";
import { AuthenticatedImageLightboxProvider } from "@/components/app/files/AuthenticatedImageLightbox";
import type { AuthWorkspace } from "@/lib/api/auth";
import { nameToInitials, useCurrentUser } from "@/lib/auth/use-current-user";
import {
  hasBillingPaymentReturn,
  syncBillingReturnPaymentIdFromUrl,
} from "@/lib/billing/payment-return";
import { useChatRealtime } from "@/lib/realtime/use-chat-realtime";
import { useSidebarCollapsed } from "@/lib/sidebar-preference";
import { AppPage } from "./AppPage";
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
  // Capture paymentId before workspace bootstrap can remount/replace the URL.
  const [billingReturnActive] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    syncBillingReturnPaymentIdFromUrl();
    return hasBillingPaymentReturn();
  });

  const workspace = useMemo(
    () => (me?.workspace ? authWorkspaceToShell(me.workspace) : null),
    [me?.workspace],
  );

  useChatRealtime({
    workspaceId: workspace?.id,
    currentUserId: me?.user.id,
    enabled: Boolean(me?.user.id && workspace?.id),
  });

  const workspaceLoading = !workspace && (isPending || isFetching);
  // Billing return must mount the page immediately so confirm-payment can start.
  const isBootstrapping = !billingReturnActive && (isPending || isFetching) && !me;

  return (
    <AuthGuard>
      {isBootstrapping ? (
        <AppBootScreen />
      ) : isError && !me ? (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <ApiErrorState
            titleKey="loading.workspaceLoadErrorTitle"
            error={error}
            onRetry={() => void refetch()}
            className="w-full max-w-lg"
          />
        </div>
      ) : (
        <AuthenticatedImageLightboxProvider>
          <div className="app-shell-enter flex h-svh min-h-0 w-full overflow-hidden bg-background">
            <AppSidebar
              workspace={workspace}
              workspaceLoading={workspaceLoading}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={toggleSidebarCollapsed}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <AppTopbar workspaceRole={me?.workspace?.role ?? null} />
              <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                <AppPage>{children}</AppPage>
              </main>
            </div>
          </div>
        </AuthenticatedImageLightboxProvider>
      )}
    </AuthGuard>
  );
}
