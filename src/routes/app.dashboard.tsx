import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { CREATE_ACTION_BUTTON_CLASSNAME } from "@/components/app/FilterBar";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import {
  FolderKanban,
  CheckCircle2,
  ListTodo,
  Users,
  Plus,
  Rocket,
  Sparkles,
  AlertTriangle,
  CalendarClock,
  Flame,
  UserX,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { members, projectStatusMeta, type ProjectStatus, type TaskStatus } from "@/lib/mock-data";
import {
  fetchDashboardSummary,
  mapTaskStatusCountsForChart,
  type DashboardRecentTask,
  type DashboardTaskPriority,
  type DashboardTaskStatus,
} from "@/lib/api/dashboard";
import { fetchWorkspaceAiSummary, workspaceAiSummaryQueryKey } from "@/lib/api/ai";
import { fetchTasks, type TaskApiItem } from "@/lib/api/tasks";
import { AI_ASK_SUGGESTION_KEYS, type AiAssistantAsk } from "@/lib/ai-assistant-ask";
import {
  buildTaskActivitySeries,
  computeTaskAnalyticsCounts,
  localeForAnalytics,
  taskActivityHasData,
  type DashboardAnalyticsPeriod,
} from "@/lib/dashboard-analytics";
import { effectiveDueDate, formatDueDateTimeShort } from "@/lib/due-datetime";
import type { TasksSearch } from "@/routes/app.tasks";
import type { ProjectsSearch } from "@/lib/project-status-url";
import { fetchProjects, type ProjectApiItem, type ProjectApiStatus } from "@/lib/api/projects";
import { getProjectAccent, resolveProjectGradient } from "@/lib/project-color";
import { AiEntityResponse } from "@/components/app/AiEntityResponse";
import { AssigneeAvatars } from "@/components/app/AssigneeAvatars";
import { ProjectAccentSurface } from "@/components/app/ProjectAccentSurface";
import { ProjectMemberStack } from "@/components/app/ProjectMemberStack";
import { ProjectStatusIndicator } from "@/components/app/ProjectStatusIndicator";
import { TaskStatusIndicator } from "@/components/app/TaskStatusIndicator";
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
import { taskPriorityChipClass } from "@/lib/task-priority-theme";
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

const recentStatusMeta: Record<
  DashboardTaskStatus,
  { status: TaskStatus; labelKey: TKey; tone: string }
> = {
  BACKLOG: { status: "backlog", labelKey: "board.backlog", tone: taskStatusChipClass.backlog },
  IN_PROGRESS: {
    status: "in_progress",
    labelKey: "board.inProgress",
    tone: taskStatusChipClass.in_progress,
  },
  REVIEW: { status: "review", labelKey: "board.review", tone: taskStatusChipClass.review },
  DONE: { status: "done", labelKey: "board.done", tone: taskStatusChipClass.done },
};

const recentPriorityTone: Record<DashboardTaskPriority, string> = {
  LOW: taskPriorityChipClass.low,
  MEDIUM: taskPriorityChipClass.medium,
  URGENT: taskPriorityChipClass.urgent,
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

const sectionSurfaceClass =
  "min-w-0 rounded-2xl border border-border/80 bg-card p-4 shadow-soft sm:p-5";

const sectionLinkClass =
  "text-xs font-medium text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function DashboardSectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

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

  const projectColorById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const project of apiProjects) {
      map.set(project.id, project.color);
    }
    return map;
  }, [apiProjects]);

  const upcomingDeadlines = useMemo(
    () => pickUpcomingDeadlines(workspaceTasks, 5),
    [workspaceTasks],
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
          accent: "brand" as const,
        },
        {
          label: t("dashboard.openTasks"),
          value: data.openTasks,
          icon: ListTodo,
          to: "/app/tasks" as const,
          search: { status: "open" as const },
          ariaKey: "dashboard.viewOpenTasks" as const,
          accent: "info" as const,
        },
        {
          label: t("dashboard.completed"),
          value: data.completedTasks,
          icon: CheckCircle2,
          to: "/app/tasks" as const,
          search: { status: "done" as const },
          ariaKey: "dashboard.viewCompletedTasks" as const,
          accent: "success" as const,
        },
        {
          label: t("dashboard.teamMembers"),
          value: data.teamMembers,
          icon: Users,
          to: "/app/team" as const,
          ariaKey: "dashboard.viewTeamMembers" as const,
          accent: "auxiliary" as const,
        },
      ]
    : [];

  const analyticsCards: {
    labelKey: TKey;
    value: number;
    icon: typeof AlertTriangle;
    ariaKey: TKey;
    tone: AnalyticsMetricTone;
    search: TasksSearch;
  }[] = [
    {
      labelKey: "dashboard.overdue",
      value: taskAnalyticsCounts.overdue,
      icon: AlertTriangle,
      ariaKey: "dashboard.viewOverdueTasks",
      tone: "urgent",
      search: { status: "open", due: "overdue" },
    },
    {
      labelKey: "dashboard.dueSoon",
      value: taskAnalyticsCounts.dueSoon,
      icon: CalendarClock,
      ariaKey: "dashboard.viewDueSoonTasks",
      tone: "review",
      search: { status: "open", due: "soon" },
    },
    {
      labelKey: "dashboard.urgentOpen",
      value: taskAnalyticsCounts.urgentOpen,
      icon: Flame,
      ariaKey: "dashboard.viewUrgentTasks",
      tone: "priorityUrgent",
      search: { status: "open", priority: "urgent" },
    },
    {
      labelKey: "dashboard.unassigned",
      value: taskAnalyticsCounts.unassigned,
      icon: UserX,
      ariaKey: "dashboard.viewUnassignedTasks",
      tone: "muted",
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
              <Button variant="brand" className={CREATE_ACTION_BUTTON_CLASSNAME}>
                <Plus className="size-4" /> {t("common.newProject")}
              </Button>
            </NewProjectDialog>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {isEmptyWorkspace ? (
          <EmptyState
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
                  <Button variant="brand">{t("common.createProject")}</Button>
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
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {stats.map((s) => (
              <StatCard
                key={s.label}
                target={s}
                ariaLabel={t(s.ariaKey)}
                icon={s.icon}
                value={s.value}
                label={s.label}
                accent={s.accent}
              />
            ))}
          </div>
        )}

        <div className="min-w-0">
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
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {analyticsCards.map((card) => (
                <AnalyticsMetricCard
                  key={card.labelKey}
                  to="/app/tasks"
                  search={card.search}
                  ariaLabel={t(card.ariaKey)}
                  icon={card.icon}
                  value={card.value}
                  label={t(card.labelKey)}
                  tone={card.tone}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          <div className={cn(sectionSurfaceClass, "xl:col-span-2")}>
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

          <div className={sectionSurfaceClass}>
            <DashboardSectionHeader
              title={t("dashboard.taskStatus")}
              description={t("dashboard.acrossActiveProjects")}
              className="mb-3"
            />
            {isLoading ? (
              <TaskStatusChartSkeleton />
            ) : isError ? null : (
              <div className="flex min-w-0 flex-col gap-4">
                <ChartContainer
                  config={taskStatusChartConfig}
                  className="mx-auto aspect-auto h-48 w-full max-w-full sm:h-52"
                >
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="statusKey" />} />
                    <Pie
                      data={taskStatusChartData}
                      dataKey="value"
                      nameKey="statusKey"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {taskStatusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="grid min-w-0 gap-2">
                  {taskStatusChartData.map((s) => (
                    <li
                      key={s.statusKey}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2 text-foreground/90">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s.fill }}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">
                          {dashboardStatusLabel(s.statusKey, t)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-muted-foreground">
                        {s.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          <DashboardAiInsightsCard projects={apiProjects} tasks={workspaceTasks} />

          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            <div className={sectionSurfaceClass}>
              <DashboardSectionHeader
                title={t("dashboard.projectProgress")}
                action={
                  <Link to="/app/projects" className={sectionLinkClass}>
                    {t("common.viewAll")}
                  </Link>
                }
              />
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

            <div className={sectionSurfaceClass}>
              <DashboardSectionHeader
                title={t("dashboard.upcomingDeadlines")}
                action={
                  <Link to="/app/tasks" search={{ status: "open" }} className={sectionLinkClass}>
                    {t("common.seeAll")}
                  </Link>
                }
              />
              {tasksLoading ? (
                <UpcomingDeadlinesSkeleton />
              ) : tasksError ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("common.errorServerHint")}
                </p>
              ) : upcomingDeadlines.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("dashboard.noUpcomingDeadlines")}
                </p>
              ) : (
                <ul className="divide-y divide-border/80">
                  {upcomingDeadlines.map((task) => (
                    <UpcomingDeadlineRow
                      key={task.id}
                      task={task}
                      t={t}
                      lang={lang}
                      projectColor={projectColorById.get(task.projectId)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className={sectionSurfaceClass}>
          <DashboardSectionHeader
            title={t("dashboard.recentActivity")}
            action={
              <Link to="/app/tasks" search={{ status: "open" }} className={sectionLinkClass}>
                {t("common.seeAll")}
              </Link>
            }
          />
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
            <ul className="-mx-1 divide-y divide-border/80 sm:mx-0">
              {data?.recentTasks.map((task) => (
                <RecentTaskRow
                  key={task.id}
                  task={task}
                  t={t}
                  lang={lang}
                  projectColor={projectColorById.get(task.project.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function RecentTaskRow({
  task,
  t,
  lang,
  projectColor,
}: {
  task: DashboardRecentTask;
  t: (key: TKey) => string;
  lang: import("@/lib/i18n").Lang;
  projectColor?: string | null;
}) {
  const status = recentStatusMeta[task.status];
  const projectAccent = getProjectAccent({
    id: task.project.id,
    name: task.project.name,
    color: projectColor,
  });
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
        className="flex gap-3 rounded-xl px-2 py-3 text-sm transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:items-center"
      >
        {assigneeOptions.length > 0 ? (
          <AssigneeAvatars
            assignees={assigneeOptions}
            maxVisible={2}
            className="mt-0.5 shrink-0 sm:mt-0"
          />
        ) : (
          <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground sm:mt-0">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {task.key}
            </span>
            <span className="min-w-0 break-words font-medium leading-snug sm:truncate">
              {translateStarterTitle(task.title, lang)}
            </span>
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex max-w-full items-center gap-1.5 truncate">
              <span className={cn("size-2 shrink-0 rounded-full", projectAccent.dot)} aria-hidden />
              <span className="truncate">
                {translateStarterProjectName(task.project.name, lang)}
              </span>
            </span>
            <Badge variant="secondary" className={status.tone + " border-0 capitalize"}>
              <TaskStatusIndicator status={status.status}>{t(status.labelKey)}</TaskStatusIndicator>
            </Badge>
            <Badge variant="secondary" className={recentPriorityTone[task.priority] + " border-0"}>
              {dashboardPriorityLabel(task.priority, t)}
            </Badge>
            <span className="tabular-nums text-muted-foreground/90 sm:hidden">
              {formatUpdatedAt(task.updatedAt, lang)}
            </span>
          </div>
        </div>
        <div className="hidden shrink-0 self-start text-xs tabular-nums text-muted-foreground sm:block sm:self-center">
          {formatUpdatedAt(task.updatedAt, lang)}
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

function formatUpdatedAt(value: string, lang: import("@/lib/i18n").Lang) {
  return new Date(value).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pickUpcomingDeadlines(tasks: TaskApiItem[], limit: number) {
  return tasks
    .filter((task) => task.status !== "DONE" && Boolean(task.dueDate))
    .map((task) => ({
      task,
      dueMs: effectiveDueDate(task.dueDate!).getTime(),
    }))
    .filter((entry) => Number.isFinite(entry.dueMs))
    .sort((a, b) => a.dueMs - b.dueMs)
    .slice(0, limit)
    .map((entry) => entry.task);
}

function dueUrgencyMeta(
  dueDate: string,
  now = new Date(),
): { tone: "destructive" | "warning" | "muted"; hintKey: TKey | null } {
  const due = effectiveDueDate(dueDate);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfter = new Date(startToday);
  startDayAfter.setDate(startDayAfter.getDate() + 2);

  if (due.getTime() < now.getTime()) {
    return { tone: "destructive", hintKey: "dashboard.dueOverdue" };
  }
  if (due.getTime() < startTomorrow.getTime()) {
    return { tone: "warning", hintKey: "dashboard.dueToday" };
  }
  if (due.getTime() < startDayAfter.getTime()) {
    return { tone: "warning", hintKey: "dashboard.dueTomorrow" };
  }
  return { tone: "muted", hintKey: null };
}

function UpcomingDeadlineRow({
  task,
  t,
  lang,
  projectColor,
}: {
  task: TaskApiItem;
  t: (key: TKey) => string;
  lang: import("@/lib/i18n").Lang;
  projectColor?: string | null;
}) {
  const status = recentStatusMeta[task.status];
  const projectAccent = getProjectAccent({
    id: task.project.id,
    name: task.project.name,
    color: projectColor,
  });
  const urgency = task.dueDate
    ? dueUrgencyMeta(task.dueDate)
    : { tone: "muted" as const, hintKey: null };
  const assigneeOptions = task.assignees.map((assignee) => ({
    id: assignee.id,
    name: assignee.name,
    email: assignee.email,
    avatar: initialsFromName(assignee.name),
    avatarUrl: assignee.avatarUrl ?? null,
  }));
  const dueLabel = task.dueDate ? formatDueDateTimeShort(task.dueDate) : "—";

  return (
    <li>
      <Link
        to="/app/tasks"
        search={{ taskId: task.id }}
        aria-label={`${t("dashboard.viewTask")}: ${translateStarterTitle(task.title, lang)}`}
        className="flex gap-3 rounded-xl px-1 py-3 text-sm transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:items-center"
      >
        {assigneeOptions.length > 0 ? (
          <AssigneeAvatars
            assignees={assigneeOptions}
            maxVisible={2}
            className="mt-0.5 shrink-0 sm:mt-0"
          />
        ) : (
          <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground sm:mt-0">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="min-w-0 break-words font-medium leading-snug sm:truncate">
            {translateStarterTitle(task.title, lang)}
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex max-w-full items-center gap-1.5 truncate">
              <span className={cn("size-2 shrink-0 rounded-full", projectAccent.dot)} aria-hidden />
              <span className="truncate">
                {translateStarterProjectName(task.project.name, lang)}
              </span>
            </span>
            <Badge variant="secondary" className={status.tone + " capitalize"}>
              <TaskStatusIndicator status={status.status}>{t(status.labelKey)}</TaskStatusIndicator>
            </Badge>
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular-nums font-medium",
                urgency.tone === "destructive" && "text-destructive",
                urgency.tone === "warning" && "text-warning-foreground",
                urgency.tone === "muted" && "text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3 shrink-0" aria-hidden />
              {dueLabel}
              {urgency.hintKey ? <span className="font-normal">· {t(urgency.hintKey)}</span> : null}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function UpcomingDeadlinesSkeleton() {
  return (
    <div className="space-y-3 py-1">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
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
  const cardBody = (
    <ProjectAccentSurface
      gradient={project.color}
      className="z-1 h-full border-border/50 shadow-none"
      contentClassName="px-4 pb-4 pt-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-snug">
            {translateStarterProjectName(project.name, lang)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("dashboard.projectOpenTotal")
              .replace("{open}", String(project.openTasks))
              .replace("{total}", String(project.totalTasks))}
          </div>
        </div>
        <ProjectStatusIndicator
          status={project.status}
          className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
        >
          {projectStatusLabel(project.status, t)}
        </ProjectStatusIndicator>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className={"project-progress-fill h-full rounded-full bg-gradient-to-r " + project.color}
          style={{ width: project.progress + "%" }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        {project.id ? <ProjectMemberStack projectId={project.id} max={3} /> : null}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {project.progress}%
        </span>
      </div>
    </ProjectAccentSurface>
  );

  if (!project.id) {
    return <div className="min-w-0 rounded-2xl bg-border/60 p-px">{cardBody}</div>;
  }

  return (
    <Link
      to="/app/projects/$projectId"
      params={{ projectId: project.id }}
      aria-label={`${t("dashboard.viewProject")}: ${translateStarterProjectName(project.name, lang)}`}
      className={cn(
        "dashboard-project-card group block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {cardBody}
    </Link>
  );
}

const DASHBOARD_QUICK_ASKS = [
  { ask: "summary", labelKey: AI_ASK_SUGGESTION_KEYS.summary },
  { ask: "attention", labelKey: AI_ASK_SUGGESTION_KEYS.attention },
  { ask: "deadlines", labelKey: AI_ASK_SUGGESTION_KEYS.deadlines },
] as const satisfies ReadonlyArray<{ ask: AiAssistantAsk; labelKey: TKey }>;

function DashboardAiInsightsCard({
  projects,
  tasks,
}: {
  projects: ProjectApiItem[];
  tasks: TaskApiItem[];
}) {
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
  const headline = data ? buildAiPreviewHeadline(data, t) : "";

  return (
    <div
      className={cn(
        sectionSurfaceClass,
        "group flex flex-col xl:col-span-1 transition-[border-color,background-color,box-shadow] duration-200",
        "hover:border-primary/25 hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--brand-ring)_14%,transparent)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <Sparkles className="size-3.5 shrink-0" />
            </span>
            <span className="truncate">{t("dashboard.aiInsights")}</span>
          </div>
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
          <div className="mt-4 min-w-0">
            <AiEntityResponse
              content={headline}
              projects={projects}
              tasks={tasks}
              compact
              className="text-sm font-medium leading-relaxed text-foreground"
            />
          </div>

          {previewRisks.length > 0 ? (
            <div className="mt-4 min-w-0 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 dark:border-amber-400/30 dark:bg-amber-400/[0.08]">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/85">
                <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                {t("ai.risks")}
              </div>
              <ul className="space-y-1.5">
                {previewRisks.map((risk, index) => (
                  <li
                    key={`risk-${index}`}
                    className="min-w-0 text-muted-foreground [line-height:1.5]"
                  >
                    <AiEntityResponse content={risk} projects={projects} tasks={tasks} compact />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {previewActions.length > 0 ? (
            <div className="mt-3.5 min-w-0 rounded-xl border border-border/80 bg-muted/35 p-3 dark:bg-muted/25">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/85">
                <ListChecks className="size-3.5 shrink-0 text-primary" />
                {t("dashboard.aiNextSteps")}
              </div>
              <ol className="list-decimal space-y-1.5 pl-4">
                {previewActions.map((action, index) => (
                  <li
                    key={`action-${index}`}
                    className="min-w-0 pl-1 text-muted-foreground [line-height:1.5]"
                  >
                    <AiEntityResponse content={action} projects={projects} tasks={tasks} compact />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="mt-auto flex min-w-0 flex-col pt-5">
            <div className="min-w-0">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dashboard.quickQuestions")}
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {DASHBOARD_QUICK_ASKS.map(({ ask, labelKey }) => (
                  <Link
                    key={ask}
                    to="/app/ai"
                    search={{ ask }}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium leading-snug text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  >
                    {t(labelKey)}
                  </Link>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              className="mt-3 w-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              asChild
            >
              <Link to="/app/ai">{t("dashboard.openAiAssistant")}</Link>
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function buildAiPreviewHeadline(
  summary: NonNullable<Awaited<ReturnType<typeof fetchWorkspaceAiSummary>>>,
  t: (key: TKey) => string,
) {
  const highlight = summary.highlights.find((item) => item.trim().length > 0)?.trim();
  if (highlight) return highlight;

  if (summary.metrics.overdueTasks > 0) {
    return t("dashboard.aiPreviewOverdue").replace("{count}", String(summary.metrics.overdueTasks));
  }

  if (summary.metrics.urgentTasks > 0) {
    return t("dashboard.aiPreviewUrgent").replace("{count}", String(summary.metrics.urgentTasks));
  }

  const overview = summary.overview.trim();
  if (!overview) return t("dashboard.aiInsightsDescription");
  const firstSentence = overview.split(/(?<=[.!?…])\s+/)[0]?.trim();
  return firstSentence || overview;
}

function AiInsightsSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-8 w-full rounded-lg" />
      <Skeleton className="h-8 w-4/5 rounded-lg" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

function ProjectCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border/80 bg-background/40 p-4">
          <Skeleton className="h-1.5 w-10 rounded-full" />
          <Skeleton className="mt-2 h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-2.5 h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

function StatCardSkeletons() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={cn(cardLinkClass, "pointer-events-none", metricCardStackClass)}>
          <div className={metricIconValueColumnClass}>
            <Skeleton className="size-7 shrink-0 rounded-lg sm:size-9 sm:rounded-xl" />
            <Skeleton className="mt-1.5 h-6 w-12 sm:mt-4 sm:h-9 sm:w-16" />
          </div>
          <Skeleton className="mt-1 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function TaskStatusChartSkeleton() {
  return (
    <div className="mt-1 space-y-3">
      <Skeleton className="mx-auto h-48 w-48 rounded-full sm:h-52 sm:w-52" />
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <Skeleton className="h-3 w-24 max-w-full" />
          <Skeleton className="h-3 w-6" />
        </div>
      ))}
    </div>
  );
}

function RecentTasksSkeleton() {
  return (
    <ul className="divide-y divide-border/80">
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="flex items-start gap-3 px-2 py-3 sm:items-center">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 max-w-full" />
            <Skeleton className="h-3 w-1/2 max-w-full" />
          </div>
          <Skeleton className="hidden h-3 w-20 sm:block" />
        </li>
      ))}
    </ul>
  );
}

const cardLinkClass =
  "surface-lift min-w-0 rounded-2xl border border-border bg-card p-2.5 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5";

const analyticsCardLinkClass =
  "surface-lift min-w-0 rounded-2xl border border-border/60 bg-card/60 p-2.5 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4";

/** Content stack: icon + value share one column axis; label follows the same left edge. */
const metricCardStackClass = "flex flex-col items-start text-left";

/** Icon and value in one centered column so any digit count sits under the icon. */
const metricIconValueColumnClass = "inline-flex max-w-full flex-col items-center";

/**
 * Tabular lining nums keep every value on a stable digit grid (no jump by digit count).
 * Override body font-feature-settings so tnum actually applies.
 */
const metricValueClass =
  "text-center font-semibold leading-none tracking-tight tabular-nums [font-feature-settings:'tnum'_1,'lnum'_1,'cv11'_1,'ss01'_1,'ss03'_1]";

const metricLabelClass = "max-w-full self-start text-left";

const metricIconClass =
  "grid size-7 shrink-0 place-items-center rounded-lg transition sm:size-9 sm:rounded-xl";

type AnalyticsMetricTone = "urgent" | "review" | "priorityUrgent" | "muted";

const analyticsToneClass: Record<
  AnalyticsMetricTone,
  { icon: string; value: string; lift: string }
> = {
  urgent: {
    icon: "bg-red-500/10 text-red-600 group-hover:bg-red-500/15 dark:text-red-400",
    value: "text-foreground",
    lift: "surface-lift-urgent",
  },
  review: {
    icon: "bg-amber-500/15 text-amber-800 group-hover:bg-amber-500/20 dark:text-amber-200",
    value: "text-foreground",
    lift: "surface-lift-review",
  },
  priorityUrgent: {
    icon: "bg-red-500/12 text-red-700 group-hover:bg-red-500/18 dark:text-red-300",
    value: "text-foreground",
    lift: "surface-lift-urgent",
  },
  muted: {
    icon: "bg-slate-500/10 text-slate-600 group-hover:bg-slate-500/15 dark:text-slate-300",
    value: "text-foreground",
    lift: "surface-lift-muted",
  },
};

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
      <div className="mb-4 flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {t("dashboard.taskActivity")}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("dashboard.doneTasksActivityNote")}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div
            className="inline-flex max-w-full rounded-lg border border-border bg-muted/40 p-0.5"
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
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:px-3",
                  period === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(periodLabelKeys[value])}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-sm bg-info" /> {t("dashboard.createdTasks")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-sm bg-success" /> {t("dashboard.doneTasks")}
            </span>
          </div>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-56 w-full rounded-xl sm:h-64" />
      ) : isError ? (
        <p className="flex h-56 items-center justify-center text-sm text-muted-foreground sm:h-64">
          {t("common.errorServerHint")}
        </p>
      ) : !hasData ? (
        <p className="flex h-56 items-center justify-center text-sm text-muted-foreground sm:h-64">
          {t("dashboard.noTasksInPeriod")}
        </p>
      ) : (
        <ChartContainer
          config={{
            created: { label: t("dashboard.createdTasks"), color: "var(--color-info)" },
            done: { label: t("dashboard.doneTasks"), color: "var(--color-success)" },
          }}
          className="aspect-auto h-56 w-full min-w-0 sm:h-64 [&_.recharts-cartesian-grid_line]:stroke-border/80"
        >
          <BarChart
            data={chartData}
            barGap={4}
            barCategoryGap="18%"
            margin={{
              top: 8,
              right: 4,
              left: -18,
              bottom: period === "year" ? 4 : 2,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              minTickGap={4}
              angle={0}
              textAnchor="middle"
              height={period === "month" ? 40 : period === "year" ? 36 : 28}
              tickMargin={6}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: period === "year" ? 9 : period === "month" ? 10 : 11,
              }}
            />
            <YAxis
              allowDecimals={false}
              width={36}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent nameKey="dataKey" />} />
            <Bar
              dataKey="created"
              fill="var(--color-created)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar dataKey="done" fill="var(--color-done)" radius={[4, 4, 0, 0]} maxBarSize={28} />
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
  tone = "muted",
}: {
  to: "/app/tasks";
  search: TasksSearch;
  ariaLabel: string;
  icon: typeof AlertTriangle;
  value: number;
  label: string;
  tone?: AnalyticsMetricTone;
}) {
  const toneStyles = analyticsToneClass[tone];

  return (
    <Link
      to={to}
      search={search}
      aria-label={ariaLabel}
      className={cn("group", metricCardStackClass, analyticsCardLinkClass, toneStyles.lift)}
    >
      <div className={metricIconValueColumnClass}>
        <div className={cn(metricIconClass, toneStyles.icon)}>
          <Icon className="size-3.5 sm:size-4" />
        </div>
        <div
          className={cn(
            metricValueClass,
            "mt-1.5 text-xl sm:mt-3.5 sm:text-[1.75rem]",
            toneStyles.value,
          )}
        >
          {value}
        </div>
      </div>
      <div className={cn(metricLabelClass, "mt-0.5 text-xs leading-snug text-muted-foreground")}>
        {label}
      </div>
    </Link>
  );
}

function AnalyticsCardsSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={cn(analyticsCardLinkClass, "pointer-events-none", metricCardStackClass)}>
          <div className={metricIconValueColumnClass}>
            <Skeleton className="size-7 shrink-0 rounded-lg sm:size-9 sm:rounded-xl" />
            <Skeleton className="mt-1.5 h-6 w-10 sm:mt-3 sm:h-8 sm:w-12" />
          </div>
          <Skeleton className="mt-1 h-3 w-28 sm:mt-2" />
        </div>
      ))}
    </div>
  );
}

type StatCardTarget =
  | { to: "/app/tasks"; search: TasksSearch }
  | { to: "/app/projects"; search: ProjectsSearch }
  | { to: "/app/team"; search?: never };

type StatCardAccent = "brand" | "info" | "success" | "auxiliary";

const statAccentClass: Record<StatCardAccent, { icon: string; lift: string }> = {
  brand: {
    icon: "bg-primary/10 text-primary group-hover:bg-primary/15",
    lift: "surface-lift-brand",
  },
  info: {
    icon: "bg-info/10 text-info group-hover:bg-info/15",
    lift: "surface-lift-info",
  },
  success: {
    icon: "bg-success/10 text-success group-hover:bg-success/15",
    lift: "surface-lift-success",
  },
  auxiliary: {
    icon: "bg-auxiliary/12 text-auxiliary group-hover:bg-auxiliary/18",
    lift: "surface-lift-auxiliary",
  },
};

function StatCard({
  target,
  ariaLabel,
  icon: Icon,
  value,
  label,
  accent = "brand",
}: {
  target: StatCardTarget;
  ariaLabel: string;
  icon: typeof FolderKanban;
  value: number;
  label: string;
  accent?: StatCardAccent;
}) {
  const accentStyles = statAccentClass[accent];
  const content = (
    <>
      <div className={metricIconValueColumnClass}>
        <div className={cn(metricIconClass, accentStyles.icon)}>
          <Icon className="size-3.5 sm:size-4" />
        </div>
        <div className={cn(metricValueClass, "mt-1.5 text-xl sm:mt-4 sm:text-3xl")}>{value}</div>
      </div>
      <div
        className={cn(
          metricLabelClass,
          "mt-0.5 text-xs font-medium leading-snug text-foreground/80 sm:mt-1 sm:font-normal sm:text-muted-foreground",
        )}
      >
        {label}
      </div>
    </>
  );
  const className = cn("group", metricCardStackClass, cardLinkClass, accentStyles.lift);

  if (target.to === "/app/tasks") {
    return (
      <Link to="/app/tasks" search={target.search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  if (target.to === "/app/projects") {
    return (
      <Link to="/app/projects" search={target.search} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link to={target.to} aria-label={ariaLabel} className={className}>
      {content}
    </Link>
  );
}
