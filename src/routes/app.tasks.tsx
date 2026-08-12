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
import {
  CREATE_ACTION_BUTTON_CLASSNAME,
  FILTER_BAR_TASKS_CONTROLS_CLASSNAME,
  FILTER_RESET_CLASSNAME,
  AssigneeFilterOption,
  FilterTriggerLabel,
  FilterBar,
  assigneeFilterSelectClassName,
  filterSelectActiveAttr,
  priorityFilterSelectClassName,
  statusFilterSelectClassName,
} from "@/components/app/FilterBar";
import { type Task, type TaskStatus, type Priority } from "@/lib/mock-data";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { TaskPriorityIndicator } from "@/components/app/TaskPriorityIndicator";
import { TaskStatusIndicator } from "@/components/app/TaskStatusIndicator";
import { NewTaskDialog, type TaskFormValues } from "@/components/app/QuickActionDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Paperclip,
  Calendar,
  ListTodo,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CircleDot,
  Flag,
  Users,
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
import { getProjectAccent } from "@/lib/project-color";
import { taskPriorityChipClass } from "@/lib/task-priority-theme";
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
  return value === "urgent" ? value : undefined;
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
  in_progress: { labelKey: "board.inProgress", tone: taskStatusChipClass.in_progress },
  review: { labelKey: "board.review", tone: taskStatusChipClass.review },
  done: { labelKey: "board.done", tone: taskStatusChipClass.done },
};
const priorityMeta: Record<Priority, { labelKey: TKey; tone: string }> = {
  low: { labelKey: "tasks.priorityLow", tone: taskPriorityChipClass.low },
  medium: { labelKey: "tasks.priorityMedium", tone: taskPriorityChipClass.medium },
  urgent: { labelKey: "tasks.priorityUrgent", tone: taskPriorityChipClass.urgent },
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
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
};

