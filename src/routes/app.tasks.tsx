import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateNotifications } from "@/lib/api/notifications";
import { useCurrentWorkspace } from "@/lib/auth/use-current-user";
import { invalidateWorkspaceContentQueries } from "@/lib/workspace-queries";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { type Task, type TaskStatus, type Priority } from "@/lib/mock-data";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { NewTaskDialog, type TaskFormValues } from "@/components/app/QuickActionDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
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
import { formatDueDateTimeShort } from "@/lib/due-datetime";
import { translateStarterProjectName, translateStarterTitle } from "@/lib/starter-content";
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
import { fetchWorkspaceMembers } from "@/lib/api/workspace-members";
import {
  buildAssigneeOptionsFromWorkspaceMembers,
  buildFilterAssigneeOptions,
  resolveTaskAssignees,
  taskIsUnassigned,
  taskMatchesAssignee,
  taskSortAssigneeName,
  type AssigneeOption,
} from "@/lib/assignee-options";
import { AssigneeAvatars } from "@/components/app/AssigneeAvatars";
import { cycleTaskSort, sortTasks, type TaskSortField, type TaskSortState } from "@/lib/task-sort";
import { taskStatusChipClass } from "@/lib/task-status-theme";
import { cn } from "@/lib/utils";
import {
  taskMatchesUrlAnalyticsFilters,
  type TasksUrlAnalyticsFilters,
  type TasksUrlDue,
  type TasksUrlPriorityFilter,
} from "@/lib/dashboard-analytics";

export type TasksUrlStatus = "done" | "open";

export type TasksSearch = {
  taskId?: string;
  status?: TasksUrlStatus;
  due?: TasksUrlDue;
  priority?: TasksUrlPriorityFilter;
  assignee?: string;
};

export type AssigneeListFilter = "all" | "unassigned" | (string & {});

function parseTasksUrlAssignee(value: unknown): AssigneeListFilter {
  if (typeof value !== "string" || value.length === 0) {
    return "all";
  }
  if (value === "unassigned") {
    return "unassigned";
  }
  return value;
}

export function assigneeFilterFromUrl(assignee?: string): AssigneeListFilter {
  if (!assignee) return "all";
  return parseTasksUrlAssignee(assignee);
}

export function assigneeFilterToUrl(filter: AssigneeListFilter): string | undefined {
  if (filter === "all") return undefined;
  return filter;
}

function parseTasksUrlStatus(value: unknown): TasksUrlStatus | undefined {
  return value === "done" || value === "open" ? value : undefined;
}

function parseTasksUrlDue(value: unknown): TasksUrlDue | undefined {
  return value === "overdue" || value === "soon" ? value : undefined;
}

