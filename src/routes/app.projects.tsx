import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";

export const Route = createFileRoute("/app/projects")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Projects — TeamFlow AI" }] }),
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return <Outlet />;
}
