import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarStack } from "@/components/app/Avatar";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
import { members, projectStatusMeta, type Project, type ProjectStatus } from "@/lib/mock-data";
import { fetchProjects, type ProjectApiItem, type ProjectApiStatus } from "@/lib/api/projects";
import { getProjectAccent } from "@/lib/project-color";
import { isWorkspaceManager, useCurrentUser } from "@/lib/auth/use-current-user";
import { projectStatusLabel, useI18n, type TKey } from "@/lib/i18n";
import { formatDueDateTimeShort } from "@/lib/due-datetime";
import {
  parseProjectsUrlStatus,
  projectListStatusFromUrl,
  projectsUrlStatusFromFilter,
  type ProjectsSearch,
} from "@/lib/project-status-url";
import { Plus, Search, Calendar, ListTodo, FolderKanban, RotateCcw } from "lucide-react";
import { displayProjectDescription, displayProjectName } from "@/lib/starter-content";

export const Route = createFileRoute("/app/projects/")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    status: parseProjectsUrlStatus(search.status),
  }),
  head: () => ({ meta: [{ title: "Projects — TeamFlow AI" }] }),
  component: ProjectsIndexPage,
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

function ProjectsIndexPage() {
  const { t, lang } = useI18n();
  const { data: me } = useCurrentUser();
  const canManageProjects = isWorkspaceManager(me?.workspace?.role);
  const { status: statusFromUrl } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filter, setFilter] = useState<"all" | ProjectStatus>(() =>
    projectListStatusFromUrl(statusFromUrl),
  );
  const [q, setQ] = useState("");

  useEffect(() => {
    setFilter(projectListStatusFromUrl(statusFromUrl));
  }, [statusFromUrl]);

  function updateUrlSearch(patch: Partial<ProjectsSearch>) {
    void navigate({
      search: {
        status: patch.status !== undefined ? patch.status : statusFromUrl,
      },
      replace: true,
    });
  }

  function setStatusFilter(next: "all" | ProjectStatus) {
    setFilter(next);
    updateUrlSearch({ status: projectsUrlStatusFromFilter(next) });
  }
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
  const projectList = apiProjects.map(mapApiProjectToCard);
  const filtered = projectList.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (q === "" || p.name.toLowerCase().includes(q.toLowerCase())),
  );
  const hasActiveFilters = filter !== "all" || q !== "";
  const isTrulyEmpty = projectList.length === 0;

  return (
    <AppShell>
      <PageHeader
        title={t("projects.projects")}
        subtitle={canManageProjects ? t("projects.subtitle") : t("access.memberProjectsHint")}
        actions={
          canManageProjects ? (
            <NewProjectDialog>
              <Button variant="brand">
                <Plus className="size-4" /> {t("common.newProject")}
              </Button>
            </NewProjectDialog>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={
                "h-10 rounded-lg border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 " +
                (filter === f.key
                  ? "border-primary/30 bg-primary/12 text-primary shadow-sm"
                  : "border-control-border bg-control text-control-foreground hover:bg-control-hover")
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
        <ApiErrorState
          title={t("projects.loadErrorTitle")}
          error={error}
          onRetry={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        isTrulyEmpty ? (
          <ProjectsEmptyState canManageProjects={canManageProjects} />
        ) : (
          <NoResultsState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              setStatusFilter("all");
              setQ("");
            }}
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const meta = projectStatusMeta[p.status];
            return (
              <Link
                key={p.id}
                to="/app/projects/$projectId"
                params={{ projectId: p.id }}
                className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
              >
                <div className="flex items-start justify-between">
                  <div className={"h-2 w-12 rounded-full bg-gradient-to-r " + p.color} />
                  <Badge variant="secondary" className={meta.className + " border-0"}>
                    {projectStatusLabel(p.status, t)}
                  </Badge>
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {displayProjectName(p.name, lang)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {displayProjectDescription(p.description, lang)}
                </p>

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
                    <Calendar className="size-3" /> {t("projects.due")} {p.dueDate}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <AvatarStack ids={p.members} initialsMap={initialsMap} />
                  <span className="text-xs text-muted-foreground">
                    {t("projects.updated")} {p.updatedAt}
                  </span>
                </div>
              </Link>
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
    color: getProjectAccent(project).gradient,
    dueDate: formatDueDate(project.dueDate),
    updatedAt: formatUpdatedAt(project.updatedAt),
  };
}

function formatDueDate(value: string | null) {
  if (!value) return "—";
  return formatDueDateTimeShort(value);
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Skeleton className="h-2 w-12 rounded-full" />
          <Skeleton className="mt-4 h-5 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-5 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-4 h-4 w-1/2" />
        </div>
      ))}
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
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Search className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{t("projects.noMatchTitle")}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {t("projects.noMatchHint")}
      </p>
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClearFilters} className="mt-5">
          <RotateCcw className="size-4" /> {t("common.clearFilters")}
        </Button>
      )}
    </div>
  );
}

function ProjectsEmptyState({ canManageProjects }: { canManageProjects: boolean }) {
  const { t } = useI18n();

  return (
    <EmptyState
      icon={FolderKanban}
      title={t("projects.emptyTitle")}
      description={canManageProjects ? t("projects.emptyHint") : t("workspace.permissionHint")}
      primaryAction={
        canManageProjects ? (
          <NewProjectDialog>
            <Button variant="brand">
              <Plus className="size-4" /> {t("common.createProject")}
            </Button>
          </NewProjectDialog>
        ) : undefined
      }
      secondaryAction={
        canManageProjects ? (
          <Button variant="outline" asChild>
            <Link to="/app/team">{t("team.inviteMember")}</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
