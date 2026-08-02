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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssigneeAvatars } from "@/components/app/AssigneeAvatars";
import { AssigneeMultiPicker } from "@/components/app/AssigneeMultiPicker";
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
import { fetchWorkspaceMembers } from "@/lib/api/workspace-members";
import {
  enrichAssigneeOptionsWithAvatars,
  resolveEditAssigneeOptions,
  type AssigneeOption,
} from "@/lib/assignee-options";
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  updateTaskComment,
  type TaskCommentApiItem,
} from "@/lib/api/task-comments";
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
  getProject,
  priorityMeta,
  statusColumns,
} from "@/lib/mock-data";
import { EmptyState } from "@/components/app/EmptyState";
import { UserAvatar } from "@/components/app/UserAvatar";
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
  X,
  Download,
  ExternalLink,
  Loader2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  combineLocalDateAndTime,
  formatDueDateTime,
  splitLocalDateTime,
} from "@/lib/due-datetime";

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
  onDelete,
  isDeleting = false,
}: {
  task: Task | null;
  assignees?: AssigneeOption[];
  onOpenChange: (open: boolean) => void;
  onSaveChanges?: (updates: TaskDrawerUpdates) => void;
  isSaving?: boolean;
  onDelete?: (taskId: string) => void;
  isDeleting?: boolean;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const currentUserId = me?.user.id;
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAssigneeIds, setDraftAssigneeIds] = useState<string[]>([]);
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftDueTime, setDraftDueTime] = useState("");
  const [draftStatus, setDraftStatus] = useState<TaskStatus>("backlog");
  const [draftPriority, setDraftPriority] = useState<Priority>("medium");
  const [commentBody, setCommentBody] = useState("");
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [dueDateTimeError, setDueDateTimeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!task) {
      setDraftTitle("");
      setDraftAssigneeIds([]);
      setDraftDueDate("");
      setDraftDueTime("");
      setDraftStatus("backlog");
      setDraftPriority("medium");
      setDueDateTimeError(null);
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
  }, [
    lang,
    task?.assigneeId,
    task?.assigneeIds,
    task?.dueDate,
    task?.id,
    task?.priority,
    task?.status,
    task?.title,
  ]);

  useEffect(() => {
    setCommentBody("");
  }, [task?.id]);

  useEffect(() => {
    if (!task) {
      setDeleteTaskOpen(false);
    }
  }, [task]);

  const commentsQuery = useQuery({
    queryKey: ["task-comments", task?.id],
    queryFn: () => fetchTaskComments(task!.id),
    enabled: !!task?.id,
  });

  const createCommentMutation = useMutation({
    mutationFn: (body: string) => createTaskComment(task!.id, body),
    onSuccess: async () => {
      setCommentBody("");
      await queryClient.invalidateQueries({ queryKey: ["task-comments", task!.id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      invalidateNotifications(queryClient);
      toast.success(t("comments.added"));
    },
    onError: () => {
      toast.error(t("comments.saveFailed"));
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      updateTaskComment(task!.id, commentId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task-comments", task!.id] });
      toast.success(t("comments.updated"));
    },
    onError: () => {
      toast.error(t("comments.updateFailed"));
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteTaskComment(task!.id, commentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task-comments", task!.id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(t("comments.deleted"));
    },
    onError: () => {
      toast.error(t("comments.deleteFailed"));
    },
  });

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
  const displayedTaskTitle = displayTaskTitle(task.title, lang);
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
  const project = getProject(task.projectId);
  const prio = priorityMeta[task.priority];
  const statusLabel = taskStatusLabel(task.status, t);

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
        hasDate && hasTime ? combineLocalDateAndTime(draftDueDate.trim(), draftDueTime.trim()) : null,
      status: draftStatus,
      priority: draftPriority,
    });
  }

  return (
    <>
      <Sheet open={!!task} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="app-scrollbar w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="space-y-1 border-b border-border pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{task.key}</span>
              <span>·</span>
              <span>{project?.name ? displayProjectName(project.name, lang) : ""}</span>
            </div>
            <SheetTitle className={canEditTask ? "sr-only" : "text-xl leading-snug"}>
              {displayTaskTitle(canEditTask ? draftTitle || task.title : task.title, lang)}
            </SheetTitle>
            {canEditTask ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="task-drawer-title"
                  className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t("tasks.taskTitle")}
                </label>
                <Input
                  key={`${task.id}:${lang}`}
                  id="task-drawer-title"
                  value={draftTitle}
                  disabled={isSaving}
                  className="h-10 text-base font-semibold"
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
              </div>
            ) : null}
            <SheetDescription className="sr-only">
              {t("tasks.sheetDescription").replace("{key}", task.key)}
            </SheetDescription>
          </SheetHeader>

          {canEditAssignees ? (
            <section className="border-b border-border py-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <UserIcon className="size-3.5" /> {t("tasks.assignees")}
              </div>
              <AssigneeMultiPicker
                options={resolvedAssigneeOptions}
                value={draftAssigneeIds}
                disabled={isSaving}
                isLoading={assigneeOptionsLoading}
                onChange={setDraftAssigneeIds}
              />
            </section>
          ) : null}

          <div className="grid gap-6 py-4 lg:grid-cols-[1fr_220px]">
            <div className="min-w-0 space-y-6">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("projects.new.description")}
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {displayTaskDescription(task.description, lang)}
                </p>
              </section>

              <section>
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

              <TaskCommentsSection
                comments={commentsQuery.data ?? []}
                currentUserId={currentUserId}
                isLoading={commentsQuery.isLoading}
                isError={commentsQuery.isError}
                commentBody={commentBody}
                onCommentBodyChange={setCommentBody}
                isSubmitting={createCommentMutation.isPending}
                onSubmit={() => {
                  const trimmed = commentBody.trim();
                  if (!trimmed || createCommentMutation.isPending) return;
                  createCommentMutation.mutate(trimmed);
                }}
                onUpdateComment={(commentId, body) => {
                  if (updateCommentMutation.isPending) {
                    return Promise.reject(new Error("Update already in progress"));
                  }
                  return updateCommentMutation.mutateAsync({ commentId, body });
                }}
                onDeleteComment={(commentId) => {
                  if (deleteCommentMutation.isPending) {
                    return Promise.reject(new Error("Delete already in progress"));
                  }
                  return deleteCommentMutation.mutateAsync(commentId);
                }}
                updatingCommentId={
                  updateCommentMutation.isPending
                    ? (updateCommentMutation.variables?.commentId ?? null)
                    : null
                }
                deletingCommentId={
                  deleteCommentMutation.isPending ? (deleteCommentMutation.variables ?? null) : null
                }
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

            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <Field icon={CircleDot} label={t("tasks.status")}>
                {canEditTask ? (
                  <Select
                    key={`${task.id}-status`}
                    value={draftStatus}
                    disabled={isSaving}
                    onValueChange={(value) => setDraftStatus(value as TaskStatus)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusColumns.map((column) => (
                        <SelectItem key={column.key} value={column.key}>
                          {taskStatusLabel(column.key, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="border-0">
                    {statusLabel}
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
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(priorityMeta) as [
                          Priority,
                          (typeof priorityMeta)[Priority],
                        ][]
                      ).map(([key]) => (
                        <SelectItem key={key} value={key}>
                          {priorityLabel(key, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className={prio.className + " border-0"}>
                    {priorityLabel(task.priority, t)}
                  </Badge>
                )}
              </Field>
              {!canEditAssignees ? (
                <Field icon={UserIcon} label={t("tasks.assignees")}>
                  <AssigneeAvatars assignees={assignees} showUnassignedLabel />
                </Field>
              ) : null}
              <Field icon={Calendar} label={t("tasks.dueDate")}>
                {canEditTask ? (
                  <div className="flex flex-wrap items-start gap-2.5">
                    <div className="min-w-[min(100%,14.375rem)] flex-[1.15_1_14.375rem]">
                      <DeadlineDatePicker
                        disabled={isSaving}
                        value={draftDueDate}
                        aria-label={t("tasks.dueDate")}
                        onChange={(next) => {
                          setDraftDueDate(next);
                          setDueDateTimeError(null);
                        }}
                      />
                    </div>
                    <div className="min-w-[min(100%,11.875rem)] flex-[1_1_11.875rem]">
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
                      <p className="basis-full text-xs leading-4 text-destructive">{dueDateTimeError}</p>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm">{formatDueDateTime(task.dueDate)}</span>
                )}
              </Field>
              {canEditTask && (
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  className="w-full"
                  disabled={!canSaveChanges || isSaving}
                  onClick={handleSaveChanges}
                >
                  {isSaving ? t("settings.saving") : t("common.saveChanges")}
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isDeleting}
                  onClick={() => setDeleteTaskOpen(true)}
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? t("tasks.deleting") : t("tasks.deleteTask")}
                </Button>
              )}
            </aside>
          </div>
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

function authorInitials(author: TaskCommentApiItem["author"]) {
  if (author.avatar) return author.avatar;
  return author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCommentDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TaskCommentsSection({
  comments,
  currentUserId,
  isLoading,
  isError,
  commentBody,
  onCommentBodyChange,
  isSubmitting,
  onSubmit,
  onUpdateComment,
  onDeleteComment,
  updatingCommentId,
  deletingCommentId,
}: {
  comments: TaskCommentApiItem[];
  currentUserId?: string;
  isLoading: boolean;
  isError: boolean;
  commentBody: string;
  onCommentBodyChange: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onUpdateComment: (commentId: string, body: string) => Promise<unknown>;
  onDeleteComment: (commentId: string) => Promise<unknown>;
  updatingCommentId: string | null;
  deletingCommentId: string | null;
}) {
  const { t } = useI18n();
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const isDeletingSelected = commentToDelete != null && deletingCommentId === commentToDelete;

  const trimmedLength = commentBody.trim().length;
  const canSubmit = trimmedLength > 0 && trimmedLength <= 1000 && !isSubmitting;

  async function handleConfirmDelete() {
    if (!commentToDelete || isDeletingSelected) return;
    try {
      await onDeleteComment(commentToDelete);
      setCommentToDelete(null);
    } catch {
      // Toast is shown by the parent mutation; keep dialog open.
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("tasks.sectionComments")}
      </h3>
      <div className="space-y-3">
        {isLoading ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {t("comments.loading")}
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-4 text-center text-xs text-destructive">
            {t("comments.error")}
          </p>
        ) : comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{t("comments.emptyTitle")}</p>
            <p className="mt-1">{t("comments.emptyHint")}</p>
          </div>
        ) : (
          <div className="app-scrollbar max-h-[min(50vh,16rem)] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {comments.map((comment) => (
              <TaskCommentRow
                key={comment.id}
                comment={comment}
                isOwn={!!currentUserId && comment.author.id === currentUserId}
                isUpdating={updatingCommentId === comment.id}
                isDeleting={deletingCommentId === comment.id}
                onUpdate={onUpdateComment}
                onRequestDelete={setCommentToDelete}
              />
            ))}
          </div>
        )}
        <AlertDialog
          open={commentToDelete != null}
          onOpenChange={(open) => {
            if (!open && !isDeletingSelected) {
              setCommentToDelete(null);
            }
          }}
        >
          <AlertDialogContent className="max-w-sm gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("comments.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("comments.deleteDescription")}</AlertDialogDescription>
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
                {isDeletingSelected ? t("comments.deleting") : t("comments.deleteConfirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Textarea
          placeholder={t("tasks.commentPlaceholder")}
          className="min-h-20 rounded-2xl"
          value={commentBody}
          maxLength={1000}
          disabled={isSubmitting}
          onChange={(event) => onCommentBodyChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{trimmedLength}/1000</span>
          <Button type="button" size="sm" disabled={!canSubmit} onClick={onSubmit}>
            {isSubmitting ? t("tasks.postingComment") : t("tasks.postComment")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function TaskCommentRow({
  comment,
  isOwn,
  isUpdating,
  isDeleting,
  onUpdate,
  onRequestDelete,
}: {
  comment: TaskCommentApiItem;
  isOwn: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  onUpdate: (commentId: string, body: string) => Promise<unknown>;
  onRequestDelete: (commentId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  useEffect(() => {
    if (!isEditing) {
      setEditBody(comment.body);
    }
  }, [comment.body, isEditing]);

  const trimmedEdit = editBody.trim();
  const canSaveEdit =
    trimmedEdit.length > 0 &&
    trimmedEdit.length <= 1000 &&
    trimmedEdit !== comment.body &&
    !isUpdating;

  function startEditing() {
    setEditBody(comment.body);
    setIsEditing(true);
  }

  function cancelEditing() {
    setEditBody(comment.body);
    setIsEditing(false);
  }

  async function saveEditing() {
    if (!canSaveEdit) return;
    try {
      await onUpdate(comment.id, trimmedEdit);
      setIsEditing(false);
    } catch {
      // Toast is shown by the parent mutation; keep edit mode open.
    }
  }

  function handleDelete() {
    if (isDeleting) return;
    onRequestDelete(comment.id);
  }

  return (
    <div className="flex gap-2.5">
      <UserAvatar
        id={comment.author.id}
        name={comment.author.name}
        avatar={comment.author.avatar ?? authorInitials(comment.author)}
        avatarUrl={comment.author.avatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-card px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-medium">{comment.author.name}</span>
              <span className="text-muted-foreground">{formatCommentDate(comment.createdAt)}</span>
            </div>
          </div>
          {isOwn && !isEditing && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                disabled={isUpdating || isDeleting}
                aria-label="Edit comment"
                onClick={startEditing}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                disabled={isUpdating || isDeleting}
                aria-label="Delete comment"
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="mt-1.5 space-y-1.5">
            <Textarea
              value={editBody}
              maxLength={1000}
              disabled={isUpdating}
              className="min-h-14 resize-none rounded-lg py-2 text-sm"
              onChange={(event) => setEditBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditing();
                }
              }}
            />
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isUpdating}
                onClick={cancelEditing}
              >
                <X className="mr-1 size-3" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!canSaveEdit}
                onClick={saveEditing}
              >
                {isUpdating ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm leading-snug text-foreground/90">{comment.body}</p>
        )}
      </div>
    </div>
  );
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
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="size-3.5" /> {t("tasks.sectionAttachments")}
        </h3>
        {!isLoading && !isError && attachments.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="brand"
            className="h-7 gap-1.5 px-2 text-xs"
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
            primaryAction={
              <Button
                type="button"
                size="sm"
                variant="brand"
                className="h-7 gap-1.5 px-2 text-xs"
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
            }
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
            <AlertDialogCancel disabled={isDeletingSelected}>{t("common.cancel")}</AlertDialogCancel>
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
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2">
      <TaskAttachmentPreview attachment={attachment} onDownload={() => onDownload()} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{attachment.originalName}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{formatAttachmentSize(attachment.size)}</span>
          <span>·</span>
          <span>{formatCommentDate(attachment.createdAt)}</span>
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
          className="size-7 text-muted-foreground hover:text-foreground"
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
          className="size-7 text-muted-foreground hover:text-foreground"
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
          className="size-7 text-muted-foreground hover:text-destructive"
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
