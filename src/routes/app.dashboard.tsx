import { useMemo, useState } from "react";
import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import {
  FolderKanban,
  CheckCircle2,
  ListTodo,
  Users,
  ArrowUpRight,
  Rocket,
  Sparkles,
  AlertTriangle,
  CalendarClock,
  Flame,
  UserX,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { members, projectStatusMeta, type ProjectStatus } from "@/lib/mock-data";
import {
  fetchDashboardSummary,
  mapTaskStatusCountsForChart,
  type DashboardRecentTask,
  type DashboardTaskPriority,
  type DashboardTaskStatus,
} from "@/lib/api/dashboard";
import { fetchWorkspaceAiSummary, workspaceAiSummaryQueryKey } from "@/lib/api/ai";
import { fetchTasks } from "@/lib/api/tasks";
import {
  buildTaskActivitySeries,
  computeTaskAnalyticsCounts,
  localeForAnalytics,
  taskActivityHasData,
  type DashboardAnalyticsPeriod,
} from "@/lib/dashboard-analytics";
import type { TasksSearch } from "@/routes/app.tasks";
import { fetchProjects, type ProjectApiItem, type ProjectApiStatus } from "@/lib/api/projects";
import { resolveProjectGradient } from "@/lib/project-color";
import { AssigneeAvatars } from "@/components/app/AssigneeAvatars";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
import {
  canManageWorkspaceTeam,
  isWorkspaceManager,
  useCurrentUser,
  useCurrentWorkspace,
} from "@/lib/auth/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dashboardPriorityLabel,
  dashboardStatusLabel,
  projectStatusLabel,
  useI18n,
  type TKey,
} from "@/lib/i18n";
import { taskStatusChipClass } from "@/lib/task-status-theme";
import { cn } from "@/lib/utils";
import { translateStarterProjectName, translateStarterTitle } from "@/lib/starter-content";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Pie, PieChart } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Dashboard — TeamFlow AI" }] }),
  component: Dashboard,
});

const initialsMap = Object.fromEntries(members.map((m) => [m.id, m.avatar]));

const recentStatusMeta: Record<DashboardTaskStatus, { labelKey: TKey; tone: string }> = {
  BACKLOG: { labelKey: "board.backlog", tone: taskStatusChipClass.backlog },
  TODO: { labelKey: "board.todo", tone: taskStatusChipClass.todo },
  IN_PROGRESS: { labelKey: "board.inProgress", tone: taskStatusChipClass.in_progress },
  REVIEW: { labelKey: "board.review", tone: taskStatusChipClass.review },
  DONE: { labelKey: "board.done", tone: taskStatusChipClass.done },
};

const recentPriorityTone: Record<DashboardTaskPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-info/15 text-info",
  HIGH: "bg-warning/20 text-warning-foreground",
  URGENT: "bg-destructive/15 text-destructive",
};

const apiProjectStatusMap: Record<ProjectApiStatus, ProjectStatus> = {
  ACTIVE: "active",
  PLANNING: "planning",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
};

type DashboardProjectCard = {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  openTasks: number;
  totalTasks: number;
  color: string;
};

const analyticsPeriods: DashboardAnalyticsPeriod[] = ["week", "month", "year"];

