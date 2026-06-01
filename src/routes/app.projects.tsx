import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/app/Avatar";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
import { members, projectStatusMeta, type Project, type ProjectStatus } from "@/lib/mock-data";
import {
  createProject,
  fetchProjects,
  type ProjectApiItem,
  type ProjectApiStatus,
} from "@/lib/api/projects";
import { useI18n, type TKey } from "@/lib/i18n";
import { Plus, Search, Calendar, ListTodo, FolderKanban, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/app/projects")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Projects — TeamFlow AI" }] }),
  component: ProjectsPage,
});

const initialsMap = Object.fromEntries(members.map((m) => [m.id, m.avatar]));

const filters: { key: "all" | ProjectStatus; labelKey: TKey }[] = [
  { key: "all", labelKey: "projects.all" },
  { key: "active", labelKey: "projects.active" },
  { key: "planning", labelKey: "projects.planning" },
  { key: "on_hold", labelKey: "projects.onHold" },
  { key: "completed", labelKey: "projects.completed" },
];

type ProjectCard = Pick<
  Project,
  | "id"
  | "name"
  | "description"
  | "status"
  | "progress"
  | "openTasks"
  | "totalTasks"
  | "members"
  | "color"
  | "dueDate"
  | "updatedAt"
>;

const apiStatusMap: Record<ProjectApiStatus, ProjectStatus> = {
  ACTIVE: "active",
  PLANNING: "planning",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
};

const projectStatusMap: Record<ProjectStatus, ProjectApiStatus> = {
  active: "ACTIVE",
  planning: "PLANNING",
  on_hold: "ON_HOLD",
  completed: "COMPLETED",
};

function ProjectsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [q, setQ] = useState("");
  const {
    data: apiProjects = [],
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });
  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  const workspaceId = apiProjects[0]?.workspace.id;
  const projectList = apiProjects.map(mapApiProjectToCard);
  const filtered = projectList.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (q === "" || p.name.toLowerCase().includes(q.toLowerCase())),
  );
  const hasActiveFilters = filter !== "all" || q !== "";
  const isTrulyEmpty = projectList.length === 0;

  return (
    <AppShell title={t("projects.projects")}>
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("projects.projects")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("projects.allProjects")} across your workspace.
          </p>
        </div>
        <NewProjectDialog
          isSubmitting={createProjectMutation.isPending}
          onCreate={async (project) => {
            if (!workspaceId) {
              throw new Error(
                "Workspace is required. Load or seed a workspace before creating a project.",
              );
            }

            await createProjectMutation.mutateAsync({
              workspaceId,
              name: project.name,
              description: project.description,
              status: projectStatusMap[project.status],
              color: project.color,
              dueDate: project.dueDate,
            });
          }}
        >
          <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
            <Plus className="size-4" /> {t("common.newProject")}
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
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("projects.searchProjects")}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingGrid />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : filtered.length === 0 ? (
        isTrulyEmpty ? (
          <EmptyState
            isSubmitting={createProjectMutation.isPending}
            onCreate={async (project) => {
              if (!workspaceId) {
                throw new Error(
                  "Workspace is required. Load or seed a workspace before creating a project.",
                );
              }

              await createProjectMutation.mutateAsync({
                workspaceId,
                name: project.name,
                description: project.description,
                status: projectStatusMap[project.status],
                color: project.color,
                dueDate: project.dueDate,
              });
            }}
          />
        ) : (
          <NoResultsState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              setFilter("all");
              setQ("");
            }}
          />
        )
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
                  <Badge variant="secondary" className={meta.className + " border-0"}>
                    {meta.label}
                  </Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={"h-full rounded-full bg-gradient-to-r " + p.color}
                    style={{ width: p.progress + "%" }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ListTodo className="size-3" /> {p.openTasks} / {p.totalTasks}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" /> Due {p.dueDate}
                  </span>
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

function mapApiProjectToCard(project: ProjectApiItem): ProjectCard {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: apiStatusMap[project.status],
    progress: project.progress,
    openTasks: project.openTasks,
    totalTasks: project.totalTasks,
    members: [],
    color: project.color ?? "from-indigo-500 to-violet-500",
    dueDate: formatDate(project.dueDate),
    updatedAt: formatDate(project.updatedAt),
  };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="h-2 w-12 animate-pulse rounded-full bg-muted" />
          <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
          <div className="mt-5 h-1.5 animate-pulse rounded-full bg-muted" />
          <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-soft">
      <h3 className="text-base font-semibold">Could not load projects</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ??
          "We could not reach the server. Check that the backend is running, then try again."}
      </p>
      <Button
        onClick={onRetry}
        className="mt-5 bg-gradient-brand text-white shadow-glow hover:opacity-95"
      >
        Retry
      </Button>
    </div>
  );
}

function NoResultsState({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Search className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No projects match your search</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Try a different keyword or status filter, or clear filters to see all projects.
      </p>
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClearFilters} className="mt-5">
          <RotateCcw className="size-4" /> Clear filters
        </Button>
      )}
    </div>
  );
}

function EmptyState({
  isSubmitting,
  onCreate,
}: {
  isSubmitting: boolean;
  onCreate: (project: Project) => void | Promise<void>;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <FolderKanban className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No projects yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Create your first project to organize tasks, track progress, and collaborate with your team.
      </p>
      <NewProjectDialog isSubmitting={isSubmitting} onCreate={onCreate}>
        <Button className="mt-5 bg-gradient-brand text-white shadow-glow hover:opacity-95">
          <Plus className="size-4" /> {t("common.createProject")}
        </Button>
      </NewProjectDialog>
    </div>
  );
}
