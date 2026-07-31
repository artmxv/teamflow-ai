import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Priority, Task, TaskStatus } from "@/lib/mock-data";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { TaskDrawer } from "@/components/app/TaskDrawer";
import { NewTaskDialog, type TaskFormValues } from "@/components/app/QuickActionDialogs";
import { projectStatusMeta, type ProjectStatus } from "@/lib/mock-data";
import { projectApiStatusLabel, projectStatusLabel, useI18n, type TKey } from "@/lib/i18n";
import {
  combineLocalDateAndTime,
  formatDueDateTime,
  formatDueDateTimeShort,
  splitLocalDateTime,
} from "@/lib/due-datetime";
import { resolveTaskAssignees } from "@/lib/assignee-options";
import { AssigneeAvatars } from "@/components/app/AssigneeAvatars";
import { AuthenticatedImagePreview } from "@/components/app/files/AuthenticatedImagePreview";
import { useAuthenticatedImageLightbox } from "@/components/app/files/AuthenticatedImageLightbox";
import { DeadlineDatePicker } from "@/components/app/DeadlineDatePicker";
import { DeadlineTimePicker } from "@/components/app/DeadlineTimePicker";
import { deadlineStatusDateTimeRowClassName } from "@/components/app/deadline-field-styles";
import { resolveProjectGradient } from "@/lib/project-color";
import {
  displayProjectDescription,
  displayProjectName,
  displayTaskTitle,
} from "@/lib/starter-content";
import {
  deleteProject,
  fetchProjects,
  updateProject,
  type ProjectApiItem,
  type ProjectApiStatus,
} from "@/lib/api/projects";
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
import {
  deleteProjectDocument,
  downloadProjectDocumentFile,
  fetchProjectDocumentBlob,
  fetchProjectDocuments,
  formatDocumentSize,
  getProjectDocumentFileTypeBadge,
  isImageProjectDocument,
  openProjectDocument,
  uploadProjectDocument,
  type ProjectDocumentApiItem,
} from "@/lib/api/project-documents";
import {
  addProjectMember,
  fetchAvailableProjectMembers,
  fetchProjectMembers,
  removeProjectMember,
  type AvailableProjectMember,
  type ProjectMemberApiItem,
} from "@/lib/api/project-members";
import { invalidateNotifications } from "@/lib/api/notifications";
import { invalidateWorkspaceContentQueries } from "@/lib/workspace-queries";
import { friendlyUploadErrorMessage } from "@/lib/upload-errors";
import { isUploadFileTooLarge } from "@/lib/upload-limits";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isWorkspaceManager, useCurrentUser } from "@/lib/auth/use-current-user";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Download,
  ExternalLink,
  FileText,
  ListTodo,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/app/projects/$projectId")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Project — TeamFlow AI" }] }),
  component: ProjectDetailPage,
});

const apiStatusMap: Record<ProjectApiStatus, ProjectStatus> = {
  ACTIVE: "active",
  PLANNING: "planning",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
};

const apiTaskStatusMap: Record<TaskApiStatus, TaskStatus> = {
  BACKLOG: "backlog",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
};

const apiTaskPriorityMap: Record<TaskApiPriority, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

const taskStatusLabelKey: Record<TaskApiStatus, TKey> = {
  BACKLOG: "board.backlog",
  TODO: "board.todo",
  IN_PROGRESS: "board.inProgress",
  REVIEW: "board.review",
  DONE: "board.done",
};

const taskPriorityLabelKey: Record<TaskApiPriority, TKey> = {
  LOW: "tasks.priorityLow",
  MEDIUM: "tasks.priorityMedium",
  HIGH: "tasks.priorityHigh",
  URGENT: "tasks.priorityUrgent",
};

const taskStatusTone: Record<TaskApiStatus, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  TODO: "bg-info/15 text-info",
  IN_PROGRESS: "bg-primary/15 text-primary",
  REVIEW: "bg-warning/20 text-warning-foreground",
  DONE: "bg-success/15 text-success",
};

const taskPriorityTone: Record<TaskApiPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-info/15 text-info",
  HIGH: "bg-warning/20 text-warning-foreground",
  URGENT: "bg-destructive/15 text-destructive",
};

