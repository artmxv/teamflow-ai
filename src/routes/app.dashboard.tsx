import { useMemo } from "react";
import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { FolderKanban, CheckCircle2, ListTodo, Users, ArrowUpRight, Sparkles } from "lucide-react";
import { members, weeklyVelocity, projectStatusMeta, type ProjectStatus } from "@/lib/mock-data";
import {
  fetchDashboardSummary,
  mapTaskStatusCountsForChart,
  type DashboardRecentTask,
  type DashboardTaskPriority,
  type DashboardTaskStatus,
} from "@/lib/api/dashboard";
import { fetchProjects, type ProjectApiItem, type ProjectApiStatus } from "@/lib/api/projects";
import { Avatar } from "@/components/app/Avatar";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
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

function Dashboard() {
  const { t } = useI18n();
  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
  });
  const {
    data: apiProjects = [],
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

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

  const orionProjectId = useMemo(
    () => apiProjects.find((p) => p.name === "Orion Web App")?.id,
    [apiProjects],
  );

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

  return (
    <AppShell title={t("side.dashboard")}>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.overviewTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.overviewSubtitle")}</p>
        </div>
        <NewProjectDialog>
          <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
            {t("common.newProject")} <ArrowUpRight className="size-4" />
          </Button>
        </NewProjectDialog>
      </div>

      {isLoading ? (
        <StatCardSkeletons />
      ) : isError ? (
        <DashboardErrorState error={error} onRetry={() => void refetch()} />
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

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{t("dashboard.weeklyVelocity")}</h2>
              <p className="text-xs text-muted-foreground">Tasks created vs completed</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary" /> {t("dashboard.completed")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-muted-foreground/40" /> Created
              </span>
            </div>
          </div>
          <ChartContainer
            config={{
              completed: { label: t("dashboard.completed"), color: "var(--color-chart-1)" },
              created: { label: "Created", color: "var(--color-muted-foreground)" },
            }}
            className="h-64 w-full"
          >
            <BarChart data={weeklyVelocity}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="completed" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="created" fill="oklch(0.85 0.01 270)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
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
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-card to-card p-5 shadow-soft xl:col-span-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> {t("dashboard.aiInsights")}
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <Insight
              tone="warn"
              title="Mobile App v3 is slipping"
              body="2 days behind. 3 high-priority tasks are unassigned."
              target={{ to: "/app/tasks", search: { status: "open" } }}
            />
            <Insight
              tone="ok"
              title="Orion Web App is on track"
              body="Velocity is up 18% week-over-week."
              target={
                orionProjectId
                  ? { to: "/app/projects/$projectId", params: { projectId: orionProjectId } }
                  : undefined
              }
            />
            <Insight
              tone="info"
              title="Weekly digest ready"
              body="A standup summary has been drafted for the team."
              target={{ to: "/app/team" }}
            />
          </div>
          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link to="/app/ai">{t("dashboard.openAiAssistant")}</Link>
          </Button>
        </div>

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
                <DashboardProjectCard key={p.id} project={p} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("dashboard.recentActivity")}</h2>
          <Link to="/app/tasks" className="text-xs text-primary hover:underline">
            {t("common.seeAll")}
          </Link>
        </div>
        {isLoading ? (
          <RecentTasksSkeleton />
        ) : isError ? null : data && data.recentTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recent task updates yet. Create or update a task to see activity here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data?.recentTasks.map((task) => (
              <RecentTaskRow key={task.id} task={task} t={t} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function RecentTaskRow({ task, t }: { task: DashboardRecentTask; t: (key: TKey) => string }) {
  const status = recentStatusMeta[task.status];
  const assigneeInitials =
    task.assignee?.avatar ?? (task.assignee ? initialsFromName(task.assignee.name) : null);
  const taskSearch = task.id ? { taskId: task.id } : undefined;

  return (
    <li>
      <Link
        to="/app/tasks"
        search={taskSearch}
        aria-label={`${t("dashboard.viewTask")}: ${task.title}`}
        className="flex items-center gap-3 rounded-lg py-3 text-sm transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {assigneeInitials ? (
          <Avatar id={task.assignee!.id} initials={assigneeInitials} />
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
            <span className="truncate font-medium">{task.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{task.project.name}</span>
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
    color: project.color ?? "from-indigo-500 to-violet-500",
  };
}

function DashboardProjectCard({
  project,
  t,
}: {
  project: DashboardProjectCard;
  t: (key: TKey) => string;
}) {
  const meta = projectStatusMeta[project.status];
  const cardBody = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <div className={"h-1.5 w-10 rounded-full bg-gradient-to-r " + project.color} />
          <div className="mt-2 text-sm font-semibold">{project.name}</div>
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
      aria-label={`${t("dashboard.viewProject")}: ${project.name}`}
      className="group block rounded-xl border border-border p-4 transition hover:border-primary/30 hover:bg-accent/30"
    >
      {cardBody}
    </Link>
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

function DashboardErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-soft">
      <h3 className="text-base font-semibold">Dashboard could not load</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ?? "Check that the backend is running and try again."}
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

const cardLinkClass =
  "rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  if (to === "/app/tasks" && search && (search.status === "open" || search.status === "done")) {
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

type InsightTarget =
  | { to: "/app/tasks"; search?: { status: "done" | "open" } }
  | { to: "/app/team" }
  | { to: "/app/projects/$projectId"; params: { projectId: string } };

function Insight({
  tone,
  title,
  body,
  target,
}: {
  tone: "warn" | "ok" | "info";
  title: string;
  body: string;
  target?: InsightTarget;
}) {
  const { t } = useI18n();
  const toneClass = {
    warn: "bg-warning/15 text-warning-foreground",
    ok: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  }[tone];
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={
            "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " + toneClass
          }
        >
          {tone === "warn"
            ? t("dashboard.insightAtRisk")
            : tone === "ok"
              ? t("dashboard.insightOnTrack")
              : t("dashboard.insightFyi")}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </>
  );

  const linkClass =
    "block rounded-xl border border-border bg-card p-3 transition hover:border-primary/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (!target) {
    return <div className="rounded-xl border border-border bg-card p-3">{content}</div>;
  }

  if (target.to === "/app/tasks") {
    return (
      <Link to="/app/tasks" search={target.search} className={linkClass}>
        {content}
      </Link>
    );
  }

  if (target.to === "/app/team") {
    return (
      <Link to="/app/team" className={linkClass}>
        {content}
      </Link>
    );
  }

  return (
    <Link to="/app/projects/$projectId" params={target.params} className={linkClass}>
      {content}
    </Link>
  );
}
