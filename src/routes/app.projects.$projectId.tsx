import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/app/Avatar";
import { projectStatusMeta, type ProjectStatus } from "@/lib/mock-data";
import { fetchProjects, type ProjectApiItem, type ProjectApiStatus } from "@/lib/api/projects";
import {
  fetchTasks,
  type TaskApiItem,
  type TaskApiPriority,
  type TaskApiStatus,
} from "@/lib/api/tasks";
import { Calendar, ChevronLeft, ListTodo } from "lucide-react";

export const Route = createFileRoute("/app/projects/$projectId")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Project — TeamFlow AI" }] }),
  component: ProjectDetailPage,
});

const apiStatusMap: Record<ProjectApiStatus, ProjectStatus> = {
  ACTIVE: "active",
  PLANNING: "planning",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
};

const taskStatusLabel: Record<TaskApiStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "Todo",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const taskStatusTone: Record<TaskApiStatus, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  TODO: "bg-info/15 text-info",
  IN_PROGRESS: "bg-primary/15 text-primary",
  REVIEW: "bg-warning/20 text-warning-foreground",
  DONE: "bg-success/15 text-success",
};

const taskPriorityLabel: Record<TaskApiPriority, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

const taskPriorityTone: Record<TaskApiPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-info/15 text-info",
  HIGH: "bg-warning/20 text-warning-foreground",
  URGENT: "bg-destructive/15 text-destructive",
};

function ProjectDetailPage() {
  const { projectId } = Route.useParams();

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const isLoading = projectsQuery.isLoading || tasksQuery.isLoading;
  const isError = projectsQuery.isError || tasksQuery.isError;
  const error = (projectsQuery.error ?? tasksQuery.error) as Error | null;

  const apiProjects = projectsQuery.data ?? [];
  const apiTasks = tasksQuery.data ?? [];

  const project = apiProjects.find((p) => p.id === projectId) ?? null;
  const projectTasks = apiTasks.filter((t) => t.projectId === projectId);

  const memberIds = Array.from(
    new Set(projectTasks.map((t) => t.assignee?.id).filter(Boolean) as string[]),
  );
  const initialsMap = Object.fromEntries(
    projectTasks
      .map((t) => t.assignee)
      .filter(Boolean)
      .map((a) => [a!.id, a!.avatar ?? initialsFromName(a!.name)] as const),
  );

  return (
    <AppShell title="Project">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/projects">
              <ChevronLeft className="size-4" /> Back to Projects
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {isLoading ? "Loading..." : (project?.name ?? "Project")}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading ? "Fetching project details" : "Read-only project details"}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void projectsQuery.refetch();
            void tasksQuery.refetch();
          }}
        />
      ) : !project ? (
        <NotFoundState />
      ) : (
        <ProjectDetails
          project={project}
          projectTasks={projectTasks}
          memberIds={memberIds}
          initialsMap={initialsMap}
        />
      )}
    </AppShell>
  );
}

function ProjectDetails({
  project,
  projectTasks,
  memberIds,
  initialsMap,
}: {
  project: ProjectApiItem;
  projectTasks: TaskApiItem[];
  memberIds: string[];
  initialsMap: Record<string, string>;
}) {
  const status = projectStatusMeta[apiStatusMap[project.status]];
  const due = formatDate(project.dueDate);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className={
                "h-2 w-16 rounded-full bg-gradient-to-r " +
                (project.color ?? "from-indigo-500 to-violet-500")
              }
            />
            <h2 className="mt-4 truncate text-xl font-semibold tracking-tight">{project.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{project.description || "—"}</p>
          </div>
          <Badge variant="secondary" className={status.className + " border-0"}>
            {status.label}
          </Badge>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Stat label="Status" value={status.label} />
          <Stat
            label="Due"
            value={
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5 text-muted-foreground" /> {due}
              </span>
            }
          />
          <Stat
            label="Tasks"
            value={
              <span className="inline-flex items-center gap-1">
                <ListTodo className="size-3.5 text-muted-foreground" /> {project.openTasks} /{" "}
                {project.totalTasks}
              </span>
            }
          />
          <Stat
            label="Members"
            value={
              memberIds.length > 0 ? (
                <AvatarStack ids={memberIds} initialsMap={initialsMap} />
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )
            }
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-medium text-foreground">{project.progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={
                "h-full rounded-full bg-gradient-to-r " +
                (project.color ?? "from-indigo-500 to-violet-500")
              }
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-base font-semibold">Tasks</h3>
        <p className="mt-1 text-xs text-muted-foreground">Tasks that belong to this project</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {projectTasks.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks in this project yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {projectTasks.map((task) => (
                <li key={task.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {task.key}
                        </span>
                        <span className="truncate text-sm font-medium">{task.title}</span>
                      </div>
                      {task.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={taskStatusTone[task.status] + " border-0 capitalize"}
                        >
                          {taskStatusLabel[task.status]}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={taskPriorityTone[task.priority] + " border-0 capitalize"}
                        >
                          {taskPriorityLabel[task.priority]}
                        </Badge>
                        {task.dueDate ? (
                          <span className="text-[11px] text-muted-foreground">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
        <div className="h-2 w-16 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-2 h-1.5 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-soft">
      <h3 className="text-base font-semibold">Could not load project</h3>
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

function NotFoundState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <h3 className="text-base font-semibold">Project not found</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        This projectId does not match any project in your workspace.
      </p>
      <Button variant="outline" className="mt-5" asChild>
        <Link to="/app/projects">Back to Projects</Link>
      </Button>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
