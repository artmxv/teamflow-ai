import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { FolderKanban, CheckCircle2, ListTodo, Users, ArrowUpRight, Sparkles } from "lucide-react";
import { projects, members, weeklyVelocity, projectStatusMeta } from "@/lib/mock-data";
import {
  fetchDashboardSummary,
  mapTaskStatusCountsForChart,
  type DashboardRecentTask,
  type DashboardTaskPriority,
  type DashboardTaskStatus,
} from "@/lib/api/dashboard";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n, type TKey } from "@/lib/i18n";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Pie, PieChart } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Dashboard — TeamFlow AI" }] }),
  component: Dashboard,
});

const initialsMap = Object.fromEntries(members.map((m) => [m.id, m.avatar]));

const recentStatusMeta: Record<DashboardTaskStatus, { labelKey: TKey; tone: string }> = {
  BACKLOG: { labelKey: "board.backlog", tone: "bg-muted text-muted-foreground" },
  TODO: { labelKey: "tasks.todo", tone: "bg-info/15 text-info" },
  IN_PROGRESS: { labelKey: "tasks.inProgress", tone: "bg-primary/15 text-primary" },
  REVIEW: { labelKey: "tasks.review", tone: "bg-warning/20 text-warning-foreground" },
  DONE: { labelKey: "tasks.done", tone: "bg-success/15 text-success" },
};

const recentPriorityTone: Record<DashboardTaskPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-info/15 text-info",
  HIGH: "bg-warning/20 text-warning-foreground",
  URGENT: "bg-destructive/15 text-destructive",
};

const recentPriorityLabel: Record<DashboardTaskPriority, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

function Dashboard() {
  const { t } = useI18n();
  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
  });

  const taskStatusChartData = useMemo(
    () => (data ? mapTaskStatusCountsForChart(data.taskStatusCounts) : []),
    [data],
  );

  const stats = data
    ? [
        { label: t("dashboard.activeProjects"), value: data.activeProjects, icon: FolderKanban },
        { label: t("dashboard.openTasks"), value: data.openTasks, icon: ListTodo },
        { label: t("dashboard.completed"), value: data.completedTasks, icon: CheckCircle2 },
        { label: t("dashboard.teamMembers"), value: data.teamMembers, icon: Users },
      ]
    : [];

  return (
    <AppShell title={t("side.dashboard")}>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.goodMorning")}</h1>
          <p className="text-sm text-muted-foreground">
            Here's what's moving across your workspace today.
          </p>
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
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                <s.icon className="size-4" />
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
            </div>
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
          <p className="text-xs text-muted-foreground">Across all active projects</p>
          {isLoading ? (
            <TaskStatusChartSkeleton />
          ) : isError ? null : (
            <>
              <ChartContainer config={{}} className="mx-auto h-56 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={taskStatusChartData}
                    dataKey="value"
                    nameKey="status"
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
                  <li key={s.status} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: s.fill }} />
                      {s.status}
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
            />
            <Insight
              tone="ok"
              title="Orion Web App is on track"
              body="Velocity is up 18% week-over-week."
            />
            <Insight
              tone="info"
              title="Weekly digest ready"
              body="A standup summary has been drafted for the team."
            />
          </div>
          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link to="/app/ai">Open AI assistant</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("dashboard.projectProgress")}</h2>
            <Link to="/app/projects" className="text-xs text-primary hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.slice(0, 4).map((p) => {
              const meta = projectStatusMeta[p.status];
              return (
                <div key={p.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={"h-1.5 w-10 rounded-full bg-gradient-to-r " + p.color} />
                      <div className="mt-2 text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.openTasks} open · {p.totalTasks} total
                      </div>
                    </div>
                    <Badge variant="secondary" className={meta.className + " border-0"}>
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={"h-full rounded-full bg-gradient-to-r " + p.color}
                      style={{ width: p.progress + "%" }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <AvatarStack ids={p.members} initialsMap={initialsMap} size="sm" />
                    <span className="text-xs text-muted-foreground">{p.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
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

  return (
    <li className="flex items-center gap-3 py-3 text-sm">
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
          <Badge
            variant="secondary"
            className={recentPriorityTone[task.priority] + " border-0 capitalize"}
          >
            {recentPriorityLabel[task.priority]}
          </Badge>
        </div>
      </div>
      <div className="shrink-0 text-xs text-muted-foreground">
        {formatUpdatedAt(task.updatedAt)}
      </div>
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

function Insight({
  tone,
  title,
  body,
}: {
  tone: "warn" | "ok" | "info";
  title: string;
  body: string;
}) {
  const toneClass = {
    warn: "bg-warning/15 text-warning-foreground",
    ok: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span
          className={
            "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " + toneClass
          }
        >
          {tone === "warn" ? "At risk" : tone === "ok" ? "On track" : "FYI"}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
