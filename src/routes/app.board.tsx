import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import {
  members,
  tasks as allTasks,
  statusColumns,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/lib/mock-data";
import { TaskCard } from "@/components/app/TaskCard";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { NewTaskDialog } from "@/components/app/QuickActionDialogs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, type TKey } from "@/lib/i18n";
import { Filter, Plus } from "lucide-react";

export const Route = createFileRoute("/app/board")({
  head: () => ({ meta: [{ title: "Kanban — TeamFlow AI" }] }),
  component: Board,
});

function Board() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Task | null>(null);
  const [taskList, setTaskList] = useState(allTasks);
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [assignee, setAssignee] = useState<string>("all");

  const filteredTasks = taskList.filter(
    (task) =>
      (priority === "all" || task.priority === priority) &&
      (assignee === "all" || task.assigneeId === assignee),
  );

  return (
    <AppShell title={t("side.kanban")}>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sprint 24 board</h1>
          <p className="text-sm text-muted-foreground">Orion Web App · 12 tasks active</p>
        </div>
        <div className="flex gap-2">
          <NewTaskDialog onCreate={(task) => setTaskList((current) => [task, ...current])}>
            <Button size="sm" className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
              <Plus className="size-4" /> {t("common.newTask")}
            </Button>
          </NewTaskDialog>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4 text-muted-foreground" /> Filters
        </div>
        <div className="grid gap-2 sm:ml-auto sm:grid-cols-3">
          <Select value={priority} onValueChange={(value) => setPriority(value as Priority | "all")}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t("tasks.priority")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allPriorities")}</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("tasks.assignee")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.assignee")}</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPriority("all");
              setAssignee("all");
            }}
          >
            {t("common.clearFilters")}
          </Button>
        </div>
      </div>

      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-4">
        {statusColumns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.key);
          return (
            <Column key={col.key} title={statusLabel(col.key, t)} status={col.key} count={colTasks.length}>
              {colTasks.map((t) => (
                <TaskCard key={t.id} task={t} onOpen={setSelected} />
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Drop tasks here
                </div>
              )}
              <NewTaskDialog
                initialStatus={col.key}
                onCreate={(task) => setTaskList((current) => [task, ...current])}
              >
                <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground">
                  <Plus className="size-3.5" /> {t("board.addNewCard")}
                </button>
              </NewTaskDialog>
            </Column>
          );
        })}
      </div>

      <TaskDrawer task={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </AppShell>
  );
}

function statusLabel(status: TaskStatus, t: (key: TKey) => string) {
  const labels: Record<TaskStatus, TKey> = {
    backlog: "board.backlog",
    todo: "board.todo",
    in_progress: "board.inProgress",
    review: "board.review",
    done: "board.done",
  };
  return t(labels[status]);
}

function Column({
  title,
  status,
  count,
  children,
}: {
  title: string;
  status: TaskStatus;
  count: number;
  children: React.ReactNode;
}) {
  const tone: Record<TaskStatus, string> = {
    backlog: "bg-muted-foreground/50",
    todo: "bg-info",
    in_progress: "bg-primary",
    review: "bg-warning",
    done: "bg-success",
  };
  return (
    <div className="flex w-80 shrink-0 flex-col gap-3 rounded-2xl bg-muted/40 p-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={"size-2 rounded-full " + tone[status]} />
          {title}
          <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-soft">
            {count}
          </span>
        </div>
        <button className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground">
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
