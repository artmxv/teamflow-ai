import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { statusColumns, type Priority, type Task, type TaskStatus } from "@/lib/mock-data";
import { TaskCard, type TaskDragData } from "@/components/app/TaskCard";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { NewTaskDialog, type TaskFormValues } from "@/components/app/QuickActionDialogs";
import { Button } from "@/components/ui/button";
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
import { taskStatusLabel, useI18n } from "@/lib/i18n";
import { Filter, Plus } from "lucide-react";
import {
  buildAssigneeOptions,
  resolveTaskAssignees,
  taskHasAssignee,
  taskIsUnassigned,
} from "@/lib/assignee-options";
import { taskStatusColumnDotClass } from "@/lib/task-status-theme";

export const Route = createFileRoute("/app/board")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Kanban — TeamFlow AI" }] }),
  component: Board,
});

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

function Board() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Task | null>(null);
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [assignee, setAssignee] = useState<string>("all");
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
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTask(id, { status: taskStatusToApi[status] }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueryData<TaskApiItem[]>(["tasks"]);
      if (!previous) return { previous: undefined };
      queryClient.setQueryData<TaskApiItem[]>(
        ["tasks"],
        previous.map((task) =>
          task.id === id ? { ...task, status: taskStatusToApi[status] } : task,
        ),
      );
      return { previous };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task status updated");
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tasks"], context.previous);
      }
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Task status could not be updated",
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelected(null);
      toast.success("Task deleted");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Task could not be deleted",
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
        assigneeIds: string[];
        dueDate: string | null;
        status: TaskApiStatus;
        priority: TaskApiPriority;
      };
    }) => updateTask(id, input),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelected((prev) => (prev?.id === updated.id ? mapApiTaskToTask(updated) : prev));
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
  const selectedAssignees = useMemo(
    () => (selected ? resolveTaskAssignees(apiTasks, selected.id) : []),
    [selected, apiTasks],
  );
  const updatingTaskId =
    updateTaskMutation.isPending && updateTaskMutation.variables
      ? updateTaskMutation.variables.id
      : null;
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const suppressCardClickRef = useRef(false);
  const taskList = apiTasks.map(mapApiTaskToTask);

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function handleStatusChange(taskId: string, currentStatus: TaskStatus, status: TaskStatus) {
    if (status === currentStatus || updateTaskMutation.isPending) return;
    updateTaskMutation.mutate({ id: taskId, status });
  }

  function handleDragStart(event: DragStartEvent) {
    suppressCardClickRef.current = true;
    const data = event.active.data.current as TaskDragData | undefined;
    if (!data || data.type !== "task") return;
    const task = taskList.find((item) => item.id === data.taskId);
    if (task) setActiveDragTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null);
    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
    const { active, over } = event;
    if (!over) return;

    const data = active.data.current as TaskDragData | undefined;
    if (!data || data.type !== "task") return;

    const targetStatus = parseColumnStatus(over.id);
    if (!targetStatus) return;

    handleStatusChange(data.taskId, data.status, targetStatus);
  }

  function handleDragCancel() {
    setActiveDragTask(null);
    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
  }

  function handleOpenTask(task: Task) {
    if (suppressCardClickRef.current) return;
    setSelected(task);
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

  const filteredTasks = taskList.filter((task) => {
    const apiTask = apiTasks.find((item) => item.id === task.id);
    if (!apiTask) {
      return priority === "all";
    }
    const matchesPriority = priority === "all" || task.priority === priority;
    const matchesAssignee =
      assignee === "all" ||
      (assignee === "unassigned" ? taskIsUnassigned(apiTask) : taskHasAssignee(apiTask, assignee));
    return matchesPriority && matchesAssignee;
  });

  return (
    <AppShell title={t("side.kanban")}>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("board.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("board.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {hasAccessibleProjects ? (
            <NewTaskDialog
              isSubmitting={createTaskMutation.isPending}
              assigneeOptions={assigneeOptions}
              projectOptions={projectOptions}
              onSubmit={handleCreateTask}
            >
              <Button
                size="sm"
                className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
              >
                <Plus className="size-4" /> {t("common.newTask")}
              </Button>
            </NewTaskDialog>
          ) : (
            <p className="text-sm text-muted-foreground">{t("tasks.noAccessibleProjects")}</p>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4 text-muted-foreground" /> {t("board.filters")}
        </div>
        <div className="grid gap-2 sm:ml-auto sm:grid-cols-3">
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as Priority | "all")}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t("tasks.priority")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allPriorities")}</SelectItem>
              <SelectItem value="low">{t("tasks.priorityLow")}</SelectItem>
              <SelectItem value="medium">{t("tasks.priorityMedium")}</SelectItem>
              <SelectItem value="high">{t("tasks.priorityHigh")}</SelectItem>
              <SelectItem value="urgent">{t("tasks.priorityUrgent")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("tasks.assignee")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.assignee")}</SelectItem>
              {assigneeOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
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

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <DndContext
          sensors={dragSensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <KanbanBoardViewport>
            {statusColumns.map((col) => {
              const colTasks = filteredTasks.filter((task) => task.status === col.key);
              const columnTitle = taskStatusLabel(col.key, t);
              const newTaskDialogProps = {
                initialStatus: col.key,
                isSubmitting: createTaskMutation.isPending,
                assigneeOptions,
                projectOptions: hasAccessibleProjects ? projectOptions : undefined,
                onSubmit: handleCreateTask,
              } as const;
              return (
                <BoardColumn
                  key={col.key}
                  title={columnTitle}
                  status={col.key}
                  count={isLoading ? 0 : colTasks.length}
                  headerAction={
                    hasAccessibleProjects ? (
                      <NewTaskDialog {...newTaskDialogProps}>
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                          aria-label={`${t("common.newTask")} — ${columnTitle}`}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </NewTaskDialog>
                    ) : null
                  }
                >
                  {isLoading ? (
                    <LoadingCards />
                  ) : (
                    <>
                      {colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          draggable
                          assignees={resolveTaskAssignees(apiTasks, task.id)}
                          onOpen={handleOpenTask}
                          onStatusChange={(status) =>
                            handleStatusChange(task.id, task.status, status)
                          }
                          isStatusUpdating={updatingTaskId === task.id}
                        />
                      ))}
                      {colTasks.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          {t("board.emptyColumn")}
                        </div>
                      )}
                    </>
                  )}
                  {hasAccessibleProjects ? (
                    <NewTaskDialog {...newTaskDialogProps}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                      >
                        <Plus className="size-3.5" /> {t("board.addNewCard")}
                      </button>
                    </NewTaskDialog>
                  ) : null}
                </BoardColumn>
              );
            })}
          </KanbanBoardViewport>
          <DragOverlay dropAnimation={null}>
            {activeDragTask ? (
              <TaskCard
                task={activeDragTask}
                dragOverlay
                assignees={resolveTaskAssignees(apiTasks, activeDragTask.id)}
                onOpen={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskDrawer
        task={selected}
        assignees={selectedAssignees}
        assigneeOptions={assigneeOptions}
        onSaveChanges={({ assigneeIds, dueDate, status, priority }) => {
          if (!selected || updateAssigneeMutation.isPending) return;
          updateAssigneeMutation.mutate({
            id: selected.id,
            input: {
              assigneeIds,
              dueDate,
              status: taskStatusToApi[status],
              priority: taskPriorityToApi[priority],
            },
          });
        }}
        isSaving={updateAssigneeMutation.isPending}
        onOpenChange={(o) => !o && setSelected(null)}
        onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
        isDeleting={deleteTaskMutation.isPending}
      />
    </AppShell>
  );
}

function mapApiTaskToTask(task: TaskApiItem): Task {
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
    dueDate: formatDate(task.dueDate),
    labels: [task.project.name],
    comments: [],
    commentsCount: task.commentsCount,
    attachmentsCount: task.attachmentsCount,
    checklist: Array.from({ length: task.checklistTotal }, (_, index) => ({
      id: `${task.id}-checklist-${index}`,
      label: `Checklist item ${index + 1}`,
      done: index < task.checklistDone,
    })),
    activity: [],
    attachments: [],
  };
}

function formatDate(value: string | null) {
  if (!value) return null;
  // Keep YYYY-MM-DD so <input type="date" /> works consistently.
  return value.slice(0, 10);
}

function KanbanBoardViewport({ children }: { children: React.ReactNode }) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const isSyncingScroll = useRef(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const updateWidth = () => setContentWidth(content.scrollWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  function syncScroll(from: "top" | "main") {
    if (isSyncingScroll.current) return;
    const top = topScrollRef.current;
    const main = mainScrollRef.current;
    if (!top || !main) return;

    isSyncingScroll.current = true;
    if (from === "top") main.scrollLeft = top.scrollLeft;
    else top.scrollLeft = main.scrollLeft;
    isSyncingScroll.current = false;
  }

  return (
    <div className="kanban-board-viewport w-full min-w-0">
      <div
        ref={topScrollRef}
        className="kanban-board-scroll-top -mx-2 px-2"
        onScroll={() => syncScroll("top")}
        aria-hidden="true"
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      <div
        ref={mainScrollRef}
        className="kanban-board-scroll-main -mx-2 px-2 pb-2"
        onScroll={() => syncScroll("main")}
      >
        <div ref={contentRef} className="flex items-stretch gap-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-3.5 shadow-soft">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="mt-4 flex items-center justify-between">
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            <div className="size-7 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-soft">
      <h3 className="text-base font-semibold">{t("board.errorTitle")}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ?? t("board.errorHint")}
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

const columnStatusIds = new Set<TaskStatus>(statusColumns.map((col) => col.key));

function parseColumnStatus(id: string | number): TaskStatus | null {
  const key = String(id);
  return columnStatusIds.has(key as TaskStatus) ? (key as TaskStatus) : null;
}

function BoardColumn({
  title,
  status,
  count,
  headerAction,
  children,
}: {
  title: string;
  status: TaskStatus;
  count: number;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
  });

  return (
    <div
      className={
        "flex w-80 shrink-0 flex-col gap-3 rounded-2xl bg-muted/40 p-3 transition-colors " +
        (isOver ? "bg-primary/10 ring-1 ring-primary/25" : "")
      }
    >
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={"size-2 rounded-full " + taskStatusColumnDotClass[status]} />
          {title}
          <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-soft">
            {count}
          </span>
        </div>
        {headerAction}
      </div>
      <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
        {children}
      </div>
    </div>
  );
}
