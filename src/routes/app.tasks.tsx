import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
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
  deleteTask,
  fetchTasks,
  taskPriorityToApi,
  taskStatusToApi,
  updateTask,
  type TaskApiItem,
  type TaskApiPriority,
  type TaskApiStatus,
} from "@/lib/api/tasks";
import { fetchProjects } from "@/lib/api/projects";
import { useI18n, type TKey } from "@/lib/i18n";
import {
  Search,
  Plus,
  MessageSquare,
  Paperclip,
  Calendar,
  ListTodo,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { buildAssigneeOptions, resolveTaskAssignee } from "@/lib/assignee-options";
import { cycleTaskSort, sortTasks, type TaskSortField, type TaskSortState } from "@/lib/task-sort";
import { taskStatusChipClass } from "@/lib/task-status-theme";
import { cn } from "@/lib/utils";
import {
  taskMatchesUrlAnalyticsFilters,
  type TasksUrlAnalyticsFilters,
  type TasksUrlAssigneeFilter,
  type TasksUrlDue,
  type TasksUrlPriorityFilter,
} from "@/lib/dashboard-analytics";

export type TasksUrlStatus = "done" | "open";

export type TasksSearch = {
  taskId?: string;
  status?: TasksUrlStatus;
  due?: TasksUrlDue;
  priority?: TasksUrlPriorityFilter;
  assignee?: TasksUrlAssigneeFilter;
};

function parseTasksUrlStatus(value: unknown): TasksUrlStatus | undefined {
  return value === "done" || value === "open" ? value : undefined;
}

function parseTasksUrlDue(value: unknown): TasksUrlDue | undefined {
  return value === "overdue" || value === "soon" ? value : undefined;
}

function parseTasksUrlPriority(value: unknown): TasksUrlPriorityFilter | undefined {
  return value === "high" ? value : undefined;
}

function parseTasksUrlAssignee(value: unknown): TasksUrlAssigneeFilter | undefined {
  return value === "unassigned" ? value : undefined;
}

export type TaskListStatusFilter = TaskStatus | "all" | "open";

export function taskListStatusFromUrl(status?: TasksUrlStatus): TaskListStatusFilter {
  if (status === "done") return "done";
  if (status === "open") return "open";
  return "all";
}

export function tasksUrlStatusFromFilter(filter: TaskListStatusFilter): TasksUrlStatus | undefined {
  if (filter === "done") return "done";
  if (filter === "open") return "open";
  return undefined;
}

function taskMatchesStatusFilter(task: TaskRow, filter: TaskListStatusFilter) {
  if (filter === "all") return true;
  if (filter === "open") return task.status !== "done";
  return task.status === filter;
}

export const Route = createFileRoute("/app/tasks")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    taskId:
      typeof search.taskId === "string" && search.taskId.length > 0 ? search.taskId : undefined,
    status: parseTasksUrlStatus(search.status),
    due: parseTasksUrlDue(search.due),
    priority: parseTasksUrlPriority(search.priority),
    assignee: parseTasksUrlAssignee(search.assignee),
  }),
  head: () => ({ meta: [{ title: "Tasks — TeamFlow AI" }] }),
  component: TasksPage,
});

