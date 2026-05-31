import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { tasks as allTasks, statusColumns, type Task, type TaskStatus } from "@/lib/mock-data";
import { TaskCard } from "@/components/app/TaskCard";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { Button } from "@/components/ui/button";
import { Filter, Plus } from "lucide-react";

export const Route = createFileRoute("/app/board")({
  head: () => ({ meta: [{ title: "Kanban — TeamFlow AI" }] }),
  component: Board,
});

function Board() {
  const [selected, setSelected] = useState<Task | null>(null);

  return (
    <AppShell title="Kanban board">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sprint 24 board</h1>
          <p className="text-sm text-muted-foreground">Orion Web App · 12 tasks active</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="size-4" /> Filter</Button>
          <Button size="sm" className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
            <Plus className="size-4" /> New task
          </Button>
        </div>
      </div>

      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-4">
        {statusColumns.map((col) => {
          const colTasks = allTasks.filter((t) => t.status === col.key);
          return (
            <Column key={col.key} title={col.title} status={col.key} count={colTasks.length}>
              {colTasks.map((t) => (
                <TaskCard key={t.id} task={t} onOpen={setSelected} />
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Drop tasks here
                </div>
              )}
              <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground">
                <Plus className="size-3.5" /> Add task
              </button>
            </Column>
          );
        })}
      </div>

      <TaskDrawer task={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </AppShell>
  );
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