function parseTasksUrlPriority(value: unknown): TasksUrlPriorityFilter | undefined {
  return value === "high" ? value : undefined;
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

function getStatusFilterTriggerLabel(filter: TaskListStatusFilter, t: (k: TKey) => string): string {
  if (filter === "all") return t("tasks.status");
  if (filter === "open") return t("tasks.openStatusShort");
  return t(statusMeta[filter].labelKey);
}

function getPriorityFilterTriggerLabel(filter: Priority | "all", t: (k: TKey) => string): string {
  if (filter === "all") return t("tasks.allPriorities");
  return t(priorityMeta[filter].labelKey);
}

function getAssigneeFilterTriggerLabel(
  filter: AssigneeListFilter,
  options: AssigneeOption[],
  t: (k: TKey) => string,
): string {
  if (filter === "all") return t("tasks.allAssignees");
  if (filter === "unassigned") return t("tasks.noAssignees");
  return options.find((option) => option.id === filter)?.name ?? t("tasks.assignee");
}

function taskMatchesAssigneeListFilter(
  task: Pick<TaskRow, "assigneeIds" | "assigneeId">,
  filter: AssigneeListFilter,
) {
  if (filter === "all") return true;
  if (filter === "unassigned") return taskIsUnassigned(task);
  return taskMatchesAssignee(task, filter);
}

export const Route = createFileRoute("/app/tasks")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    taskId:
      typeof search.taskId === "string" && search.taskId.length > 0 ? search.taskId : undefined,
    status: parseTasksUrlStatus(search.status),
    due: parseTasksUrlDue(search.due),
    priority: parseTasksUrlPriority(search.priority),
    assignee:
      typeof search.assignee === "string" && search.assignee.length > 0
        ? search.assignee
        : undefined,
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
  assigneeOptions: AssigneeOption[];
  assigneeName: string | null;
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
  const { t, lang } = useI18n();
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
    }),
    [dueFromUrl, priorityFromUrl],
  );
  const hasUrlAnalyticsFilters = Boolean(dueFromUrl || priorityFromUrl);
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { data: currentWorkspace } = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskListStatusFilter>(() =>
    taskListStatusFromUrl(statusFromUrl),
  );
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeListFilter>(() =>
    assigneeFilterFromUrl(assigneeFromUrl),
  );
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
  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: fetchWorkspaceMembers,
  });
  const projectOptions = useMemo(
    () => apiProjects.map((project) => ({ id: project.id, name: project.name })),
    [apiProjects],
  );
  const hasAccessibleProjects = projectOptions.length > 0;
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: async () => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      invalidateNotifications(queryClient);
      toast.success(t("tasks.created"));
    },
    onError: () => {
      toast.error(t("tasks.createFailed"));
    },
  });
  const updateAssigneeMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: {
        title: string;
        assigneeIds: string[];
        dueDate: string | null;
        status: TaskApiStatus;
        priority: TaskApiPriority;
      };
    }) => updateTask(id, input),
    onSuccess: async (updated) => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      invalidateNotifications(queryClient);
      setSelected((prev) => {
        if (!prev || prev.id !== updated.id) return prev;
        return mapApiTaskToRow(updated);
      });
      setSelected(null);
      toast.success(t("tasks.updated"));
    },
    onError: () => {
      toast.error(t("tasks.updateFailed"));
    },
  });
  const assigneeOptions = useMemo(
    () =>
      buildFilterAssigneeOptions(
        apiTasks,
        buildAssigneeOptionsFromWorkspaceMembers(workspaceMembers),
      ),
    [apiTasks, workspaceMembers],
  );
  const selectedAssignees = useMemo(
    () => (selected ? resolveTaskAssignees(apiTasks, selected.id) : []),
    [selected, apiTasks],
  );
  const taskList = useMemo(() => apiTasks.map(mapApiTaskToRow), [apiTasks]);

  useEffect(() => {
    setStatus(taskListStatusFromUrl(statusFromUrl));
  }, [statusFromUrl]);

  useEffect(() => {
    setAssigneeFilter(assigneeFilterFromUrl(assigneeFromUrl));
  }, [assigneeFromUrl]);

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

  function setAssigneeListFilter(next: AssigneeListFilter) {
    setAssigneeFilter(next);
    updateUrlSearch({ assignee: assigneeFilterToUrl(next) });
  }

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      setSelected(null);
      if (taskIdFromUrl) {
        updateUrlSearch({ taskId: undefined });
      }
      toast.success(t("tasks.deleted"));
    },
    onError: () => {
      toast.error(t("tasks.deleteFailed"));
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
        if (!taskMatchesAssigneeListFilter(task, assigneeFilter)) return false;
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
    [q, status, priority, assigneeFilter, taskList, hasUrlAnalyticsFilters, urlAnalyticsFilters],
  );
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);
  const isTrulyEmpty = taskList.length === 0;
  const hasActiveFilters =
    q !== "" ||
    status !== "all" ||
    priority !== "all" ||
    assigneeFilter !== "all" ||
    hasUrlAnalyticsFilters;

  function clearFilters() {
    setQ("");
    setStatus("all");
    setPriority("all");
    setAssigneeFilter("all");
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
      assigneeIds: values.assigneeIds ?? [],
      dueDate: values.dueDate || null,
    });
  }

  return (
    <AppShell>
      <PageHeader
        title={t("tasks.tasks")}
        subtitle={
          filtered.length === 1
            ? t("tasks.countOne")
            : t("tasks.count").replace("{count}", String(filtered.length))
        }
        actions={
          hasAccessibleProjects ? (
            <NewTaskDialog
              isSubmitting={createTaskMutation.isPending}
              projectOptions={projectOptions}
              onSubmit={handleCreateTask}
            >
              <Button size="sm" variant="brand">
                <Plus className="size-4" /> {t("common.newTask")}
              </Button>
            </NewTaskDialog>
          ) : (
            <p className="text-sm text-muted-foreground">{t("tasks.noAccessibleProjects")}</p>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 w-full flex-1 sm:min-w-[12rem] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("tasks.searchTasks")}
            className="pl-9"
          />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select
            value={status}
            onValueChange={(value) => setStatusFilter(value as TaskListStatusFilter)}
          >
            <SelectTrigger className="h-9 w-[7.25rem] shrink-0 border-border bg-card text-sm">
              <span className="truncate">{getStatusFilterTriggerLabel(status, t)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allStatus")}</SelectItem>
              <SelectItem value="open">{t("tasks.openStatus")}</SelectItem>
              {(Object.keys(statusMeta) as TaskStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(statusMeta[s].labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as Priority | "all")}
          >
            <SelectTrigger className="h-9 w-[10rem] shrink-0 border-border bg-card text-sm">
              <span className="truncate">{getPriorityFilterTriggerLabel(priority, t)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allPriorities")}</SelectItem>
              {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {t(priorityMeta[p].labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={(value) => setAssigneeListFilter(value)}>
            <SelectTrigger className="h-9 w-[8.5rem] shrink-0 border-border bg-card text-sm">
              <span className="truncate">
                {getAssigneeFilterTriggerLabel(assigneeFilter, assigneeOptions, t)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allAssignees")}</SelectItem>
              <SelectItem value="unassigned">{t("tasks.noAssignees")}</SelectItem>
              {assigneeOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 sm:ml-auto"
              onClick={clearFilters}
            >
              <RotateCcw className="size-4" />
              {t("common.resetFilters")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_120px_100px_88px] items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <div>{t("tasks.task")}</div>
          <SortableColumnHeader
            label={t("tasks.status")}
            field="status"
            sort={sort}
            onSort={handleSort}
            className="justify-center"
          />
          <SortableColumnHeader
            label={t("tasks.priority")}
            field="priority"
            sort={sort}
            onSort={handleSort}
            className="justify-center"
          />
          <SortableColumnHeader
            label={t("tasks.assignee")}
            field="assignee"
            sort={sort}
            onSort={handleSort}
            className="justify-center"
          />
          <SortableColumnHeader
            label={t("tasks.due")}
            field="dueDate"
            sort={sort}
            onSort={handleSort}
            className="justify-center"
          />
          <div className="text-center">{t("common.activity")}</div>
        </div>
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ApiErrorState
            compact
            className="border-0 bg-transparent shadow-none"
            title={t("tasks.loadErrorTitle")}
            error={error}
            onRetry={() => void refetch()}
          />
        ) : filtered.length === 0 ? (
          isTrulyEmpty ? (
            <TasksEmptyState
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
                className="grid cursor-pointer grid-cols-2 items-center gap-3 px-4 py-3 text-sm transition hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_100px_100px_120px_100px_88px]"
              >
                <div className="col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {task.key}
                    </span>
                    <span className="font-medium">{translateStarterTitle(task.title, lang)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{translateStarterProjectName(task.projectName, lang)}</span>
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
                <div className="flex justify-center">
                  <span
                    className={
                      "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " +
                      statusMeta[task.status].tone
                    }
                  >
                    {t(statusMeta[task.status].labelKey)}
                  </span>
                </div>
                <div className="flex justify-center">
                  <span
                    className={
                      "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " +
                      priorityMeta[task.priority].tone
                    }
                  >
                    {t(priorityMeta[task.priority].labelKey)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <AssigneeAvatars
                    assignees={task.assigneeOptions}
                    showUnassignedLabel
                    maxVisible={2}
                  />
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" /> {formatDueDateTimeShort(task.dueDate)}
                </div>
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
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
        assignees={selectedAssignees}
        onSaveChanges={({ title, assigneeIds, dueDate, status, priority }) => {
          if (!selected || updateAssigneeMutation.isPending) return;
          updateAssigneeMutation.mutate({
            id: selected.id,
            input: {
              title,
              assigneeIds,
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
    assigneeIds: task.assigneeIds,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    createdAt: "",
    updatedAt: "",
  };
}

function mapApiTaskToRow(task: TaskApiItem): TaskRow {
  const assigneeOptions = task.assignees.map((assignee) => ({
    id: assignee.id,
    name: assignee.name,
    email: assignee.email,
    avatar: assignee.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    avatarUrl: assignee.avatarUrl ?? null,
  }));

  return {
    id: task.id,
    key: task.key,
    title: task.title,
    description: task.description ?? "",
    status: apiStatusMap[task.status],
    priority: apiPriorityMap[task.priority],
    assigneeIds: task.assigneeIds,
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    dueDate: task.dueDate,
    labels: [],
    comments: [],
    checklist: [],
    activity: [],
    attachments: [],
    projectName: task.project.name,
    assigneeOptions,
    assigneeName: taskSortAssigneeName(assigneeOptions),
    commentsCount: task.commentsCount,
    checklistTotal: task.checklistTotal,
    checklistDone: task.checklistDone,
    attachmentsCount: task.attachmentsCount,
  };
}

function LoadingRows() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <li
          key={index}
          className="grid grid-cols-2 items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_100px_100px_120px_100px_88px]"
        >
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="ml-auto h-5 w-16" />
        </li>
      ))}
    </ul>
  );
}

function TasksEmptyState({
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
    <EmptyState
      className="border-0 bg-transparent shadow-none"
      icon={ListTodo}
      title={t("tasks.emptyTitle")}
      description={hasAccessibleProjects ? t("tasks.emptyHint") : t("tasks.noAccessibleProjects")}
      primaryAction={
        hasAccessibleProjects ? (
          <NewTaskDialog
            isSubmitting={isSubmitting}
            projectOptions={projectOptions}
            onSubmit={onCreate}
          >
            <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
              <Plus className="size-4" /> {t("common.newTask")}
            </Button>
          </NewTaskDialog>
        ) : undefined
      }
    />
  );
}

function NoResultsState({ onResetFilters }: { onResetFilters: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      className="border-0 bg-transparent shadow-none"
      icon={Search}
      title={t("tasks.noMatchTitle")}
      description={t("tasks.noMatchHint")}
      primaryAction={
        <Button variant="outline" onClick={onResetFilters}>
          <RotateCcw className="size-4" /> {t("common.resetFilters")}
        </Button>
      }
    />
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
        "inline-flex w-full items-center gap-1 rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
