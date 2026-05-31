import { useState, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

export type Workspace = {
  id: string;
  name: string;
  plan: string;
  initials: string;
};

const workspaces: Workspace[] = [
  { id: "ws1", name: "Acme Studio", plan: "Pro", initials: "AC" },
  { id: "ws2", name: "Northwind Labs", plan: "Free", initials: "NL" },
  { id: "ws3", name: "Atlas Design Co.", plan: "Business", initials: "AD" },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <AppSidebar activeWorkspace={activeWorkspace} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          title={title}
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={setActiveWorkspace}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