function Dashboard() {
  const { t, lang } = useI18n();
  const { data: me } = useCurrentUser();
  const canManageProjects = isWorkspaceManager(me?.workspace?.role);
  const canManageTeam = canManageWorkspaceTeam(me?.workspace?.role);
  const [activityPeriod, setActivityPeriod] = useState<DashboardAnalyticsPeriod>("week");
  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
  });
  const {
    data: workspaceTasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
  const {
    data: apiProjects = [],
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const analyticsLocale = localeForAnalytics(lang);
  const taskAnalyticsCounts = useMemo(
    () => computeTaskAnalyticsCounts(workspaceTasks),
    [workspaceTasks],
  );
  const taskActivityBuckets = useMemo(
    () => buildTaskActivitySeries(workspaceTasks, activityPeriod, analyticsLocale),
    [workspaceTasks, activityPeriod, analyticsLocale],
  );
  const taskActivityChartHasData = useMemo(
    () => taskActivityHasData(taskActivityBuckets),
    [taskActivityBuckets],
  );

  const taskStatusChartData = useMemo(
    () => (data ? mapTaskStatusCountsForChart(data.taskStatusCounts) : []),
    [data],
  );

  const taskStatusChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const entry of taskStatusChartData) {
      config[entry.statusKey] = {
        label: dashboardStatusLabel(entry.statusKey, t),
        color: entry.fill,
      };
    }
    return config;
  }, [taskStatusChartData, t]);

  const activeProjectsCount = useMemo(
    () => apiProjects.filter((project) => project.status === "ACTIVE").length,
    [apiProjects],
  );

  const dashboardProjects = useMemo(
    () => apiProjects.slice(0, 4).map(mapApiProjectToDashboardCard),
    [apiProjects],
  );

  const isEmptyWorkspace =
    !isLoading &&
    !isError &&
    data != null &&
    data.activeProjects === 0 &&
    data.openTasks === 0 &&
    data.completedTasks === 0;

  const stats = data
    ? [
        {
          label: t("dashboard.activeProjects"),
          value: projectsLoading || projectsError ? 0 : activeProjectsCount,
          icon: FolderKanban,
          to: "/app/projects" as const,
          search: { status: "active" as const },
          ariaKey: "dashboard.viewActiveProjects" as const,
        },
        {
          label: t("dashboard.openTasks"),
          value: data.openTasks,
          icon: ListTodo,
          to: "/app/tasks" as const,
          search: { status: "open" as const },
          ariaKey: "dashboard.viewOpenTasks" as const,
        },
        {
          label: t("dashboard.completed"),
          value: data.completedTasks,
          icon: CheckCircle2,
          to: "/app/tasks" as const,
          search: { status: "done" as const },
          ariaKey: "dashboard.viewCompletedTasks" as const,
        },
        {
          label: t("dashboard.teamMembers"),
          value: data.teamMembers,
          icon: Users,
          to: "/app/team" as const,
          ariaKey: "dashboard.viewTeamMembers" as const,
        },
      ]
    : [];

  const analyticsCards: {
    labelKey: TKey;
    value: number;
    icon: typeof AlertTriangle;
    ariaKey: TKey;
    tone: string;
    search: TasksSearch;
  }[] = [
    {
      labelKey: "dashboard.overdue",
      value: taskAnalyticsCounts.overdue,
      icon: AlertTriangle,
      ariaKey: "dashboard.viewOverdueTasks",
      tone: "text-destructive",
      search: { status: "open", due: "overdue" },
    },
    {
      labelKey: "dashboard.dueSoon",
      value: taskAnalyticsCounts.dueSoon,
      icon: CalendarClock,
      ariaKey: "dashboard.viewDueSoonTasks",
      tone: "text-warning-foreground",
      search: { status: "open", due: "soon" },
    },
    {
      labelKey: "dashboard.highPriorityOpen",
      value: taskAnalyticsCounts.highPriorityOpen,
      icon: Flame,
      ariaKey: "dashboard.viewHighPriorityTasks",
      tone: "text-warning-foreground",
      search: { status: "open", priority: "high" },
    },
    {
      labelKey: "dashboard.unassigned",
      value: taskAnalyticsCounts.unassigned,
      icon: UserX,
      ariaKey: "dashboard.viewUnassignedTasks",
      tone: "text-muted-foreground",
      search: { status: "open", assignee: "unassigned" },
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title={t("dashboard.overviewTitle")}
        subtitle={t("dashboard.overviewSubtitle")}
        actions={
          canManageProjects ? (
            <NewProjectDialog>
              <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
                {t("common.newProject")} <ArrowUpRight className="size-4" />
              </Button>
            </NewProjectDialog>
          ) : undefined
        }
      />

      {isEmptyWorkspace ? (
        <EmptyState
          className="mb-6"
          icon={Rocket}
          title={t("workspace.onboardingTitle")}
          description={
            canManageProjects || canManageTeam
              ? t("workspace.onboardingDescription")
              : t("workspace.permissionHint")
          }
          primaryAction={
            canManageProjects ? (
              <NewProjectDialog>
                <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
                  {t("common.createProject")}
                </Button>
              </NewProjectDialog>
            ) : undefined
          }
          secondaryAction={
            canManageTeam ? (
              <Button variant="outline" asChild>
                <Link to="/app/team">{t("team.inviteMember")}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {isLoading ? (
        <StatCardSkeletons />
      ) : isError ? (
        <ApiErrorState
          title={t("dashboard.loadErrorTitle")}
          error={error}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard
              key={s.label}
              to={s.to}
              search={"search" in s ? s.search : undefined}
              ariaLabel={t(s.ariaKey)}
              icon={s.icon}
              value={s.value}
              label={s.label}
            />
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link
          to="/app/tasks"
          search={{ status: "open" }}
          className="mb-3 inline-flex text-xs text-muted-foreground transition hover:text-primary hover:underline"
        >
          {t("dashboard.basedOnWorkspaceTasks")}
        </Link>
        {tasksLoading ? (
          <AnalyticsCardsSkeleton />
        ) : tasksError ? null : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {analyticsCards.map((card) => (
              <AnalyticsMetricCard
                key={card.labelKey}
                to="/app/tasks"
                search={card.search}
                ariaLabel={t(card.ariaKey)}
                icon={card.icon}
                value={card.value}
                label={t(card.labelKey)}
                iconClassName={card.tone}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft xl:col-span-2">
          <TaskActivityChartSection
            period={activityPeriod}
            onPeriodChange={setActivityPeriod}
            buckets={taskActivityBuckets}
            hasData={taskActivityChartHasData}
            isLoading={tasksLoading}
            isError={tasksError}
            t={t}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-base font-semibold">{t("dashboard.taskStatus")}</h2>
          <p className="text-xs text-muted-foreground">{t("dashboard.acrossActiveProjects")}</p>
          {isLoading ? (
            <TaskStatusChartSkeleton />
          ) : isError ? null : (
            <>
              <ChartContainer config={taskStatusChartConfig} className="mx-auto h-56 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="statusKey" />} />
                  <Pie
                    data={taskStatusChartData}
                    dataKey="value"
                    nameKey="statusKey"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {taskStatusChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ul className="space-y-1.5 text-xs">
                {taskStatusChartData.map((s) => (
                  <li key={s.statusKey} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: s.fill }} />
                      {dashboardStatusLabel(s.statusKey, t)}
                    </span>
                    <span className="font-medium text-muted-foreground">{s.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <DashboardAiInsightsCard />

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("dashboard.projectProgress")}</h2>
            <Link to="/app/projects" className="text-xs text-primary hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>
          {projectsLoading ? (
            <ProjectCardsSkeleton />
          ) : projectsError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("common.errorServerHint")}
            </p>
          ) : dashboardProjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("projects.emptyHint")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboardProjects.map((p) => (
                <DashboardProjectCard key={p.id} project={p} t={t} lang={lang} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("dashboard.recentActivity")}</h2>
          <Link
            to="/app/tasks"
            search={{ status: "open" }}
            className="text-xs text-primary hover:underline"
          >
            {t("common.seeAll")}
          </Link>
        </div>
        {isLoading ? (
          <RecentTasksSkeleton />
        ) : isError ? null : data && data.recentTasks.length === 0 ? (
          <EmptyState
            compact
            className="border-0 bg-transparent shadow-none"
            title={t("dashboard.noRecentActivityTitle")}
            description={t("dashboard.noRecentActivityHint")}
          />
        ) : (
          <ul className="divide-y divide-border">
            {data?.recentTasks.map((task) => (
              <RecentTaskRow key={task.id} task={task} t={t} lang={lang} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function RecentTaskRow({
  task,
  t,
  lang,
}: {
  task: DashboardRecentTask;
  t: (key: TKey) => string;
  lang: import("@/lib/i18n").Lang;
}) {
  const status = recentStatusMeta[task.status];
  const assigneeOptions = task.assignees.map((assignee) => ({
    id: assignee.id,
    name: assignee.name,
    email: assignee.email,
    avatar: initialsFromName(assignee.name),
    avatarUrl: assignee.avatarUrl ?? null,
  }));
  const taskSearch = task.id ? { taskId: task.id } : undefined;

  return (
    <li>
      <Link
        to="/app/tasks"
        search={taskSearch}
        aria-label={`${t("dashboard.viewTask")}: ${translateStarterTitle(task.title, lang)}`}
        className="flex items-center gap-3 rounded-lg py-3 text-sm transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {assigneeOptions.length > 0 ? (
          <AssigneeAvatars assignees={assigneeOptions} maxVisible={2} className="shrink-0" />
        ) : (
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {task.key}
            </span>
            <span className="truncate font-medium">{translateStarterTitle(task.title, lang)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{translateStarterProjectName(task.project.name, lang)}</span>
            <Badge variant="secondary" className={status.tone + " border-0 capitalize"}>
              {t(status.labelKey)}
            </Badge>
            <Badge variant="secondary" className={recentPriorityTone[task.priority] + " border-0"}>
              {dashboardPriorityLabel(task.priority, t)}
            </Badge>
          </div>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {formatUpdatedAt(task.updatedAt)}
        </div>
      </Link>
    </li>
  );
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapApiProjectToDashboardCard(project: ProjectApiItem): DashboardProjectCard {
  return {
    id: project.id,
    name: project.name,
    status: apiProjectStatusMap[project.status],
    progress: project.progress,
    openTasks: project.openTasks,
    totalTasks: project.totalTasks,
    color: resolveProjectGradient(project),
  };
}

function DashboardProjectCard({
  project,
  t,
  lang,
}: {
  project: DashboardProjectCard;
  t: (key: TKey) => string;
  lang: import("@/lib/i18n").Lang;
}) {
  const meta = projectStatusMeta[project.status];
  const cardBody = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <div className={"h-1.5 w-10 rounded-full bg-gradient-to-r " + project.color} />
          <div className="mt-2 text-sm font-semibold">
            {translateStarterProjectName(project.name, lang)}
          </div>
          <div className="text-xs text-muted-foreground">
            {project.openTasks} open · {project.totalTasks} total
          </div>
        </div>
        <Badge variant="secondary" className={meta.className + " border-0"}>
          {projectStatusLabel(project.status, t)}
        </Badge>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={"h-full rounded-full bg-gradient-to-r " + project.color}
          style={{ width: project.progress + "%" }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{project.progress}%</span>
      </div>
    </>
  );

  if (!project.id) {
    return <div className="rounded-xl border border-border p-4">{cardBody}</div>;
  }

  return (
    <Link
      to="/app/projects/$projectId"
      params={{ projectId: project.id }}
      aria-label={`${t("dashboard.viewProject")}: ${translateStarterProjectName(project.name, lang)}`}
      className="group block rounded-xl border border-border p-4 transition hover:border-primary/30 hover:bg-accent/30"
    >
      {cardBody}
    </Link>
  );
}

function DashboardAiInsightsCard() {
  const { t, lang } = useI18n();
  const { data: currentWorkspace } = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;

  const { data, isError, isLoading, isFetching, refetch } = useQuery({
    // Same key as /app/ai so Dashboard and AI page share the React Query cache.
    queryKey: workspaceId
      ? workspaceAiSummaryQueryKey(workspaceId, lang)
      : (["workspace-ai-summary", null, lang] as const),
    queryFn: () => fetchWorkspaceAiSummary(lang),
    enabled: Boolean(workspaceId),
  });

  const isEmptyWorkspace =
    !!data && data.metrics.totalProjects === 0 && data.metrics.totalTasks === 0;
  const previewRisks = data?.risks.slice(0, 2) ?? [];
  const previewActions = data?.recommendedNextActions.slice(0, 2) ?? [];
  const showSuccess = !!data && !isEmptyWorkspace;

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-card to-card p-5 shadow-soft xl:col-span-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="truncate">{t("dashboard.aiInsights")}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("dashboard.aiInsightsDescription")}
          </p>
        </div>
        {showSuccess && isFetching ? (
          <RefreshCw
            className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      {!workspaceId || isLoading ? (
        <AiInsightsSkeleton />
      ) : isError && !data ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{t("dashboard.aiInsightsError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", isFetching && "animate-spin")} />
            {t("common.retry")}
          </Button>
        </div>
      ) : isEmptyWorkspace ? (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm font-medium">{t("ai.emptyWorkspaceTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("ai.emptyWorkspaceHint")}</p>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/app/projects">
              <FolderKanban className="size-4" />
              {t("ai.goToProjects")}
            </Link>
          </Button>
        </div>
      ) : showSuccess ? (
        <>
          <p className="mt-4 line-clamp-4 break-words text-sm leading-relaxed text-foreground/90">
            {data.overview}
          </p>

          {previewRisks.length > 0 ? (
            <div className="mt-4 min-w-0">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning-foreground">
                <AlertTriangle className="size-3.5 shrink-0" />
                {t("ai.risks")}
              </div>
              <ul className="space-y-1.5">
                {previewRisks.map((risk, index) => (
                  <li
                    key={`risk-${index}`}
                    className="line-clamp-2 break-words rounded-lg border border-border/60 bg-card/70 px-2.5 py-1.5 text-xs text-muted-foreground"
                  >
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {previewActions.length > 0 ? (
            <div className="mt-4 min-w-0">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-info">
                <ListChecks className="size-3.5 shrink-0" />
                {t("ai.actions")}
              </div>
              <ol className="list-decimal space-y-1.5 pl-4">
                {previewActions.map((action, index) => (
                  <li
                    key={`action-${index}`}
                    className="line-clamp-2 break-words text-xs text-muted-foreground"
                  >
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link to="/app/ai">{t("dashboard.openFullBriefing")}</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}

function AiInsightsSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-4/5 rounded-lg" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

function ProjectCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border p-4">
          <Skeleton className="h-1.5 w-10 rounded-full" />
          <Skeleton className="mt-2 h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-3 h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

function StatCardSkeletons() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="mt-4 h-9 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function TaskStatusChartSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <Skeleton className="mx-auto h-56 w-56 rounded-full" />
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

function RecentTasksSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-20" />
        </li>
      ))}
    </ul>
  );
}

const cardLinkClass =
  "rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const periodLabelKeys: Record<DashboardAnalyticsPeriod, TKey> = {
  week: "dashboard.periodWeek",
  month: "dashboard.periodMonth",
  year: "dashboard.periodYear",
};

function TaskActivityChartSection({
  period,
  onPeriodChange,
  buckets,
  hasData,
  isLoading,
  isError,
  t,
}: {
  period: DashboardAnalyticsPeriod;
  onPeriodChange: (period: DashboardAnalyticsPeriod) => void;
  buckets: ReturnType<typeof buildTaskActivitySeries>;
  hasData: boolean;
  isLoading: boolean;
  isError: boolean;
  t: (key: TKey) => string;
}) {
  const chartData = buckets.map((bucket) => ({
    label: bucket.label,
    created: bucket.created,
    done: bucket.done,
  }));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("dashboard.taskActivity")}</h2>
          <p className="text-xs text-muted-foreground">{t("dashboard.doneTasksActivityNote")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label={t("dashboard.taskActivity")}
          >
            {analyticsPeriods.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onPeriodChange(value)}
                aria-pressed={period === value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  period === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(periodLabelKeys[value])}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-primary" /> {t("dashboard.createdTasks")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-info" /> {t("dashboard.doneTasks")}
            </span>
          </div>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError ? (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {t("common.errorServerHint")}
        </p>
      ) : !hasData ? (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {t("dashboard.noTasksInPeriod")}
        </p>
      ) : (
        <ChartContainer
          config={{
            created: { label: t("dashboard.createdTasks"), color: "var(--primary)" },
            done: { label: t("dashboard.doneTasks"), color: "var(--info)" },
          }}
          className="h-64 w-full [&_.recharts-cartesian-grid_line]:stroke-border/80"
        >
          <BarChart data={chartData} barGap={4} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              angle={period === "month" ? -18 : 0}
              textAnchor={period === "month" ? "end" : "middle"}
              height={period === "month" ? 52 : 32}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent nameKey="dataKey" />} />
            <Bar dataKey="created" fill="var(--color-created)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="done" fill="var(--color-done)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </>
  );
}

function AnalyticsMetricCard({
  to,
  search,
  ariaLabel,
  icon: Icon,
  value,
  label,
  iconClassName,
}: {
  to: "/app/tasks";
  search: TasksSearch;
  ariaLabel: string;
  icon: typeof AlertTriangle;
  value: number;
  label: string;
  iconClassName?: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      aria-label={ariaLabel}
      className={cn("group block", cardLinkClass)}
    >
      <div
        className={cn(
          "grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground transition group-hover:bg-primary/10",
          iconClassName,
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}

function AnalyticsCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="mt-4 h-9 w-12" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

type StatCardSearch =
  | { status: "done" | "open" }
  | { status: "active" | "planning" | "on_hold" | "completed" | "all" };

function StatCard({
  to,
  search,
  ariaLabel,
  icon: Icon,
  value,
  label,
}: {
  to: LinkProps["to"];
  search?: StatCardSearch;
  ariaLabel: string;
  icon: typeof FolderKanban;
  value: number;
  label: string;
}) {
  const content = (
    <>
      <div className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="size-4" />
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </>
  );
  const className = cn("group block", cardLinkClass);

  if (to === "/app/tasks" && search) {
    return (
      <Link to="/app/tasks" search={search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  if (to === "/app/projects" && search) {
    return (
      <Link to="/app/projects" search={search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link to={to} aria-label={ariaLabel} className={className}>
      {content}
    </Link>
  );
}
