import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { type Task, type TaskStatus, type Priority } from "@/lib/mock-data";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { Avatar } from "@/components/app/Avatar";
import { NewTaskDialog, type TaskFormValues } from "@/components/app/QuickActionDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createTask,
  fetchTasks,
  taskPriorityToApi,
  taskStatusToApi,
  type TaskApiItem,
  type TaskApiPriority,
  type TaskApiStatus,
} from "@/lib/api/tasks";
import { useI18n, type TKey } from "@/lib/i18n";
import { Search, Plus, MessageSquare, Paperclip, Calendar } from "lucide-react";

export const Route = createFileRoute("/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — TeamFlow AI" }] }),
  component: TasksPage,
});

const statusMeta: Record<TaskStatus, { labelKey: TKey; tone: string }> = {
  backlog: { labelKey: "board.backlog", tone: "bg-muted text-muted-foreground" },
  todo: { labelKey: "tasks.todo", tone: "bg-info/15 text-info" },
  in_progress: { labelKey: "tasks.inProgress", tone: "bg-primary/15 text-primary" },
  review: { labelKey: "tasks.review", tone: "bg-warning/20 text-warning-foreground" },
  done: { labelKey: "tasks.done", tone: "bg-success/15 text-success" },
};
const priorityMeta: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/20 text-warning-foreground",
  urgent: "bg-destructive/15 text-destructive",
};

type TaskRow = Task & {
  projectName: string;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  commentsCount: number;
  checklistTotal: number;
  checklistDone: number;
  attachmentsCount: number;
};

const apiStatusMap: Record<TaskApiStatus, TaskStatus> = {
  BACKLOG: "backlog",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
};

const apiPriorityMap: Record<TaskApiPriority, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

function TasksPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [selected, setSelected] = useState<Task | null>(null);
  const {
    data: apiTasks = [],
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Task could not be created",
      );
    },
  });
  const projectId = apiTasks[0]?.projectId;
  const taskList = useMemo(() => apiTasks.map(mapApiTaskToRow), [apiTasks]);

  const filtered = useMemo(
    () =>
      taskList.filter(
        (task) =>
          (status === "all" || task.status === status) &&
          (priority === "all" || task.priority === priority) &&
          (q === "" || task.title.toLowerCase().includes(q.toLowerCase()) || task.key.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, status, priority, taskList],
  );

  async function handleCreateTask(values: TaskFormValues) {
    if (!projectId) {
      toast.error("A project is required. Load tasks from the API or seed the database first.");
      throw new Error("Project is required.");
    }

    await createTaskMutation.mutateAsync({
      projectId,
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      status: taskStatusToApi[values.status],
      priority: taskPriorityToApi[values.priority],
      assigneeId: values.assigneeId || null,
      dueDate: values.dueDate || null,
    });
  }

  return (
    <AppShell title={t("tasks.tasks")}>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("tasks.tasks")}</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} tasks</p>
        </div>
        <NewTaskDialog isSubmitting={createTaskMutation.isPending} onSubmit={handleCreateTask}>
          <Button size="sm" className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
            <Plus className="size-4" /> {t("common.newTask")}
          </Button>
        </NewTaskDialog>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tasks.searchTasks")} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill active={status === "all"} onClick={() => setStatus("all")}>{t("tasks.allStatus")}</Pill>
          {(Object.keys(statusMeta) as TaskStatus[]).map((s) => (
            <Pill key={s} active={status === s} onClick={() => setStatus(s)}>{t(statusMeta[s].labelKey)}</Pill>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Pill active={priority === "all"} onClick={() => setPriority("all")}>{t("tasks.allPriorities")}</Pill>
          {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
            <Pill key={p} active={priority === p} onClick={() => setPriority(p)}>{p}</Pill>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="hidden grid-cols-[1fr_120px_120px_140px_120px_120px] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div>{t("tasks.task")}</div>
          <div>{t("tasks.status")}</div>
          <div>{t("tasks.priority")}</div>
          <div>{t("tasks.assignee")}</div>
          <div>{t("tasks.due")}</div>
          <div className="text-right">Activity</div>
        </div>
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((task) => (
                <li
                  key={task.id}
                  onClick={() => setSelected(task)}
                  className="grid cursor-pointer grid-cols-2 gap-3 px-4 py-3 text-sm transition hover:bg-muted/30 md:grid-cols-[1fr_120px_120px_140px_120px_120px]"
                >
                  <div className="col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{task.key}</span>
                      <span className="font-medium">{task.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{task.projectName}</span>
                      {task.labels.slice(0, 2).map((label) => (
                        <Badge key={label} variant="secondary" className="h-4 rounded-md px-1.5 text-[10px] font-normal">{label}</Badge>
                      ))}
                    </div>
                  </div>
                  <div><span className={"inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " + statusMeta[task.status].tone}>{t(statusMeta[task.status].labelKey)}</span></div>
                  <div><span className={"inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold capitalize " + priorityMeta[task.priority]}>{task.priority}</span></div>
                  <div className="flex items-center gap-2">
                    {task.assigneeName ? (<><Avatar id={task.assigneeId ?? task.id} initials={task.assigneeAvatar ?? initials(task.assigneeName)} size="sm" /><span className="truncate text-xs">{task.assigneeName}</span></>) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" /> {task.dueDate ?? "—"}
                  </div>
                  <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{task.commentsCount}</span>
                    <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" />{task.attachmentsCount}</span>
                  </div>
                </li>
              ))}
            {filtered.length === 0 && (
              <li className="px-4 py-12 text-center text-sm text-muted-foreground">No tasks match your filters.</li>
            )}
          </ul>
        )}
      </div>

      <TaskDrawer task={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </AppShell>
  );
}

function mapApiTaskToRow(task: TaskApiItem): TaskRow {
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    description: task.description ?? "",
    status: apiStatusMap[task.status],
    priority: apiPriorityMap[task.priority],
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    dueDate: formatDate(task.dueDate),
    labels: [],
    comments: [],
    checklist: [],
    activity: [],
    attachments: [],
    projectName: task.project.name,
    assigneeName: task.assignee?.name ?? null,
    assigneeAvatar: task.assignee?.avatar ?? null,
    commentsCount: task.commentsCount,
    checklistTotal: task.checklistTotal,
    checklistDone: task.checklistDone,
    attachmentsCount: task.attachmentsCount,
  };
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function LoadingRows() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="grid grid-cols-2 gap-3 px-4 py-3 md:grid-cols-[1fr_120px_120px_140px_120px_120px]">
          <div className="col-span-2 space-y-2 md:col-span-1">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-5 w-16 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="px-4 py-12 text-center">
      <h3 className="text-base font-semibold">Tasks could not load</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ?? "Check that the backend is running and try again."}
      </p>
      <Button onClick={onRetry} className="mt-5 bg-gradient-brand text-white shadow-glow hover:opacity-95">
        Retry
      </Button>
    </div>
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
