import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssigneeAvatars } from "@/components/app/AssigneeAvatars";
import { AssigneeMultiPicker } from "@/components/app/AssigneeMultiPicker";
import { TaskStatusIndicator } from "@/components/app/TaskStatusIndicator";
import { TaskPriorityIndicator } from "@/components/app/TaskPriorityIndicator";
import { AuthenticatedImagePreview } from "@/components/app/files/AuthenticatedImagePreview";
import { useAuthenticatedImageLightbox } from "@/components/app/files/AuthenticatedImageLightbox";
import { FilePreparationStatus } from "@/components/app/files/FilePreparationStatus";
import { DeadlineDatePicker } from "@/components/app/DeadlineDatePicker";
import { DeadlineTimePicker } from "@/components/app/DeadlineTimePicker";
import {
  acquireAuthenticatedBlobUrl,
  getAuthenticatedBlobObjectUrl,
  releaseAuthenticatedBlobUrl,
} from "@/hooks/use-authenticated-blob-url";
import { useOnDemandFilePreparation } from "@/hooks/use-on-demand-file-preparation";
import { fetchProjectMembers } from "@/lib/api/project-members";
import { fetchProjects } from "@/lib/api/projects";
import { fetchWorkspaceMembers } from "@/lib/api/workspace-members";
import {
  enrichAssigneeOptionsWithAvatars,
  resolveEditAssigneeOptions,
  type AssigneeOption,
} from "@/lib/assignee-options";
import { invalidateNotifications } from "@/lib/api/notifications";
import {
  deleteTaskAttachment,
  downloadTaskAttachmentFile,
  fetchTaskAttachmentBlob,
  fetchTaskAttachments,
  formatAttachmentSize,
  getAttachmentFileTypeBadge,
  invalidateTaskAttachmentBlobCache,
  isImageAttachment,
  openTaskAttachment,
  uploadTaskAttachment,
  type TaskAttachmentApiItem,
} from "@/lib/api/task-attachments";
import { friendlyApiErrorMessage } from "@/lib/api-error";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { priorityLabel, taskStatusLabel, useI18n } from "@/lib/i18n";
import {
  displayProjectName,
  displayTaskDescription,
  displayTaskTitle,
} from "@/lib/starter-content";
import {
  type Priority,
  type Task,
  type TaskStatus,
  priorityMeta,
  statusColumns,
} from "@/lib/mock-data";
import { getProjectAccent } from "@/lib/project-color";
import { EmptyState } from "@/components/app/EmptyState";
import { friendlyUploadErrorMessage } from "@/lib/upload-errors";
import { isUploadFileTooLarge } from "@/lib/upload-limits";
import {
  Calendar,
  Flag,
  User as UserIcon,
  CircleDot,
  Paperclip,
  Check,
  Trash2,
  Pencil,
  Download,
  ExternalLink,
  Loader2,
  Upload,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { combineLocalDateAndTime, formatDueDateTime, splitLocalDateTime } from "@/lib/due-datetime";

export type TaskDrawerUpdates = {
  title: string;
  assigneeIds: string[];
  dueDate: string | null;
  status: TaskStatus;
  priority: Priority;
};

function sameAssigneeIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

export function TaskDrawer({
  task,
  assignees = [],
  onOpenChange,
  onSaveChanges,
  isSaving = false,
  onSaveDescription,
  isSavingDescription = false,
  onDelete,
  isDeleting = false,
}: {
  task: Task | null;
  assignees?: AssigneeOption[];
  onOpenChange: (open: boolean) => void;
  onSaveChanges?: (updates: TaskDrawerUpdates) => void;
  isSaving?: boolean;
  onSaveDescription?: (description: string | null) => void | Promise<void>;
  isSavingDescription?: boolean;
  onDelete?: (taskId: string) => void;
  isDeleting?: boolean;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>([]);
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftDueTime, setDraftDueTime] = useState("");
  const [draftStatus, setDraftStatus] = useState<TaskStatus>("backlog");
  const [draftPriority, setDraftPriority] = useState<Priority>("medium");
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [dueDateTimeError, setDueDateTimeError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEditorRef = useRef<HTMLDivElement>(null);
  const saveChangesButtonRef = useRef<HTMLButtonElement>(null);
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const displayedTaskTitle = task ? displayTaskTitle(task.title, lang) : "";

  useLayoutEffect(() => {
    if (!task?.id) {
      setDraftTitle("");
      setDraftAssigneeIds([]);
      setDraftDueDate("");
      setDraftDueTime("");
      setDraftStatus("backlog");
      setDraftPriority("medium");
      setDueDateTimeError(null);
      setEditingTitle(false);
      setEditingDescription(false);
      setDraftDescription("");
      return;
    }
    const dueParts = splitLocalDateTime(task.dueDate);
    setDraftTitle(displayTaskTitle(task.title, lang));
    setDraftAssigneeIds(task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []));
    setDraftDueDate(dueParts.date);
    setDraftDueTime(dueParts.time);
    setDraftStatus(task.status);
    setDraftPriority(task.priority);
    setDueDateTimeError(null);
    setEditingTitle(false);
    setEditingDescription(false);
    setDraftDescription(displayTaskDescription(task.description, lang));
  }, [
    lang,
    task?.assigneeId,
    task?.assigneeIds,
    task?.description,
    task?.dueDate,
    task?.id,
    task?.priority,
    task?.status,
    task?.title,
  ]);

  useEffect(() => {
    if (!task) {
      setDeleteTaskOpen(false);
    }
  }, [task]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (!editingTitle) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        titleEditorRef.current?.contains(target) ||
        saveChangesButtonRef.current?.contains(target)
      ) {
        return;
      }

      setDraftTitle(displayedTaskTitle);
      setEditingTitle(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [displayedTaskTitle, editingTitle]);

  const attachmentsQuery = useQuery({
    queryKey: ["task-attachments", task?.id],
    queryFn: () => fetchTaskAttachments(task!.id),
    enabled: !!task?.id,
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => {
      if (!task?.id) {
        throw new Error(t("tasks.notReady"));
      }
      return uploadTaskAttachment(task.id, file);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task-attachments", task!.id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      invalidateNotifications(queryClient);
      toast.success(t("tasks.attachmentUploaded"));
    },
    onError: (mutationError) => {
      toast.error(friendlyUploadErrorMessage(mutationError, t));
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteTaskAttachment(task!.id, attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task-attachments", task!.id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(t("tasks.attachmentDeleted"));
    },
    onError: () => {
      toast.error(t("tasks.attachmentDeleteFailed"));
    },
  });

  const projectMembersQuery = useQuery({
    queryKey: ["project-members", task?.projectId],
    queryFn: () => fetchProjectMembers(task!.projectId),
    enabled: !!task?.projectId,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: !!task?.projectId,
  });

  const workspaceMembersQuery = useQuery({
    queryKey: ["workspace-members"],
    queryFn: fetchWorkspaceMembers,
    enabled: !!task?.projectId,
  });

  const resolvedAssigneeOptions = useMemo(() => {
    const base = resolveEditAssigneeOptions(
      projectMembersQuery.data,
      workspaceMembersQuery.data,
      assignees,
    );
    const memberUsers = [
      ...(workspaceMembersQuery.data ?? []),
      ...(projectMembersQuery.data ?? []).map((member) => member.user),
    ];
    const authUser = me?.user
      ? [
          {
            id: me.user.id,
            name: me.user.name,
            avatarUrl: me.user.avatarUrl,
          },
        ]
      : [];
    return enrichAssigneeOptionsWithAvatars(base, assignees, memberUsers, authUser);
  }, [assignees, me?.user, projectMembersQuery.data, workspaceMembersQuery.data]);

  const assigneeOptionsLoading =
    projectMembersQuery.isLoading ||
    ((projectMembersQuery.data?.length ?? 0) === 0 && workspaceMembersQuery.isLoading);

  if (!task) return null;

  const savedAssigneeIds = task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []);
  const canEditTask = !!onSaveChanges;
  const canEditAssignees = canEditTask;
  const canEditDescription = !!onSaveDescription;
  const initialDueParts = splitLocalDateTime(task.dueDate);
  const hasTitleChanges = draftTitle.trim() !== displayedTaskTitle.trim();
  const hasAssigneeChanges = !sameAssigneeIds(draftAssigneeIds, savedAssigneeIds);
  const hasDueDateChanges =
    draftDueDate !== initialDueParts.date || draftDueTime !== initialDueParts.time;
  const hasStatusChanges = draftStatus !== task.status;
  const hasPriorityChanges = draftPriority !== task.priority;
  const hasChanges =
    hasTitleChanges ||
    hasAssigneeChanges ||
    hasDueDateChanges ||
    hasStatusChanges ||
    hasPriorityChanges;
  const canSaveChanges = hasChanges && draftTitle.trim().length >= 2;
  const apiProject = projectsQuery.data?.find((project) => project.id === task.projectId);
  const projectName = apiProject?.name ?? task.labels[0] ?? "";
  const projectAccent = getProjectAccent({
    id: task.projectId,
    name: projectName || "project",
    color: apiProject?.color,
  });
  const statusLabel = taskStatusLabel(task.status, t);
  const descriptionText = displayTaskDescription(task.description, lang).trim();
  const savedDescriptionText = descriptionText;
  const descriptionDraftNormalized = draftDescription.trim();
  const hasDescriptionChanges = descriptionDraftNormalized !== savedDescriptionText;
  const selectedAssigneeOptions = resolvedAssigneeOptions.filter((option) =>
    draftAssigneeIds.includes(option.id),
  );
  const showFooter = canEditTask || !!onDelete;

  async function handleSaveDescription() {
    if (!onSaveDescription || isSavingDescription) return;
    const next = descriptionDraftNormalized.length > 0 ? descriptionDraftNormalized : null;
    try {
      await onSaveDescription(next);
      setEditingDescription(false);
    } catch {
      // Parent shows the API error toast; keep edit mode open.
    }
  }

  function handleCancelDescriptionEdit() {
    if (!task) return;
    setDraftDescription(displayTaskDescription(task.description, lang));
    setEditingDescription(false);
  }

  function handleCancelTitleEdit() {
    if (!task) return;
    setDraftTitle(displayTaskTitle(task.title, lang));
    setEditingTitle(false);
  }

  function handleSaveChanges() {
    if (!onSaveChanges || isSaving) return;
    if (!canSaveChanges) return;

    const hasDate = Boolean(draftDueDate.trim());
    const hasTime = Boolean(draftDueTime.trim());
    if (hasDate !== hasTime) {
      setDueDateTimeError(
        hasDate ? t("validation.dueTimeRequired") : t("validation.dueDateRequired"),
      );
      return;
    }

    setDueDateTimeError(null);
    onSaveChanges({
      title: draftTitle.trim(),
      assigneeIds: draftAssigneeIds,
      dueDate:
        hasDate && hasTime
          ? combineLocalDateAndTime(draftDueDate.trim(), draftDueTime.trim())
          : null,
      status: draftStatus,
      priority: draftPriority,
    });
    setEditingTitle(false);
  }

  return (
    <>
      <Sheet open={!!task} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-dvh w-full min-w-0 max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onOpenAutoFocus={(event) => {
            // Avoid autofocus on the close (X) button so it does not look hovered on open.
            event.preventDefault();
            drawerBodyRef.current?.focus({ preventScroll: true });
          }}
        >
          <div
            ref={drawerBodyRef}
            tabIndex={-1}
            className="app-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-5 pb-4 sm:px-6 sm:pt-6 outline-none"
          >
            <SheetHeader className="space-y-2 border-b border-border pb-4 text-left">
              <div className="flex min-w-0 items-center gap-2 pr-10 text-xs text-muted-foreground sm:pr-8">
                <span className="shrink-0 font-mono">{task.key}</span>
                {projectName ? (
                  <>
                    <span>·</span>
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/35 px-2 py-0.5 font-medium text-foreground/75">
                      <span
                        className={cn("size-1.5 shrink-0 rounded-full", projectAccent.dot)}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">
                        {displayProjectName(projectName, lang)}
                      </span>
                    </span>
                  </>
                ) : null}
              </div>

              {editingTitle && canEditTask ? (
                <div ref={titleEditorRef} className="space-y-1.5">
                  <SheetTitle className="sr-only">{draftTitle || displayedTaskTitle}</SheetTitle>
                  <Input
                    ref={titleInputRef}
                    key={`${task.id}:${lang}:edit`}
                    id="task-drawer-title"
                    value={draftTitle}
                    disabled={isSaving}
                    className="h-10 text-base font-semibold"
                    aria-label={t("tasks.taskTitle")}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        handleCancelTitleEdit();
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="inline-flex max-w-full items-center gap-2 pr-10 sm:pr-8">
                  <SheetTitle className="min-w-0 text-xl leading-snug break-words [overflow-wrap:anywhere]">
                    {displayTaskTitle(canEditTask ? draftTitle || task.title : task.title, lang)}
                  </SheetTitle>
                  {canEditTask ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground lg:size-7"
                      aria-label={t("tasks.editTitle")}
                      disabled={isSaving}
                      onClick={() => {
                        setDraftTitle(displayTaskTitle(task.title, lang));
                        setEditingTitle(true);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              )}

              <SheetDescription className="sr-only">
                {t("tasks.sheetDescription").replace("{key}", task.key)}
              </SheetDescription>
            </SheetHeader>

            <div className="grid min-w-0 gap-5 py-5">
              <aside className="grid min-w-0 w-full gap-3 sm:grid-cols-2">
                <Field icon={CircleDot} label={t("tasks.status")}>
                  {canEditTask ? (
                    <Select
                      key={`${task.id}-status`}
                      value={draftStatus}
                      disabled={isSaving}
                      onValueChange={(value) => setDraftStatus(value as TaskStatus)}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder={t("tasks.status")}>
                          <TaskStatusIndicator status={draftStatus}>
                            {taskStatusLabel(draftStatus, t)}
                          </TaskStatusIndicator>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {statusColumns.map((column) => (
                          <SelectItem key={column.key} value={column.key}>
                            <TaskStatusIndicator status={column.key}>
                              {taskStatusLabel(column.key, t)}
                            </TaskStatusIndicator>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary" className="border-0">
                      <TaskStatusIndicator status={task.status}>{statusLabel}</TaskStatusIndicator>
                    </Badge>
                  )}
                </Field>

                <Field icon={Flag} label={t("tasks.priority")}>
                  {canEditTask ? (
                    <Select
                      key={`${task.id}-priority`}
                      value={draftPriority}
                      disabled={isSaving}
                      onValueChange={(value) => setDraftPriority(value as Priority)}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select priority">
                          <TaskPriorityIndicator priority={draftPriority}>
                            {priorityLabel(draftPriority, t)}
                          </TaskPriorityIndicator>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.entries(priorityMeta) as [
                            Priority,
                            (typeof priorityMeta)[Priority],
                          ][]
                        ).map(([key]) => (
                          <SelectItem key={key} value={key}>
                            <TaskPriorityIndicator priority={key}>
                              {priorityLabel(key, t)}
                            </TaskPriorityIndicator>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary" className="border border-border bg-muted/45">
                      <TaskPriorityIndicator priority={task.priority}>
                        {priorityLabel(task.priority, t)}
                      </TaskPriorityIndicator>
                    </Badge>
                  )}
                </Field>

                <Field icon={UserIcon} label={t("tasks.assignees")}>
                  {canEditAssignees ? (
                    <Popover modal>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-between border-border bg-background px-3 hover:bg-muted/40"
                          disabled={isSaving}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <AssigneeAvatars
                              assignees={selectedAssigneeOptions}
                              showUnassignedLabel
                              maxVisible={3}
                            />
                            {selectedAssigneeOptions.length > 0 ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {selectedAssigneeOptions.length === 1
                                  ? selectedAssigneeOptions[0]?.name
                                  : `${selectedAssigneeOptions.length} ${t("tasks.assignees").toLowerCase()}`}
                              </span>
                            ) : null}
                          </span>
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
                        <AssigneeMultiPicker
                          compact
                          options={resolvedAssigneeOptions}
                          value={draftAssigneeIds}
                          disabled={isSaving}
                          isLoading={assigneeOptionsLoading}
                          onChange={setDraftAssigneeIds}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <AssigneeAvatars assignees={assignees} showUnassignedLabel />
                  )}
                </Field>

                <Field icon={Calendar} label={t("tasks.dueDate")}>
                  {canEditTask ? (
                    <div className="grid w-full gap-2">
                      <div className="grid gap-2 min-[420px]:grid-cols-2">
                        <DeadlineDatePicker
                          disabled={isSaving}
                          value={draftDueDate}
                          aria-label={t("tasks.dueDate")}
                          onChange={(next) => {
                            setDraftDueDate(next);
                            setDueDateTimeError(null);
                          }}
                        />
                        <DeadlineTimePicker
                          disabled={isSaving}
                          value={draftDueTime}
                          aria-label={t("tasks.dueTime")}
                          onChange={(next) => {
                            setDraftDueTime(next);
                            setDueDateTimeError(null);
                          }}
                        />
                      </div>
                      {dueDateTimeError ? (
                        <p className="text-xs leading-4 text-destructive">{dueDateTimeError}</p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm">{formatDueDateTime(task.dueDate)}</span>
                  )}
                </Field>
              </aside>

              <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border/80 bg-card/60 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("tasks.description")}
                  </h3>
                  {canEditDescription && !editingDescription ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 text-muted-foreground hover:text-foreground lg:size-7"
                      aria-label={t("tasks.editDescription")}
                      onClick={() => {
                        setDraftDescription(displayTaskDescription(task.description, lang));
                        setEditingDescription(true);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>

                {editingDescription && canEditDescription ? (
                  <div className="min-w-0 space-y-3">
                    <Textarea
                      id="task-drawer-description"
                      value={draftDescription}
                      disabled={isSavingDescription}
                      rows={5}
                      aria-label={t("tasks.description")}
                      placeholder={t("tasks.descriptionPlaceholder")}
                      className="min-h-[7.5rem] w-full min-w-0 max-w-full resize-y whitespace-pre-wrap break-words text-base leading-relaxed md:text-sm [overflow-wrap:anywhere]"
                      onChange={(event) => setDraftDescription(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          handleCancelDescriptionEdit();
                        }
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="brand"
                        className="h-9 gap-1.5"
                        disabled={isSavingDescription || !hasDescriptionChanges}
                        onClick={() => void handleSaveDescription()}
                      >
                        {isSavingDescription ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            {t("common.saving")}
                          </>
                        ) : (
                          t("common.save")
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9"
                        disabled={isSavingDescription}
                        onClick={handleCancelDescriptionEdit}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : descriptionText ? (
                  <p className="max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
                    {descriptionText}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t("tasks.descriptionEmpty")}
                  </p>
                )}
              </section>

              {task.checklist.length > 0 ? (
                <section className="rounded-xl border border-border/80 bg-card/60 p-3.5">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("tasks.sectionChecklist")}
                  </h3>
                  <ul className="space-y-1.5">
                    {task.checklist.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "grid size-5 place-items-center rounded-md border",
                            c.done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {c.done && <Check className="size-3" />}
                        </span>
                        <span className={cn(c.done && "text-muted-foreground line-through")}>
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <TaskAttachmentsSection
                attachments={attachmentsQuery.data ?? []}
                isLoading={attachmentsQuery.isLoading}
                isError={attachmentsQuery.isError}
                isUploading={uploadAttachmentMutation.isPending}
                isDeletingId={
                  deleteAttachmentMutation.isPending
                    ? (deleteAttachmentMutation.variables ?? null)
                    : null
                }
                fileInputRef={fileInputRef}
                onPickFile={() => fileInputRef.current?.click()}
                onFileSelected={(file) => {
                  if (uploadAttachmentMutation.isPending) return;
                  if (!task?.id) {
                    toast.error(t("tasks.notReady"));
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
                  uploadAttachmentMutation.mutate(file);
                }}
                onOpen={(attachment) => openTaskAttachment(attachment)}
                onDownload={(attachment) => {
                  downloadTaskAttachmentFile(attachment).catch((error) => {
                    toast.error(friendlyApiErrorMessage(error, t, "uploads.fileDownloadLegacy"));
                  });
                }}
                onDelete={(attachmentId) => {
                  if (deleteAttachmentMutation.isPending) {
                    return Promise.reject(new Error("Delete already in progress"));
                  }
                  const target = attachmentsQuery.data?.find((item) => item.id === attachmentId);
                  return deleteAttachmentMutation.mutateAsync(attachmentId).then((result) => {
                    if (target) {
                      invalidateTaskAttachmentBlobCache(target);
                    }
                    return result;
                  });
                }}
              />

              {task.activity.length > 0 ? (
                <section>
                  <ol className="space-y-2 border-l border-border pl-4">
                    {task.activity.map((a) => (
                      <li key={a.id} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                        <div>{a.text}</div>
                        <div className="text-xs text-muted-foreground">{a.at}</div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          </div>

          {showFooter ? (
            <div className="sticky bottom-0 z-10 flex w-full min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6 sm:py-3">
              {onDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isDeleting}
                  onClick={() => setDeleteTaskOpen(true)}
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? t("tasks.deleting") : t("tasks.deleteTask")}
                </Button>
              ) : (
                <span />
              )}
              {canEditTask ? (
                <Button
                  ref={saveChangesButtonRef}
                  type="button"
                  variant="brand"
                  className="h-10 min-w-0 flex-1 sm:min-w-[10.5rem] sm:flex-none"
                  disabled={!canSaveChanges || isSaving}
                  onClick={handleSaveChanges}
                >
                  {isSaving ? t("settings.saving") : t("common.saveChanges")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={deleteTaskOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTaskOpen(false);
          }
        }}
      >
        <AlertDialogContent className="max-w-sm gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks.deleteTaskTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("tasks.deleteTaskDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={isDeleting}
              onClick={() => {
                if (task) {
                  onDelete?.(task.id);
                }
              }}
            >
              <Trash2 className="size-4" />
              {isDeleting ? t("tasks.deleting") : t("tasks.deleteTask")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatAttachmentDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TaskAttachmentsSection({
  attachments,
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
  attachments: TaskAttachmentApiItem[];
  isLoading: boolean;
  isError: boolean;
  isUploading: boolean;
  isDeletingId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: () => void;
  onFileSelected: (file: File) => void;
  onOpen: (attachment: TaskAttachmentApiItem) => void | Promise<void>;
  onDownload: (attachment: TaskAttachmentApiItem) => void;
  onDelete: (attachmentId: string) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);
  const isDeletingSelected = attachmentToDelete != null && isDeletingId === attachmentToDelete;

  async function handleConfirmDelete() {
    if (!attachmentToDelete || isDeletingSelected) return;
    try {
      await onDelete(attachmentToDelete);
      setAttachmentToDelete(null);
    } catch {
      // Toast is shown by the parent mutation.
    }
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border/80 bg-card/60 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="size-3.5" /> {t("tasks.sectionAttachments")}
        </h3>
        {!isLoading && !isError ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 gap-1.5 border-primary/25 bg-primary/8 px-2.5 text-xs text-primary hover:bg-primary/14 lg:h-8"
            disabled={isUploading}
            onClick={onPickFile}
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {isUploading ? t("tasks.uploading") : t("tasks.upload")}
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
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {t("tasks.attachmentsLoading")}
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-4 text-center text-xs text-destructive">
            {t("tasks.attachmentsError")}
          </p>
        ) : attachments.length === 0 ? (
          <EmptyState
            compact
            className="border-0 bg-transparent px-3 py-6 shadow-none"
            icon={Paperclip}
            title={t("tasks.attachmentsEmptyTitle")}
            description={t("tasks.attachmentsEmptyHint")}
          />
        ) : (
          <div className="app-scrollbar max-h-[min(50vh,16rem)] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {isUploading ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-2.5 py-2">
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">{t("uploads.uploadingFile")}</span>
              </div>
            ) : null}
            {attachments.map((attachment) => (
              <TaskAttachmentRow
                key={attachment.id}
                attachment={attachment}
                isDeleting={isDeletingId === attachment.id}
                onOpen={() => onOpen(attachment)}
                onDownload={() => onDownload(attachment)}
                onRequestDelete={() => setAttachmentToDelete(attachment.id)}
              />
            ))}
          </div>
        )}
      </div>
      <AlertDialog
        open={attachmentToDelete != null}
        onOpenChange={(open) => {
          if (!open && !isDeletingSelected) {
            setAttachmentToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-sm gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks.deleteAttachmentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks.deleteAttachmentDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSelected}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={isDeletingSelected}
              onClick={() => void handleConfirmDelete()}
            >
              <Trash2 className="size-4" />
              {isDeletingSelected ? t("tasks.deleting") : t("tasks.deleteAttachmentConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function TaskAttachmentPreview({
  attachment,
  onDownload,
}: {
  attachment: TaskAttachmentApiItem;
  onDownload: () => void;
}) {
  const badge = getAttachmentFileTypeBadge(attachment.originalName, attachment.mimeType);
  const previewClassName =
    "size-8 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary";

  return (
    <AuthenticatedImagePreview
      downloadUrl={attachment.downloadUrl || attachment.url}
      filename={attachment.originalName}
      mimeType={attachment.mimeType}
      className={previewClassName}
      imageClassName="size-full"
      objectFit="cover"
      fetchBlob={() => fetchTaskAttachmentBlob(attachment)}
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

function TaskAttachmentRow({
  attachment,
  isDeleting,
  onOpen,
  onDownload,
  onRequestDelete,
}: {
  attachment: TaskAttachmentApiItem;
  isDeleting: boolean;
  onOpen: () => void | Promise<void>;
  onDownload: () => void;
  onRequestDelete: () => void;
}) {
  const { t } = useI18n();
  const { openLightbox } = useAuthenticatedImageLightbox();
  const isImage = isImageAttachment(attachment);
  const downloadUrl = attachment.downloadUrl || attachment.url;
  const { isPreparing, isError, isOffline, isBusy, clearStatus, prepare } =
    useOnDemandFilePreparation();
  const openDisabled = isDeleting || isBusy;

  function openImageLightbox(objectUrl?: string | null) {
    openLightbox({
      downloadUrl,
      filename: attachment.originalName,
      objectUrl: objectUrl ?? undefined,
      onDownload: () => onDownload(),
    });
  }

  async function runOpen() {
    if (openDisabled) {
      return;
    }

    if (isImage) {
      const cachedUrl = getAuthenticatedBlobObjectUrl(downloadUrl);
      if (cachedUrl) {
        clearStatus();
        openImageLightbox(cachedUrl);
        return;
      }

      await prepare(async () => {
        const objectUrl = await acquireAuthenticatedBlobUrl(downloadUrl, () =>
          fetchTaskAttachmentBlob(attachment),
        );
        releaseAuthenticatedBlobUrl(downloadUrl);
        openImageLightbox(objectUrl);
      });
      return;
    }

    await prepare(async () => {
      await onOpen();
    });
  }

  return (
    <div className="flex min-w-0 max-w-full items-start gap-2.5 overflow-hidden rounded-xl border border-border bg-card px-2.5 py-2">
      <TaskAttachmentPreview attachment={attachment} onDownload={() => onDownload()} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{attachment.originalName}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{formatAttachmentSize(attachment.size)}</span>
          <span>·</span>
          <span>{formatAttachmentDate(attachment.createdAt)}</span>
          <span>·</span>
          <span>{attachment.uploader.name}</span>
        </div>
        <FilePreparationStatus
          isPreparing={isPreparing}
          isError={isError}
          isOffline={isOffline}
          onRetry={() => {
            void runOpen();
          }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 text-muted-foreground hover:text-foreground lg:size-7"
          disabled={openDisabled}
          aria-label={
            isImage
              ? t("files.viewImage").replace("{name}", attachment.originalName)
              : t("files.openAttachment")
          }
          onClick={() => {
            void runOpen();
          }}
        >
          <ExternalLink className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 text-muted-foreground hover:text-foreground lg:size-7"
          disabled={isDeleting}
          aria-label={t("files.downloadAttachment")}
          onClick={onDownload}
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 text-muted-foreground hover:text-destructive lg:size-7"
          disabled={isDeleting}
          aria-label={t("tasks.deleteAttachmentAria")}
          onClick={onRequestDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-card p-3", className)}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
