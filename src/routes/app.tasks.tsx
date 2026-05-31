import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { tasks as allTasks, getMember, projects, type Task, type TaskStatus, type Priority } from "@/lib/mock-data";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { Avatar } from "@/components/app/Avatar";
import { NewTaskDialog } from "@/components/app/QuickActionDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MessageSquare, Paperclip, Calendar } from "lucide-react";

export const Route = createFileRoute("/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — TeamFlow AI" }] }),
  component: TasksPage,
});

const statusMeta: Record<TaskStatus, { label: string; tone: string }> = {
  backlog: { label: "Backlog", tone: "bg-muted text-muted-foreground" },
  todo: { label: "Todo", tone: "bg-info/15 text-info" },
  in_progress: { label: "In progress", tone: "bg-primary/15 text-primary" },
  review: { label: "Review", tone: "bg-warning/20 text-warning-foreground" },
  done: { label: "Done", tone: "bg-success/15 text-success" },
};
const priorityMeta: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/20 text-warning-foreground",
  urgent: "bg-destructive/15 text-destructive",
};

function TasksPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [selected, setSelected] = useState<Task | null>(null);
  const [taskList, setTaskList] = useState(allTasks);

  const filtered = useMemo(
    () =>
      taskList.filter(
        (t) =>
          (status === "all" || t.status === status) &&
          (priority === "all" || t.priority === priority) &&
          (q === "" || t.title.toLowerCase().includes(q.toLowerCase()) || t.key.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, status, priority, taskList],
  );

  return (
    <AppShell title="Tasks">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All tasks</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} tasks across {projects.length} projects</p>
        </div>
        <NewTaskDialog onCreate={(task) => setTaskList((current) => [task, ...current])}>
          <Button size="sm" className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
            <Plus className="size-4" /> New task
          </Button>
        </NewTaskDialog>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill active={status === "all"} onClick={() => setStatus("all")}>All status</Pill>
          {(Object.keys(statusMeta) as TaskStatus[]).map((s) => (
            <Pill key={s} active={status === s} onClick={() => setStatus(s)}>{statusMeta[s].label}</Pill>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Pill active={priority === "all"} onClick={() => setPriority("all")}>All priority</Pill>
          {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
            <Pill key={p} active={priority === p} onClick={() => setPriority(p)}>{p}</Pill>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="hidden grid-cols-[1fr_120px_120px_140px_120px_120px] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div>Task</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Assignee</div>
          <div>Due</div>
          <div className="text-right">Activity</div>
        </div>
        <ul className="divide-y divide-border">
          {filtered.map((t) => {
            const assignee = t.assigneeId ? getMember(t.assigneeId) : null;
            const project = projects.find((p) => p.id === t.projectId);
            return (
              <li
                key={t.id}
                onClick={() => setSelected(t)}
                className="grid cursor-pointer grid-cols-2 gap-3 px-4 py-3 text-sm transition hover:bg-muted/30 md:grid-cols-[1fr_120px_120px_140px_120px_120px]"
              >
                <div className="col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{t.key}</span>
                    <span className="font-medium">{t.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{project?.name}</span>
                    {t.labels.slice(0, 2).map((l) => (
                      <Badge key={l} variant="secondary" className="h-4 rounded-md px-1.5 text-[10px] font-normal">{l}</Badge>
                    ))}
                  </div>
                </div>
                <div><span className={"inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " + statusMeta[t.status].tone}>{statusMeta[t.status].label}</span></div>
                <div><span className={"inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold capitalize " + priorityMeta[t.priority]}>{t.priority}</span></div>
                <div className="flex items-center gap-2">
                  {assignee ? (<><Avatar id={assignee.id} initials={assignee.avatar} size="sm" /><span className="truncate text-xs">{assignee.name}</span></>) : <span className="text-xs text-muted-foreground">—</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" /> {t.dueDate ?? "—"}
                </div>
                <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{t.comments.length}</span>
                  <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" />{t.attachments.length}</span>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">No tasks match your filters.</li>
          )}
        </ul>
      </div>

      <TaskDrawer task={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </AppShell>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-2.5 py-1 text-xs capitalize transition " +
        (active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
