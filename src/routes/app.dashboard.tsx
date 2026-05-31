import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import {
  FolderKanban,
  CheckCircle2,
  ListTodo,
  Users,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  projects,
  activity,
  members,
  getMember,
  weeklyVelocity,
  taskStatusCounts,
  projectStatusMeta,
} from "@/lib/mock-data";
import { Avatar, AvatarStack } from "@/components/app/Avatar";
import { NewProjectDialog } from "@/components/app/QuickActionDialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
} from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TeamFlow AI" }] }),
  component: Dashboard,
});

const initialsMap = Object.fromEntries(members.map((m) => [m.id, m.avatar]));

function Dashboard() {
  const stats = [
    { label: "Active projects", value: projects.filter((p) => p.status === "active").length, icon: FolderKanban, trend: "+2" },
    { label: "Open tasks", value: 68, icon: ListTodo, trend: "+12" },
    { label: "Completed", value: 142, icon: CheckCircle2, trend: "+27" },
    { label: "Team members", value: members.length, icon: Users, trend: "+1" },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good morning, Alex</h1>
          <p className="text-sm text-muted-foreground">
            Here's what's moving across your workspace today.
          </p>
        </div>
        <NewProjectDialog>
          <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
            New project <ArrowUpRight className="size-4" />
          </Button>
        </NewProjectDialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                <s.icon className="size-4" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                <TrendingUp className="size-3" /> {s.trend}
              </span>
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-tight">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Weekly velocity</h2>
              <p className="text-xs text-muted-foreground">Tasks created vs completed</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" /> Completed</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-muted-foreground/40" /> Created</span>
            </div>
          </div>
          <ChartContainer
            config={{
              completed: { label: "Completed", color: "var(--color-chart-1)" },
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
          <h2 className="text-base font-semibold">Task status</h2>
          <p className="text-xs text-muted-foreground">Across all active projects</p>
          <ChartContainer config={{}} className="mx-auto h-56 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={taskStatusCounts} dataKey="value" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {taskStatusCounts.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="space-y-1.5 text-xs">
            {taskStatusCounts.map((s) => (
              <li key={s.status} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: s.fill }} />
                  {s.status}
                </span>
                <span className="font-medium text-muted-foreground">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-card to-card p-5 shadow-soft xl:col-span-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> AI insights
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
            <h2 className="text-base font-semibold">Project progress</h2>
            <Link to="/app/projects" className="text-xs text-primary hover:underline">View all</Link>
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
                      <div className="text-xs text-muted-foreground">{p.openTasks} open · {p.totalTasks} total</div>
                    </div>
                    <Badge variant="secondary" className={meta.className + " border-0"}>{meta.label}</Badge>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={"h-full rounded-full bg-gradient-to-r " + p.color} style={{ width: p.progress + "%" }} />
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
          <h2 className="text-base font-semibold">Recent activity</h2>
          <Link to="/app/tasks" className="text-xs text-primary hover:underline">See all</Link>
        </div>
        <ul className="divide-y divide-border">
          {activity.map((a) => {
            const m = getMember(a.who);
            return (
              <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
                {m && <Avatar id={m.id} initials={m.avatar} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{m?.name}</span>{" "}
                    <span className="text-muted-foreground">{a.action}</span>{" "}
                    <span className="font-medium">{a.target}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{a.project}</div>
                </div>
                <div className="text-xs text-muted-foreground">{a.at}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}

function Insight({ tone, title, body }: { tone: "warn" | "ok" | "info"; title: string; body: string }) {
  const toneClass = {
    warn: "bg-warning/15 text-warning-foreground",
    ok: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={"inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " + toneClass}>
          {tone === "warn" ? "At risk" : tone === "ok" ? "On track" : "FYI"}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
