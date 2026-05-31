import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/app/Avatar";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
import { projects, members, projectStatusMeta, type ProjectStatus } from "@/lib/mock-data";
import { Plus, Search, Calendar, ListTodo } from "lucide-react";

export const Route = createFileRoute("/app/projects")({
  head: () => ({ meta: [{ title: "Projects — TeamFlow AI" }] }),
  component: ProjectsPage,
});

const initialsMap = Object.fromEntries(members.map((m) => [m.id, m.avatar]));

const filters: { key: "all" | ProjectStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "planning", label: "Planning" },
  { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" },
];

function ProjectsPage() {
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [q, setQ] = useState("");
  const [projectList, setProjectList] = useState(projects);
  const filtered = projectList.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (q === "" || p.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <AppShell title="Projects">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">All projects across your workspace.</p>
        </div>
        <NewProjectDialog onCreate={(project) => setProjectList((current) => [project, ...current])}>
          <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
            <Plus className="size-4" /> New project
          </Button>
        </NewProjectDialog>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "rounded-lg px-3 py-1.5 text-sm transition " +
                (filter === f.key
                  ? "bg-foreground text-background"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState onCreate={(project) => setProjectList((current) => [project, ...current])} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const meta = projectStatusMeta[p.status];
            return (
              <div
                key={p.id}
                className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
              >
                <div className="flex items-start justify-between">
                  <div className={"h-2 w-12 rounded-full bg-gradient-to-r " + p.color} />
                  <Badge variant="secondary" className={meta.className + " border-0"}>{meta.label}</Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={"h-full rounded-full bg-gradient-to-r " + p.color} style={{ width: p.progress + "%" }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><ListTodo className="size-3" /> {p.openTasks} / {p.totalTasks}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Due {p.dueDate}</span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <AvatarStack ids={p.members} initialsMap={initialsMap} />
                  <span className="text-xs text-muted-foreground">Updated {p.updatedAt}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ onCreate }: { onCreate: (project: (typeof projects)[number]) => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Plus className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No projects yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Create your first project to start tracking work, assigning owners, and shipping with your team.
      </p>
      <NewProjectDialog onCreate={onCreate}>
        <Button className="mt-5 bg-gradient-brand text-white shadow-glow hover:opacity-95">
          <Plus className="size-4" /> Create project
        </Button>
      </NewProjectDialog>
    </div>
  );
}
