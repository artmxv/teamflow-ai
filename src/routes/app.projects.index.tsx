import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import {
  CREATE_ACTION_BUTTON_CLASSNAME,
  FILTER_RESET_CLASSNAME,
  FILTER_SELECT_BASE_CLASSNAME,
  FILTER_SELECT_WIDTH_STATUS_CLASSNAME,
  FilterBar,
  FilterTriggerLabel,
  filterSelectActiveAttr,
} from "@/components/app/FilterBar";
import { PageHeader } from "@/components/app/PageHeader";
import { ProjectAccentSurface } from "@/components/app/ProjectAccentSurface";
import { ProjectMemberStack } from "@/components/app/ProjectMemberStack";
import { ProjectStatusIndicator } from "@/components/app/ProjectStatusIndicator";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
import { type Project, type ProjectStatus } from "@/lib/mock-data";
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
import { Plus, Search, Calendar, ListTodo, FolderKanban, RotateCcw, CircleDot } from "lucide-react";
import { displayProjectDescription, displayProjectName } from "@/lib/starter-content";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/projects/")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    status: parseProjectsUrlStatus(search.status),
  }),
  head: () => ({ meta: [{ title: "Projects — TeamFlow AI" }] }),
  component: ProjectsIndexPage,
});

const filters: { key: "all" | ProjectStatus; labelKey: TKey }[] = [
  { key: "all", labelKey: "projects.all" },
  { key: "planning", labelKey: "projects.planning" },
  { key: "active", labelKey: "projects.active" },
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
              <Button variant="brand" className={CREATE_ACTION_BUTTON_CLASSNAME}>
                <Plus className="size-4" /> {t("common.newProject")}
              </Button>
            </NewProjectDialog>
          ) : undefined
        }
      />

      <FilterBar>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={filter}
              onValueChange={(value) => setStatusFilter(value as typeof filter)}
            >
              <SelectTrigger
                data-filter-active={filterSelectActiveAttr(filter !== "all")}
                className={cn(FILTER_SELECT_BASE_CLASSNAME, FILTER_SELECT_WIDTH_STATUS_CLASSNAME)}
              >
                <SelectValue>
                  <FilterTriggerLabel icon={CircleDot}>
                    {t(filters.find((item) => item.key === filter)?.labelKey ?? "projects.all")}
                  </FilterTriggerLabel>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[12rem]">
                {filters.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.key === "all" ? (
                      t(option.labelKey)
                    ) : (
                      <ProjectStatusIndicator status={option.key}>
                        {t(option.labelKey)}
                      </ProjectStatusIndicator>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className={FILTER_RESET_CLASSNAME}
              disabled={!hasActiveFilters}
              onClick={() => {
                setStatusFilter("all");
                setQ("");
              }}
            >
              <RotateCcw className="size-4" />
              {t("common.resetFilters")}
            </Button>
          </div>
          <div className="relative w-full min-w-0 sm:w-72">
            <Search
              className="filter-search-icon absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("projects.searchProjects")}
              className="filter-search-input pl-9"
            />
          </div>
        </div>
      </FilterBar>

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
          <NoResultsState />
        )
      ) : (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((p) => {
            const description = displayProjectDescription(p.description, lang);
            return (
              <Link
                key={p.id}
                to="/app/projects/$projectId"
                params={{ projectId: p.id }}
                className="group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ProjectAccentSurface
                  gradient={p.color}
                  className="h-full min-h-[16.25rem] group-hover:-translate-y-0.5 group-hover:border-border group-hover:shadow-card"
                  contentClassName="px-5 pb-5 pt-9"
                >
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 min-h-6 min-w-0 flex-1 break-words text-base font-semibold leading-6 tracking-tight [overflow-wrap:anywhere]">
                        {displayProjectName(p.name, lang)}
                      </h3>
                      <ProjectStatusIndicator
                        status={p.status}
                        className="mt-0.5 shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {projectStatusLabel(p.status, t)}
                      </ProjectStatusIndicator>
                    </div>
                    <p className="mt-1.5 line-clamp-3 min-h-[3.75rem] min-w-0 break-words text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                      {description || "\u00A0"}
                    </p>

                    <div className="mt-auto pt-4">
                      <div className="mb-2.5 flex min-w-0 items-center gap-3">
                        <ProjectMemberStack projectId={p.id} />
                        <span className="ml-auto shrink-0 text-base font-semibold tabular-nums">
                          {p.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                        <div
                          className={
                            "project-progress-fill h-full rounded-full bg-gradient-to-r " + p.color
                          }
                          style={{ width: p.progress + "%" }}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <ListTodo className="size-3" /> {p.openTasks} / {p.totalTasks}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1 break-words [overflow-wrap:anywhere]">
                          <Calendar className="size-3 shrink-0" /> {t("projects.due")} {p.dueDate}
                        </span>
                      </div>
                    </div>
                  </div>
                </ProjectAccentSurface>
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
    color: project.color?.trim() || getProjectAccent(project).gradient,
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          <Skeleton className="mt-3 h-5 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-5 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-4 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function NoResultsState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center sm:px-10">
      <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Search className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{t("projects.noMatchTitle")}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        {t("projects.noMatchHint")}
      </p>
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