function ProjectDetailPage() {
  const { t, lang } = useI18n();
  const { data: me } = useCurrentUser();
  const workspaceId = me?.workspace?.id ?? null;
  const canManageProjects = isWorkspaceManager(me?.workspace?.role);
  const { projectId } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const isLoading = projectsQuery.isLoading || tasksQuery.isLoading;
  const isError = projectsQuery.isError || tasksQuery.isError;
  const error = (projectsQuery.error ?? tasksQuery.error) as Error | null;

  const apiProjects = projectsQuery.data ?? [];
  const apiTasks = tasksQuery.data ?? [];

  const project = apiProjects.find((p) => p.id === projectId) ?? null;
  const projectTasks = apiTasks.filter((t) => t.projectId === projectId);

  const updateProjectMutation = useMutation({
    mutationFn: (input: {
      projectId: string;
      name: string;
      description: string;
      status: ProjectApiStatus;
      dueDate: string | null;
    }) =>
      updateProject(input.projectId, {
        name: input.name,
        description: input.description,
        status: input.status,
        dueDate: input.dueDate,
      }),
    onSuccess: async () => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      toast.success(t("projects.toast.updated"));
    },
    onError: () => {
      toast.error(t("projects.toast.updateFailed"));
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      toast.success(t("projects.toast.deleted"));
      await router.navigate({ to: "/app/projects" });
    },
    onError: () => {
      toast.error(t("projects.toast.deleteFailed"));
    },
  });

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

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      await invalidateWorkspaceContentQueries(queryClient, workspaceId);
      setSelectedTask(null);
      toast.success(t("tasks.deleted"));
    },
    onError: () => {
      toast.error(t("tasks.deleteFailed"));
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
      setSelectedTask((prev) => {
        if (!prev || prev.id !== updated.id) return prev;
        return mapApiTaskToTask(updated, t);
      });
      toast.success(t("tasks.updated"));
    },
    onError: () => {
      toast.error(t("tasks.updateFailed"));
    },
  });

  const selectedAssignees = useMemo(
    () => (selectedTask ? resolveTaskAssignees(apiTasks, selectedTask.id) : []),
    [selectedTask, apiTasks],
  );

  async function handleCreateTask(values: TaskFormValues) {
    await createTaskMutation.mutateAsync({
      projectId,
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
        breadcrumbs={[
          { label: t("projects.projects"), to: "/app/projects" },
          {
            label: isLoading
              ? t("projects.detail.loading")
              : project
                ? displayProjectName(project.name, lang)
                : t("projects.projects"),
          },
        ]}
        title={
          isLoading
            ? t("projects.detail.loading")
            : project
              ? displayProjectName(project.name, lang)
              : t("projects.projects")
        }
        subtitle={isLoading ? t("projects.detail.fetching") : t("projects.detail.headerSubtitle")}
        actions={
          project && canManageProjects ? (
            <div className="flex items-center gap-2">
              <EditProjectDialog
                project={project}
                isSubmitting={updateProjectMutation.isPending}
                onSubmit={async (values) => {
                  await updateProjectMutation.mutateAsync({
                    projectId: project.id,
                    ...values,
                  });
                }}
              />
              <DeleteProjectDialog
                projectName={displayProjectName(project.name, lang)}
                isSubmitting={deleteProjectMutation.isPending}
                onConfirm={async () => {
                  await deleteProjectMutation.mutateAsync(project.id);
                }}
              />
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ApiErrorState
          title={t("projects.detail.loadErrorTitle")}
          error={error}
          onRetry={() => {
            void projectsQuery.refetch();
            void tasksQuery.refetch();
          }}
        />
      ) : !project ? (
        <NotFoundState />
      ) : (
        <ProjectDetails
          project={project}
          projectTasks={projectTasks}
          isCreatingTask={createTaskMutation.isPending}
          onCreateTask={handleCreateTask}
          onOpenTask={(task) => setSelectedTask(mapApiTaskToTask(task, t))}
          canManageMembers={canManageProjects}
        />
      )}

      <TaskDrawer
        task={selectedTask}
        assignees={selectedAssignees}
        onSaveChanges={({ title, assigneeIds, dueDate, status, priority }) => {
          if (!selectedTask || updateAssigneeMutation.isPending) return;
          updateAssigneeMutation.mutate({
            id: selectedTask.id,
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
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
        isDeleting={deleteTaskMutation.isPending}
      />
    </AppShell>
  );
}

function EditProjectDialog({
  project,
  isSubmitting,
  onSubmit,
}: {
  project: ProjectApiItem;
  isSubmitting: boolean;
  onSubmit: (values: {
    name: string;
    description: string;
    status: ProjectApiStatus;
    dueDate: string | null;
  }) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  const initial = useMemo(() => {
    const dueParts = splitLocalDateTime(project.dueDate);
    return {
      name: displayProjectName(project.name, lang),
      description: displayProjectDescription(project.description ?? "", lang),
      status: project.status,
      dueDate: dueParts.date,
      dueTime: dueParts.time,
    };
  }, [lang, project.description, project.dueDate, project.name, project.status]);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState<ProjectApiStatus>(initial.status);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [dueTime, setDueTime] = useState(initial.dueTime);
  const [dueDateTimeError, setDueDateTimeError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setDescription(initial.description);
    setStatus(initial.status);
    setDueDate(initial.dueDate);
    setDueTime(initial.dueTime);
    setDueDateTimeError(null);
  }, [initial.description, initial.dueDate, initial.dueTime, initial.name, initial.status, open]);

  const isValid = name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("common.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("projects.detail.editProject")}</DialogTitle>
          <DialogDescription>{t("projects.detail.editProjectDesc")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const hasDate = Boolean(dueDate.trim());
            const hasTime = Boolean(dueTime.trim());
            if (hasDate !== hasTime) {
              setDueDateTimeError(
                hasDate ? t("validation.dueTimeRequired") : t("validation.dueDateRequired"),
              );
              return;
            }
            setDueDateTimeError(null);
            void onSubmit({
              name: name.trim(),
              description: description.trim(),
              status,
              dueDate:
                hasDate && hasTime
                  ? combineLocalDateAndTime(dueDate.trim(), dueTime.trim())
                  : null,
            }).then(() => setOpen(false));
          }}
        >
          <div className="space-y-1.5">
            <Label>{t("projects.form.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projects.new.projectName")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("projects.form.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projects.new.description")}
            />
          </div>
          <div className={deadlineStatusDateTimeRowClassName}>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="block h-4 leading-none">{t("projects.detail.status")}</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ProjectApiStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("projects.detail.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNING">{projectApiStatusLabel("PLANNING", t)}</SelectItem>
                  <SelectItem value="ACTIVE">{projectApiStatusLabel("ACTIVE", t)}</SelectItem>
                  <SelectItem value="ON_HOLD">{projectApiStatusLabel("ON_HOLD", t)}</SelectItem>
                  <SelectItem value="COMPLETED">{projectApiStatusLabel("COMPLETED", t)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="block h-4 leading-none">{t("projects.detail.dueDate")}</Label>
              <DeadlineDatePicker
                value={dueDate}
                aria-label={t("projects.detail.dueDate")}
                onChange={(next) => {
                  setDueDate(next);
                  setDueDateTimeError(null);
                }}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="block h-4 leading-none whitespace-nowrap">
                {t("projects.detail.dueTime")}
              </Label>
              <DeadlineTimePicker
                value={dueTime}
                aria-label={t("projects.detail.dueTime")}
                onChange={(next) => {
                  setDueTime(next);
                  setDueDateTimeError(null);
                }}
              />
            </div>
          </div>
          {dueDateTimeError ? (
            <p className="text-xs text-destructive">{dueDateTimeError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
            >
              {isSubmitting ? t("settings.saving") : t("common.saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  projectName,
  isSubmitting,
  onConfirm,
}: {
  projectName: string;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isSubmitting}>
          {t("common.delete")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("projects.detail.deleteProject")}</DialogTitle>
          <DialogDescription>
            {t("projects.detail.deleteProjectDesc").replace("{name}", projectName)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => {
              void onConfirm().then(() => setOpen(false));
            }}
          >
            {isSubmitting ? t("projects.detail.deleting") : t("projects.detail.deleteProject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDetails({
  project,
  projectTasks,
  isCreatingTask,
  onCreateTask,
  onOpenTask,
  canManageMembers,
}: {
  project: ProjectApiItem;
  projectTasks: TaskApiItem[];
  isCreatingTask: boolean;
  onCreateTask: (values: TaskFormValues) => Promise<void>;
  onOpenTask: (task: TaskApiItem) => void;
  canManageMembers: boolean;
}) {
  const { t, lang } = useI18n();
  const statusKey = apiStatusMap[project.status];
  const statusMeta = projectStatusMeta[statusKey];
  const statusLabel = projectStatusLabel(statusKey, t);
  const due = formatDueDateTime(project.dueDate);
  const progress = calculateTaskProgress(projectTasks);
  const colorGradient = resolveProjectGradient(project);
  const sortedTasks = useMemo(() => sortProjectTasks(projectTasks), [projectTasks]);
  const localizedProjectName = displayProjectName(project.name, lang);
  const localizedProjectDescription = project.description?.trim()
    ? displayProjectDescription(project.description, lang)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className={"h-2 w-16 rounded-full bg-gradient-to-r " + colorGradient} />
                <h2 className="mt-4 truncate text-xl font-semibold tracking-tight">
                  {localizedProjectName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {localizedProjectDescription ?? t("projects.detail.noDescription")}
                </p>
              </div>
              <Badge variant="secondary" className={statusMeta.className + " border-0 shrink-0"}>
                {statusLabel}
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label={t("projects.detail.status")} value={statusLabel} />
              <Stat
                label={t("projects.detail.dueDate")}
                value={
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5 text-muted-foreground" /> {due}
                  </span>
                }
              />
              <Stat
                label={t("projects.detail.tasksLabel")}
                value={
                  <span className="inline-flex items-center gap-1">
                    <ListTodo className="size-3.5 text-muted-foreground" />
                    {t("projects.detail.tasksDoneTotal")
                      .replace("{done}", String(progress.done))
                      .replace("{total}", String(progress.total))}
                  </span>
                }
              />
            </div>

            {canManageMembers ? (
              <p className="mt-4 text-xs text-muted-foreground">{t("projects.detail.editHint")}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{t("projects.detail.taskProgress")}</h3>
                <p className="text-xs text-muted-foreground">
                  {progress.total === 0
                    ? t("projects.detail.noTasksYet")
                    : t("projects.detail.tasksCompleted")
                        .replace("{done}", String(progress.done))
                        .replace("{total}", String(progress.total))}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {progress.total === 0 ? "0%" : `${progress.percent}%`}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={"h-full rounded-full bg-gradient-to-r transition-all " + colorGradient}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          <ProjectMembersCard projectId={project.id} canManageMembers={canManageMembers} />

          <ProjectDocumentsCard projectId={project.id} />
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft lg:row-span-1">
          <div className="flex shrink-0 items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">{t("projects.detail.projectTasks")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {projectTasks.length === 0
                  ? t("projects.detail.createFirstTask")
                  : projectTasks.length === 1
                    ? t("projects.detail.taskCountOne")
                    : t("projects.detail.taskCount").replace(
                        "{count}",
                        String(projectTasks.length),
                      )}
              </p>
            </div>
            {sortedTasks.length > 0 ? (
              <NewTaskDialog
                isSubmitting={isCreatingTask}
                fixedProjectId={project.id}
                onSubmit={onCreateTask}
              >
                <Button size="sm" variant="brand" className="h-8 shrink-0 gap-1">
                  <Plus className="size-3.5" />
                  {t("common.newTask")}
                </Button>
              </NewTaskDialog>
            ) : null}
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
            {sortedTasks.length === 0 ? (
              <EmptyState
                compact
                className="border-0 bg-transparent shadow-none"
                icon={ListTodo}
                title={t("projects.detail.emptyTasksTitle")}
                description={t("projects.detail.emptyTasksHint")}
                primaryAction={
                  <NewTaskDialog
                    isSubmitting={isCreatingTask}
                    fixedProjectId={project.id}
                    onSubmit={onCreateTask}
                  >
                    <Button size="sm" variant="brand" className="h-8 gap-1">
                      <Plus className="size-3.5" />
                      {t("common.newTask")}
                    </Button>
                  </NewTaskDialog>
                }
              />
            ) : (
              <ul className="app-scrollbar max-h-[min(70vh,32rem)] divide-y divide-border overflow-y-auto overscroll-contain">
                {sortedTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                      onClick={() => onOpenTask(task)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {task.key}
                          </span>
                          <span className="truncate text-sm font-medium">
                            {displayTaskTitle(task.title, lang)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={taskStatusTone[task.status] + " border-0 capitalize"}
                          >
                            {t(taskStatusLabelKey[task.status])}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={taskPriorityTone[task.priority] + " border-0 capitalize"}
                          >
                            {t(taskPriorityLabelKey[task.priority])}
                          </Badge>
                          {task.dueDate ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="size-3" />
                              {formatDueDateTimeShort(task.dueDate)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <AssigneeAvatars
                          assignees={
                            task.assignees.length > 0
                              ? task.assignees.map((assignee) => ({
                                  id: assignee.id,
                                  name: assignee.name,
                                  email: assignee.email,
                                  avatar: initialsFromName(assignee.name),
                                  avatarUrl: assignee.avatarUrl ?? null,
                                }))
                              : []
                          }
                          showUnassignedLabel
                          maxVisible={2}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectMembersCard({
  projectId,
  canManageMembers,
}: {
  projectId: string;
  canManageMembers: boolean;
}) {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
  });

  const availableQuery = useQuery({
    queryKey: ["project-available-members", projectId],
    queryFn: () => fetchAvailableProjectMembers(projectId),
    enabled: canManageMembers && addDialogOpen,
  });

  const addMutation = useMutation({
    mutationFn: (userId: string) => addProjectMember(projectId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      await queryClient.invalidateQueries({
        queryKey: ["project-available-members", projectId],
      });
      invalidateNotifications(queryClient);
      toast.success(t("projects.detail.memberAdded"));
      setAddDialogOpen(false);
    },
    onError: () => {
      toast.error(t("projects.detail.memberAddFailed"));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeProjectMember(projectId, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      await queryClient.invalidateQueries({
        queryKey: ["project-available-members", projectId],
      });
      toast.success(t("projects.detail.memberRemoved"));
    },
    onError: () => {
      toast.error(t("projects.detail.memberRemoveFailed"));
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <ProjectMembersSection
        members={membersQuery.data ?? []}
        availableMembers={availableQuery.data ?? []}
        isLoading={membersQuery.isLoading}
        isError={membersQuery.isError}
        isLoadingAvailable={availableQuery.isLoading}
        isAdding={addMutation.isPending}
        isRemovingId={removeMutation.isPending ? (removeMutation.variables ?? null) : null}
        addDialogOpen={addDialogOpen}
        onAddDialogOpenChange={setAddDialogOpen}
        canManageMembers={canManageMembers}
        onAddMember={(userId) => {
          if (addMutation.isPending) return;
          addMutation.mutate(userId);
        }}
        onRemoveMember={(memberId) => {
          if (removeMutation.isPending) return;
          removeMutation.mutate(memberId);
        }}
      />
    </div>
  );
}

function AddProjectMemberDialog({
  open,
  onOpenChange,
  availableMembers,
  isLoadingAvailable,
  isAdding,
  onAddMember,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableMembers: AvailableProjectMember[];
  isLoadingAvailable: boolean;
  isAdding: boolean;
  onAddMember: (userId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base">{t("projects.detail.addMemberTitle")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("projects.detail.addMemberDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto p-2">
          {isLoadingAvailable ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : availableMembers.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("projects.detail.allMembersAssigned")}
            </p>
          ) : (
            <ul className="space-y-1">
              {availableMembers.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    disabled={isAdding}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                    onClick={() => onAddMember(user.id)}
                  >
                    <UserAvatar
                      id={user.id}
                      name={user.name}
                      avatar={initialsFromName(user.name)}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{user.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                    <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectMembersSection({
  members,
  availableMembers,
  isLoading,
  isError,
  isLoadingAvailable,
  isAdding,
  isRemovingId,
  addDialogOpen,
  onAddDialogOpenChange,
  onAddMember,
  onRemoveMember,
  canManageMembers,
}: {
  members: ProjectMemberApiItem[];
  availableMembers: AvailableProjectMember[];
  isLoading: boolean;
  isError: boolean;
  isLoadingAvailable: boolean;
  isAdding: boolean;
  isRemovingId: string | null;
  addDialogOpen: boolean;
  onAddDialogOpenChange: (open: boolean) => void;
  onAddMember: (userId: string) => void;
  onRemoveMember: (memberId: string) => void;
  canManageMembers: boolean;
}) {
  const { t } = useI18n();
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Users className="size-4 text-muted-foreground" />
            {t("projects.detail.members")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("projects.detail.membersHint")}</p>
        </div>
        {canManageMembers && members.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="brand"
            className="h-8 gap-1.5"
            onClick={() => onAddDialogOpenChange(true)}
          >
            <UserPlus className="size-3.5" />
            {t("projects.detail.addMember")}
          </Button>
        ) : null}
      </div>
      {canManageMembers ? (
        <AddProjectMemberDialog
          open={addDialogOpen}
          onOpenChange={onAddDialogOpenChange}
          availableMembers={availableMembers}
          isLoadingAvailable={isLoadingAvailable}
          isAdding={isAdding}
          onAddMember={onAddMember}
        />
      ) : null}
      <div className="space-y-2">
        {isLoading ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {t("projects.detail.loadingMembers")}
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-6 text-center text-sm text-destructive">
            {t("projects.detail.membersError")}
          </p>
        ) : members.length === 0 ? (
          <EmptyState
            compact
            className="border-0 bg-transparent shadow-none"
            icon={Users}
            title={t("projects.detail.emptyMembersTitle")}
            description={t("projects.detail.emptyMembersHint")}
            primaryAction={
              canManageMembers ? (
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  className="h-8 gap-1.5"
                  onClick={() => onAddDialogOpenChange(true)}
                >
                  <UserPlus className="size-3.5" />
                  {t("projects.detail.addMember")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          members.map((member) => (
            <ProjectMemberRow
              key={member.id}
              member={member}
              isRemoving={isRemovingId === member.id}
              canRemove={canManageMembers}
              onRemove={() => onRemoveMember(member.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ProjectMemberRow({
  member,
  isRemoving,
  canRemove,
  onRemove,
}: {
  member: ProjectMemberApiItem;
  isRemoving: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/10 px-2.5 py-2">
      <UserAvatar
        id={member.user.id}
        name={member.user.name}
        avatar={initialsFromName(member.user.name)}
        avatarUrl={member.user.avatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{member.user.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{member.user.email}</div>
      </div>
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={isRemoving}
          aria-label={`Remove ${member.user.name}`}
          onClick={onRemove}
        >
          {isRemoving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

function ProjectDocumentsCard({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentsQuery = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => fetchProjectDocuments(projectId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProjectDocument(projectId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      invalidateNotifications(queryClient);
      toast.success(t("projects.detail.documentUploaded"));
    },
    onError: (mutationError) => {
      toast.error(friendlyUploadErrorMessage(mutationError, t));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteProjectDocument(projectId, documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success(t("projects.detail.documentDeleted"));
    },
    onError: () => {
      toast.error(t("projects.detail.documentDeleteFailed"));
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <ProjectDocumentsSection
        documents={documentsQuery.data ?? []}
        isLoading={documentsQuery.isLoading}
        isError={documentsQuery.isError}
        isUploading={uploadMutation.isPending}
        isDeletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
        fileInputRef={fileInputRef}
        onPickFile={() => fileInputRef.current?.click()}
        onFileSelected={(file) => {
          if (uploadMutation.isPending) return;
          if (!projectId.trim()) {
            toast.error(t("projects.notReady"));
            return;
          }
          if (!(file instanceof File) || !file.size) {
            toast.error(t("uploads.selectFile"));
            return;
          }
          if (isUploadFileTooLarge(file)) {
            toast.error(t("uploads.fileTooLarge"));
            return;
          }
          uploadMutation.mutate(file);
        }}
        onOpen={(document) => {
          openProjectDocument(document).catch(() => {
            toast.error(t("uploads.fileOpenLegacy"));
          });
        }}
        onDownload={(document) => {
          downloadProjectDocumentFile(document).catch(() => {
            toast.error(t("uploads.fileDownloadLegacy"));
          });
        }}
        onDelete={(documentId) => {
          if (deleteMutation.isPending) {
            return Promise.reject(new Error("Delete already in progress"));
          }
          return deleteMutation.mutateAsync(documentId);
        }}
      />
    </div>
  );
}

function ProjectDocumentsSection({
  documents,
  isLoading,
  isError,
  isUploading,
  isDeletingId,
  fileInputRef,
  onPickFile,
  onFileSelected,
  onOpen,
  onDownload,
  onDelete,
}: {
  documents: ProjectDocumentApiItem[];
  isLoading: boolean;
  isError: boolean;
  isUploading: boolean;
  isDeletingId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: () => void;
  onFileSelected: (file: File) => void;
  onOpen: (document: ProjectDocumentApiItem) => void;
  onDownload: (document: ProjectDocumentApiItem) => void;
  onDelete: (documentId: string) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const isDeletingSelected = documentToDelete != null && isDeletingId === documentToDelete;

  async function handleConfirmDelete() {
    if (!documentToDelete || isDeletingSelected) return;
    try {
      await onDelete(documentToDelete);
      setDocumentToDelete(null);
    } catch {
      // Toast is shown by the parent mutation.
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-muted-foreground" />
            {t("projects.detail.documentsTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("projects.detail.documentsSubtitle")}
          </p>
        </div>
        {!isLoading && !isError && documents.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="brand"
            className="h-8 gap-1.5"
            disabled={isUploading}
            onClick={onPickFile}
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {isUploading ? t("common.loading") : t("projects.detail.uploadDocument")}
          </Button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          disabled={isUploading}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,application/pdf,image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              onFileSelected(file);
            }
          }}
        />
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {t("projects.detail.documentsLoading")}
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-6 text-center text-sm text-destructive">
            {t("projects.detail.documentsError")}
          </p>
        ) : documents.length === 0 ? (
          <EmptyState
            compact
            className="border-0 bg-transparent shadow-none"
            icon={FileText}
            title={t("projects.detail.emptyDocumentsTitle")}
            description={t("projects.detail.emptyDocumentsHint")}
            primaryAction={
              <Button
                type="button"
                size="sm"
                variant="brand"
                className="h-8 gap-1.5"
                disabled={isUploading}
                onClick={onPickFile}
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {isUploading ? t("common.loading") : t("projects.detail.uploadDocument")}
              </Button>
            }
          />
        ) : (
          <div className="app-scrollbar max-h-[min(50vh,16rem)] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {isUploading ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-2.5 py-2">
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t("uploads.uploadingFile")}</span>
              </div>
            ) : null}
            {documents.map((document) => (
              <ProjectDocumentRow
                key={document.id}
                document={document}
                isDeleting={isDeletingId === document.id}
                onOpen={() => onOpen(document)}
                onDownload={() => onDownload(document)}
                onRequestDelete={() => setDocumentToDelete(document.id)}
              />
            ))}
          </div>
        )}
      </div>
      <AlertDialog
        open={documentToDelete != null}
        onOpenChange={(open) => {
          if (!open && !isDeletingSelected) {
            setDocumentToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-sm gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("projects.detail.deleteDocumentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("projects.detail.deleteDocumentDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSelected}>{t("common.cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={isDeletingSelected}
              onClick={() => void handleConfirmDelete()}
            >
              <Trash2 className="size-4" />
              {isDeletingSelected
                ? t("projects.detail.deleting")
                : t("projects.detail.deleteDocumentConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ProjectDocumentPreview({
  document,
  onDownload,
}: {
  document: ProjectDocumentApiItem;
  onDownload: () => void;
}) {
  const badge = getProjectDocumentFileTypeBadge(document.originalName, document.mimeType);
  const previewClassName =
    "size-9 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary";

  return (
    <AuthenticatedImagePreview
      downloadUrl={document.downloadUrl || document.url}
      filename={document.originalName}
      mimeType={document.mimeType}
      className={previewClassName}
      imageClassName="size-full"
      objectFit="cover"
      fetchBlob={() => fetchProjectDocumentBlob(document)}
      onDownload={onDownload}
      fallback={
        <div
          className={cn(
            previewClassName,
            "grid place-items-center text-[10px] font-semibold text-muted-foreground",
          )}
        >
          {badge}
        </div>
      }
    />
  );
}

function ProjectDocumentRow({
  document,
  isDeleting,
  onOpen,
  onDownload,
  onRequestDelete,
}: {
  document: ProjectDocumentApiItem;
  isDeleting: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onRequestDelete: () => void;
}) {
  const { t } = useI18n();
  const { openLightbox } = useAuthenticatedImageLightbox();
  const isImage = isImageProjectDocument(document);

  function handleOpen() {
    if (isImage) {
      openLightbox({
        downloadUrl: document.downloadUrl || document.url,
        filename: document.originalName,
        onDownload: () => onDownload(),
      });
      return;
    }
    onOpen();
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/10 px-2.5 py-2">
      <ProjectDocumentPreview document={document} onDownload={() => onDownload()} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{document.originalName}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{formatDocumentSize(document.size)}</span>
          <span>·</span>
          <span>{formatDocumentDate(document.createdAt)}</span>
          <span>·</span>
          <span>{document.uploader.name}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          disabled={isDeleting}
          aria-label={isImage ? t("files.viewImage").replace("{name}", document.originalName) : t("files.openDocument")}
          onClick={handleOpen}
        >
          <ExternalLink className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          disabled={isDeleting}
          aria-label={t("files.downloadDocument")}
          onClick={onDownload}
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          disabled={isDeleting}
          aria-label={t("projects.detail.deleteDocumentAria")}
          onClick={onRequestDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function formatDocumentDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2">
        <Skeleton className="h-2 w-16 rounded-full" />
        <Skeleton className="mt-4 h-6 w-2/3" />
        <Skeleton className="mt-2 h-4 w-full" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="mt-2 h-3 w-48" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t("projects.detail.notFoundTitle")}
      description={t("access.projectDenied")}
      primaryAction={
        <Button variant="outline" asChild>
          <Link to="/app/projects">{t("projects.back")}</Link>
        </Button>
      }
    />
  );
}

const taskPriorityRank: Record<TaskApiPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function compareTaskDueDates(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function sortProjectTasks(tasks: TaskApiItem[]) {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === "DONE";
    const bDone = b.status === "DONE";
    if (aDone !== bDone) {
      return aDone ? 1 : -1;
    }

    const priorityDiff = taskPriorityRank[a.priority] - taskPriorityRank[b.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const dueDiff = compareTaskDueDates(a.dueDate, b.dueDate);
    if (dueDiff !== 0) {
      return dueDiff;
    }

    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

function calculateTaskProgress(tasks: TaskApiItem[]) {
  const total = tasks.length;
  if (total === 0) {
    return { percent: 0, done: 0, total: 0 };
  }
  const done = tasks.filter((task) => task.status === "DONE").length;
  const percent = Math.round((done / total) * 100);
  return { percent, done, total };
}

function mapApiTaskToTask(task: TaskApiItem, t: (k: TKey) => string): Task {
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    description: task.description ?? "",
    status: apiTaskStatusMap[task.status],
    priority: apiTaskPriorityMap[task.priority],
    assigneeIds: task.assigneeIds,
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    dueDate: task.dueDate,
    labels: [task.project.name],
    comments: [],
    commentsCount: task.commentsCount,
    attachmentsCount: task.attachmentsCount,
    checklist: Array.from({ length: task.checklistTotal }, (_, index) => ({
      id: `${task.id}-checklist-${index}`,
      label: t("tasks.checklistItem").replace("{n}", String(index + 1)),
      done: index < task.checklistDone,
    })),
    activity: [],
    attachments: [],
  };
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