const apiPriorityMap: Record<TaskApiPriority, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
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
    () =>
      apiProjects.map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
      })),
    [apiProjects],
  );
  const projectColorById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const project of apiProjects) {
      map.set(project.id, project.color);
    }
    return map;
  }, [apiProjects]);
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
    onSuccess: async () => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      invalidateNotifications(queryClient);
      updateUrlSearch({ taskId: undefined });
      toast.success(t("tasks.updated"));
    },
    onError: () => {
      toast.error(t("tasks.updateFailed"));
    },
  });
  const updateDescriptionMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string | null }) =>
      updateTask(id, { description }),
    onSuccess: async () => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      invalidateNotifications(queryClient);
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
  const taskList = useMemo(() => apiTasks.map(mapApiTaskToRow), [apiTasks]);
  const selected = useMemo(
    () => taskList.find((task) => task.id === taskIdFromUrl) ?? null,
    [taskIdFromUrl, taskList],
  );
  const selectedAssignees = useMemo(
    () => (selected ? resolveTaskAssignees(apiTasks, selected.id) : []),
    [selected, apiTasks],
  );

  useEffect(() => {
    setStatus(taskListStatusFromUrl(statusFromUrl));
  }, [statusFromUrl]);

  useEffect(() => {
    setAssigneeFilter(assigneeFilterFromUrl(assigneeFromUrl));
  }, [assigneeFromUrl]);

  function updateUrlSearch(patch: Partial<TasksSearch>) {
    void navigate({
      search: {
        taskId: "taskId" in patch ? patch.taskId : urlSearch.taskId,
        status: "status" in patch ? patch.status : urlSearch.status,
        due: "due" in patch ? patch.due : urlSearch.due,
        priority: "priority" in patch ? patch.priority : urlSearch.priority,
        assignee: "assignee" in patch ? patch.assignee : urlSearch.assignee,
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
      updateUrlSearch({ taskId: undefined });
      toast.success(t("tasks.deleted"));
    },
    onError: () => {
      toast.error(t("tasks.deleteFailed"));
    },
  });

  useEffect(() => {
    if (!taskIdFromUrl || isLoading || isError || selected) return;
    if (!selected) {
      void navigate({ search: { ...urlSearch, taskId: undefined }, replace: true });
    }
  }, [taskIdFromUrl, isLoading, isError, selected, navigate, urlSearch]);

  function handleDrawerOpenChange(open: boolean) {
    if (!open) {
      updateUrlSearch({ taskId: undefined });
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
              <Button size="sm" variant="brand" className={CREATE_ACTION_BUTTON_CLASSNAME}>
                <Plus className="size-4" /> {t("common.newTask")}
              </Button>
            </NewTaskDialog>
          ) : (
            <p className="text-sm text-muted-foreground">{t("tasks.noAccessibleProjects")}</p>
          )
        }
      />

      <FilterBar>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="relative min-w-0 w-full">
            <Search
              className="filter-search-icon absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("tasks.searchTasks")}
              className="filter-search-input pl-9"
            />
          </div>
          <div className={FILTER_BAR_TASKS_CONTROLS_CLASSNAME}>
            <Select
              value={status}
              onValueChange={(value) => setStatusFilter(value as TaskListStatusFilter)}
            >
              <SelectTrigger
                data-filter-active={filterSelectActiveAttr(status !== "all")}
                className={statusFilterSelectClassName(status)}
              >
                <SelectValue>
                  <FilterTriggerLabel icon={CircleDot}>
                    {getStatusFilterTriggerLabel(status, t)}
                  </FilterTriggerLabel>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[12rem]">
                <SelectItem value="all">{t("tasks.allStatus")}</SelectItem>
                <SelectItem value="open">{t("tasks.openStatus")}</SelectItem>
                {(Object.keys(statusMeta) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <TaskStatusIndicator status={s}>
                      {t(statusMeta[s].labelKey)}
                    </TaskStatusIndicator>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority | "all")}
            >
              <SelectTrigger
                data-filter-active={filterSelectActiveAttr(priority !== "all")}
                className={priorityFilterSelectClassName(priority)}
              >
                <SelectValue>
                  <FilterTriggerLabel icon={Flag}>
                    {getPriorityFilterTriggerLabel(priority, t)}
                  </FilterTriggerLabel>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[12rem]">
                <SelectItem value="all">{t("tasks.allPriorities")}</SelectItem>
                {(["low", "medium", "urgent"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    <TaskPriorityIndicator priority={p}>
                      {t(priorityMeta[p].labelKey)}
                    </TaskPriorityIndicator>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={(value) => setAssigneeListFilter(value)}>
              <SelectTrigger
                data-filter-active={filterSelectActiveAttr(assigneeFilter !== "all")}
                className={assigneeFilterSelectClassName()}
              >
                <SelectValue>
                  <FilterTriggerLabel icon={Users}>
                    {getAssigneeFilterTriggerLabel(assigneeFilter, assigneeOptions, t)}
                  </FilterTriggerLabel>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[14rem]">
                <SelectItem value="all">{t("tasks.allAssignees")}</SelectItem>
                <SelectItem value="unassigned">{t("tasks.noAssignees")}</SelectItem>
                {assigneeOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <AssigneeFilterOption option={option} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className={FILTER_RESET_CLASSNAME}
              disabled={!hasActiveFilters}
              onClick={clearFilters}
            >
              <RotateCcw className="size-4" />
              {t("common.resetFilters")}
            </Button>
          </div>
        </div>
      </FilterBar>

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
          <div className="text-center">{t("tasks.sectionAttachments")}</div>
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
            <NoResultsState />
          )
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((task) => {
              const projectAccent = getProjectAccent({
                id: task.projectId,
                name: task.projectName,
                color: projectColorById.get(task.projectId),
              });
              return (
                <li
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${task.key} ${translateStarterTitle(task.title, lang)}`}
                  onClick={() => updateUrlSearch({ taskId: task.id })}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      updateUrlSearch({ taskId: task.id });
                    }
                  }}
                  className="grid min-w-0 cursor-pointer grid-cols-2 items-start gap-3 px-4 py-4 text-sm transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/35 md:grid-cols-[minmax(0,1fr)_100px_100px_120px_100px_88px] md:items-center md:py-3"
                >
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {task.key}
                      </span>
                      <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere] md:truncate">
                        {translateStarterTitle(task.title, lang)}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/35 px-2 py-0.5 font-medium text-foreground/75">
                        <span
                          className={"size-1.5 shrink-0 rounded-full " + projectAccent.dot}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">
                          {translateStarterProjectName(task.projectName, lang)}
                        </span>
                      </span>
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
                  <div className="flex min-w-0 flex-col items-start gap-1 md:items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">
                      {t("tasks.status")}
                    </span>
                    <span
                      className={
                        "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " +
                        statusMeta[task.status].tone
                      }
                    >
                      <TaskStatusIndicator status={task.status} dotClassName="size-1.5">
                        {t(statusMeta[task.status].labelKey)}
                      </TaskStatusIndicator>
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-1 md:items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">
                      {t("tasks.priority")}
                    </span>
                    <span
                      className={
                        "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold " +
                        priorityMeta[task.priority].tone
                      }
                    >
                      <TaskPriorityIndicator priority={task.priority} dotClassName="size-1.5">
                        {t(priorityMeta[task.priority].labelKey)}
                      </TaskPriorityIndicator>
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-1 md:items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">
                      {t("tasks.assignee")}
                    </span>
                    <AssigneeAvatars
                      assignees={task.assigneeOptions}
                      showUnassignedLabel
                      maxVisible={2}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-1 md:items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">
                      {t("tasks.due")}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      <Calendar className="size-3.5 shrink-0" />{" "}
                      {formatDueDateTimeShort(task.dueDate)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-1 md:items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">
                      {t("tasks.sectionAttachments")}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="size-3.5" />
                      {task.attachmentsCount}
                    </span>
                  </div>
                </li>
              );
            })}
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
        onSaveDescription={async (description) => {
          if (!selected || updateDescriptionMutation.isPending) {
            throw new Error("Description update already in progress");
          }
          await updateDescriptionMutation.mutateAsync({ id: selected.id, description });
        }}
        isSavingDescription={updateDescriptionMutation.isPending}
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
  projectOptions: { id: string; name: string; color?: string | null }[];
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
            <Button variant="brand">
              <Plus className="size-4" /> {t("common.newTask")}
            </Button>
          </NewTaskDialog>
        ) : undefined
      }
    />
  );
}

function NoResultsState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center sm:px-10">
      <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Search className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{t("tasks.noMatchTitle")}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        {t("tasks.noMatchHint")}
      </p>
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
