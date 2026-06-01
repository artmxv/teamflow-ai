import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import type { AuthWorkspace } from "@/lib/api/auth";
import { nameToInitials, useCurrentUser, workspaceRoleLabel } from "@/lib/auth/use-current-user";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

export type Workspace = {
  id: string;
  name: string;
  plan: string;
  initials: string;
  slug?: string;
};

const fallbackWorkspaces: Workspace[] = [
  { id: "ws1", name: "Acme Studio", plan: "Pro", initials: "AC" },
  { id: "ws2", name: "Northwind Labs", plan: "Free", initials: "NL" },
  { id: "ws3", name: "Atlas Design Co.", plan: "Business", initials: "AD" },
];

const loadingWorkspace: Workspace = {
  id: "loading",
  name: "Loading…",
  plan: "",
  initials: "…",
};

function authWorkspaceToShell(workspace: AuthWorkspace): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspaceRoleLabel(workspace.role),
    initials: nameToInitials(workspace.name),
  };
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { data: me, isPending } = useCurrentUser();
  const [activeWorkspace, setActiveWorkspace] = useState(loadingWorkspace);

  const workspaces = useMemo(() => {
    if (me?.workspace) {
      return [authWorkspaceToShell(me.workspace)];
    }
    if (isPending) {
      return [loadingWorkspace];
    }
    return fallbackWorkspaces;
  }, [me?.workspace, isPending]);

  const displayWorkspace = useMemo(() => {
    if (me?.workspace) {
      return authWorkspaceToShell(me.workspace);
    }
    if (isPending) {
      return loadingWorkspace;
    }
    return fallbackWorkspaces[0];
  }, [me?.workspace, isPending]);

  useEffect(() => {
    if (me?.workspace) {
      setActiveWorkspace(authWorkspaceToShell(me.workspace));
    }
  }, [me?.workspace]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar activeWorkspace={displayWorkspace} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar
            title={title}
            workspaces={workspaces}
            activeWorkspace={displayWorkspace}
            onWorkspaceChange={setActiveWorkspace}
            workspaceRole={me?.workspace?.role ?? null}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