const statusMeta: Record<TaskStatus, { labelKey: TKey; tone: string }> = {
  backlog: { labelKey: "board.backlog", tone: taskStatusChipClass.backlog },
  todo: { labelKey: "board.todo", tone: taskStatusChipClass.todo },
  in_progress: { labelKey: "board.inProgress", tone: taskStatusChipClass.in_progress },
  review: { labelKey: "board.review", tone: taskStatusChipClass.review },
  done: { labelKey: "board.done", tone: taskStatusChipClass.done },
};
const priorityMeta: Record<Priority, { labelKey: TKey; tone: string }> = {
  low: { labelKey: "tasks.priorityLow", tone: "bg-muted text-muted-foreground" },
  medium: { labelKey: "tasks.priorityMedium", tone: "bg-info/15 text-info" },
  high: { labelKey: "tasks.priorityHigh", tone: "bg-warning/20 text-warning-foreground" },
  urgent: { labelKey: "tasks.priorityUrgent", tone: "bg-destructive/15 text-destructive" },
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
  const urlSearch = Route.useSearch();
  const {
    taskId: taskIdFromUrl,
    status: statusFromUrl,
    due: dueFromUrl,
    priority: priorityFromUrl,
    assignee: assigneeFromUrl,
  } = urlSearch;
  const urlAnalyticsFilters = useMemo(
    (): TasksUrlAnalyticsFilters => ({
      due: dueFromUrl,
      priority: priorityFromUrl,
      assignee: assigneeFromUrl,
    }),
    [dueFromUrl, priorityFromUrl, assigneeFromUrl],
  );
  const hasUrlAnalyticsFilters = Boolean(dueFromUrl || priorityFromUrl || assigneeFromUrl);
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskListStatusFilter>(() =>
    taskListStatusFromUrl(statusFromUrl),
  );
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [sort, setSort] = useState<TaskSortState>(null);
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
  const { data: apiProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });
  const projectOptions = useMemo(
    () => apiProjects.map((project) => ({ id: project.id, name: project.name })),
    [apiProjects],
  );
  const hasAccessibleProjects = projectOptions.length > 0;
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
  const updateAssigneeMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: {
        assigneeId: string | null;
        dueDate: string | null;
        status: TaskApiStatus;
        priority: TaskApiPriority;
      };
    }) => updateTask(id, input),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelected((prev) => {
        if (!prev || prev.id !== updated.id) return prev;
        return mapApiTaskToRow(updated);
      });
      setSelected(null);
      toast.success("Task updated");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Task could not be updated",
      );
    },
  });
  const assigneeOptions = useMemo(() => buildAssigneeOptions(apiTasks), [apiTasks]);
  const selectedAssignee = useMemo(
    () => (selected ? resolveTaskAssignee(selected.assigneeId, apiTasks, selected.id) : null),
    [selected, apiTasks],
  );
  const taskList = useMemo(() => apiTasks.map(mapApiTaskToRow), [apiTasks]);

  useEffect(() => {
    setStatus(taskListStatusFromUrl(statusFromUrl));
  }, [statusFromUrl]);

  function updateUrlSearch(patch: Partial<TasksSearch>) {
    void navigate({
      search: {
        taskId: patch.taskId !== undefined ? patch.taskId : urlSearch.taskId,
        status: patch.status !== undefined ? patch.status : urlSearch.status,
        due: patch.due !== undefined ? patch.due : urlSearch.due,
        priority: patch.priority !== undefined ? patch.priority : urlSearch.priority,
        assignee: patch.assignee !== undefined ? patch.assignee : urlSearch.assignee,
      },
      replace: true,
    });
  }

  function setStatusFilter(next: TaskListStatusFilter) {
    setStatus(next);
    updateUrlSearch({ status: tasksUrlStatusFromFilter(next) });
  }

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelected(null);
      if (taskIdFromUrl) {
        updateUrlSearch({ taskId: undefined });
      }
      toast.success("Task deleted");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Task could not be deleted",
      );
    },
  });

  useEffect(() => {
    if (!taskIdFromUrl || isLoading) return;
    const task = taskList.find((item) => item.id === taskIdFromUrl);
    if (task) {
      setSelected(task);
      return;
    }
    if (taskList.length > 0) {
      updateUrlSearch({ taskId: undefined });
    }
  }, [taskIdFromUrl, taskList, isLoading]);

  function handleDrawerOpenChange(open: boolean) {
    if (!open) {
      setSelected(null);
      if (taskIdFromUrl) {
        updateUrlSearch({ taskId: undefined });
      }
    }
  }

  const filtered = useMemo(
    () =>
      taskList.filter((task) => {
        if (!taskMatchesStatusFilter(task, status)) return false;
        if (priority !== "all" && task.priority !== priority) return false;
        if (
          hasUrlAnalyticsFilters &&
          !taskMatchesUrlAnalyticsFilters(taskRowToAnalyticsRecord(task), urlAnalyticsFilters)
        ) {
          return false;
        }
        if (q === "") return true;
        const query = q.toLowerCase();
        return task.title.toLowerCase().includes(query) || task.key.toLowerCase().includes(query);
      }),
    [q, status, priority, taskList, hasUrlAnalyticsFilters, urlAnalyticsFilters],
  );
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);
  const isTrulyEmpty = taskList.length === 0;

  function clearFilters() {
    setQ("");
    setStatus("all");
    setPriority("all");
    updateUrlSearch({
      status: undefined,
      taskId: undefined,
      due: undefined,
      priority: undefined,
      assignee: undefined,
    });
  }

  function handleSort(field: TaskSortField) {
    setSort((current) => cycleTaskSort(current, field));
  }

  async function handleCreateTask(values: TaskFormValues) {
    const targetProjectId = values.projectId ?? projectOptions[0]?.id;
    if (!targetProjectId) {
      toast.error(t("tasks.noAccessibleProjects"));
      throw new Error("Project is required.");
    }

    await createTaskMutation.mutateAsync({
      projectId: targetProjectId,
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
          <p className="text-sm text-muted-foreground">
            {filtered.length === 1
              ? t("tasks.countOne")
              : t("tasks.count").replace("{count}", String(filtered.length))}
          </p>
        </div>
        {hasAccessibleProjects ? (
          <NewTaskDialog
            isSubmitting={createTaskMutation.isPending}
            assigneeOptions={assigneeOptions}
            projectOptions={projectOptions}
            onSubmit={handleCreateTask}
          >
            <Button size="sm" className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
              <Plus className="size-4" /> {t("common.newTask")}
            </Button>
          </NewTaskDialog>
        ) : (
          <p className="text-sm text-muted-foreground">{t("tasks.noAccessibleProjects")}</p>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("tasks.searchTasks")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill active={status === "all"} onClick={() => setStatusFilter("all")}>
            {t("tasks.allStatus")}
          </Pill>
          {(Object.keys(statusMeta) as TaskStatus[]).map((s) => (
            <Pill key={s} active={status === s} onClick={() => setStatusFilter(s)}>
              {t(statusMeta[s].labelKey)}
            </Pill>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Pill active={priority === "all"} onClick={() => setPriority("all")}>
            {t("tasks.allPriorities")}
          </Pill>
          {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
            <Pill key={p} active={priority === p} onClick={() => setPriority(p)}>
              {p}
            </Pill>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="hidden grid-cols-[1fr_120px_120px_140px_120px_120px] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div>{t("tasks.task")}</div>
          <SortableColumnHeader
            label={t("tasks.status")}
            field="status"
            sort={sort}
            onSort={handleSort}
          />
          <SortableColumnHeader
            label={t("tasks.priority")}
            field="priority"
            sort={sort}
            onSort={handleSort}
          />
          <SortableColumnHeader
            label={t("tasks.assignee")}
            field="assignee"
            sort={sort}
            onSort={handleSort}
          />
          <SortableColumnHeader
            label={t("tasks.due")}
            field="dueDate"
            sort={sort}
            onSort={handleSort}
          />
          <div className="text-right">{t("common.activity")}</div>
        </div>
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          isTrulyEmpty ? (
            <EmptyState
              isSubmitting={createTaskMutation.isPending}
              onCreate={handleCreateTask}
              projectOptions={projectOptions}
              hasAccessibleProjects={hasAccessibleProjects}
            />
          ) : (
            <NoResultsState onResetFilters={clearFilters} />
          )
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((task) => (
              <li
                key={task.id}
                onClick={() => setSelected(task)}
                className="grid cursor-pointer grid-cols-2 gap-3 px-4 py-3 text-sm transition hover:bg-muted/30 md:grid-cols-[1fr_120px_120px_140px_120px_120px]"
              >
                <div className="col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {task.key}
                    </span>
                    <span className="font-medium">{task.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{task.projectName}</span>
                    {task.labels.slice(0, 2).map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="h-4 rounded-md px-1.5 text-[10px] font-normal"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span
                    className={
                      "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " +
                      statusMeta[task.status].tone
                    }
                  >
                    {t(statusMeta[task.status].labelKey)}
                  </span>
                </div>
                <div>
                  <span
                    className={
                      "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " +
                      priorityMeta[task.priority].tone
                    }
                  >
                    {t(priorityMeta[task.priority].labelKey)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {task.assigneeName ? (
                    <>
                      <Avatar
                        id={task.assigneeId ?? task.id}
                        initials={task.assigneeAvatar ?? initials(task.assigneeName)}
                        size="sm"
                      />
                      <span className="truncate text-xs">{task.assigneeName}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" /> {task.dueDate ?? "—"}
                </div>
                <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3.5" />
                    {task.commentsCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3.5" />
                    {task.attachmentsCount}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TaskDrawer
        task={selected}
        assignee={selectedAssignee}
        assigneeOptions={assigneeOptions}
        onSaveChanges={({ assigneeId, dueDate, status, priority }) => {
          if (!selected || updateAssigneeMutation.isPending) return;
          updateAssigneeMutation.mutate({
            id: selected.id,
            input: {
              assigneeId,
              dueDate,
              status: taskStatusToApi[status],
              priority: taskPriorityToApi[priority],
            },
          });
        }}
        isSaving={updateAssigneeMutation.isPending}
        onOpenChange={handleDrawerOpenChange}
        onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
        isDeleting={deleteTaskMutation.isPending}
      />
    </AppShell>
  );
}

function taskRowToAnalyticsRecord(task: TaskRow) {
  return {
    status: taskStatusToApi[task.status],
    priority: taskPriorityToApi[task.priority],
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    createdAt: "",
    updatedAt: "",
  };
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
  // Keep YYYY-MM-DD so <input type="date" /> works consistently.
  return value.slice(0, 10);
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
        <li
          key={index}
          className="grid grid-cols-2 gap-3 px-4 py-3 md:grid-cols-[1fr_120px_120px_140px_120px_120px]"
        >
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
  const { t } = useI18n();
  return (
    <div className="px-4 py-12 text-center sm:px-8">
      <h3 className="text-base font-semibold">{t("tasks.loadErrorTitle")}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ?? t("common.errorServerHint")}
      </p>
      <Button
        onClick={onRetry}
        className="mt-5 bg-gradient-brand text-white shadow-glow hover:opacity-95"
      >
        {t("common.retry")}
      </Button>
    </div>
  );
}

function EmptyState({
  isSubmitting,
  onCreate,
  projectOptions,
  hasAccessibleProjects,
}: {
  isSubmitting: boolean;
  onCreate: (values: TaskFormValues) => Promise<void>;
  projectOptions: { id: string; name: string }[];
  hasAccessibleProjects: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="px-4 py-12 text-center sm:px-8">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <ListTodo className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{t("tasks.emptyTitle")}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {hasAccessibleProjects ? t("tasks.emptyHint") : t("tasks.noAccessibleProjects")}
      </p>
      {hasAccessibleProjects ? (
        <NewTaskDialog
          isSubmitting={isSubmitting}
          projectOptions={projectOptions}
          onSubmit={onCreate}
        >
          <Button className="mt-5 bg-gradient-brand text-white shadow-glow hover:opacity-95">
            <Plus className="size-4" /> {t("common.newTask")}
          </Button>
        </NewTaskDialog>
      ) : null}
    </div>
  );
}

function NoResultsState({ onResetFilters }: { onResetFilters: () => void }) {
  const { t } = useI18n();
  return (
    <div className="px-4 py-12 text-center sm:px-8">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Search className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{t("tasks.noMatchTitle")}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {t("tasks.noMatchHint")}
      </p>
      <Button variant="outline" onClick={onResetFilters} className="mt-5">
        <RotateCcw className="size-4" /> {t("common.resetFilters")}
      </Button>
    </div>
  );
}

function SortableColumnHeader({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: TaskSortField;
  sort: TaskSortState;
  onSort: (field: TaskSortField) => void;
  className?: string;
}) {
  const active = sort?.field === field;
  const direction = active ? sort.direction : null;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={
        direction === "asc"
          ? `${label}, sorted ascending`
          : direction === "desc"
            ? `${label}, sorted descending`
            : `${label}, not sorted`
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <span>{label}</span>
      {direction === "asc" ? (
        <ArrowUp className="size-3 shrink-0" aria-hidden />
      ) : direction === "desc" ? (
        <ArrowDown className="size-3 shrink-0" aria-hidden />
      ) : (
        <ArrowUpDown className="size-3 shrink-0 opacity-40" aria-hidden />
      )}
    </button>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
