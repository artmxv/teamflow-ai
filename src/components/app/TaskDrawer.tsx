import { useEffect, useState } from "react";
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
import { type AssigneeOption, UNASSIGNED_ASSIGNEE_VALUE } from "@/lib/assignee-options";
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  updateTaskComment,
  type TaskCommentApiItem,
} from "@/lib/api/task-comments";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { type Task, getMember, getProject, priorityMeta, statusColumns } from "@/lib/mock-data";
import { Avatar } from "./Avatar";
import {
  Calendar,
  Flag,
  User as UserIcon,
  CircleDot,
  Sparkles,
  Paperclip,
  Plus,
  Check,
  Trash2,
  Pencil,
  X,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskDrawer({
  task,
  assignee,
  assigneeOptions = [],
  onOpenChange,
  onSaveChanges,
  isSaving = false,
  onDelete,
  isDeleting = false,
}: {
  task: Task | null;
  assignee?: AssigneeOption | null;
  assigneeOptions?: AssigneeOption[];
  onOpenChange: (open: boolean) => void;
  onSaveChanges?: (updates: { assigneeId: string | null; dueDate: string | null }) => void;
  isSaving?: boolean;
  onDelete?: (taskId: string) => void;
  isDeleting?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const currentUserId = me?.user.id;
  const [aiOpen, setAiOpen] = useState(false);
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(null);
  const [draftDueDate, setDraftDueDate] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");

  useEffect(() => {
    if (!task) return;
    setDraftAssigneeId(task.assigneeId);
    setDraftDueDate(task.dueDate);
  }, [task?.id, task?.assigneeId, task?.dueDate]);

  useEffect(() => {
    setCommentBody("");
  }, [task?.id]);

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
      toast.success("Comment added");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Comment could not be saved",
      );
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      updateTaskComment(task!.id, commentId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task-comments", task!.id] });
      toast.success("Comment updated");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Comment could not be updated",
      );
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteTaskComment(task!.id, commentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task-comments", task!.id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Comment deleted");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Comment could not be deleted",
      );
    },
  });

  if (!task) return null;

  const resolvedAssignee = assignee ?? (task.assigneeId ? getMember(task.assigneeId) : null);
  const draftSelectValue = draftAssigneeId ?? UNASSIGNED_ASSIGNEE_VALUE;
  const savedSelectValue = task.assigneeId ?? UNASSIGNED_ASSIGNEE_VALUE;
  const canEditTask = !!onSaveChanges;
  const canEditAssignee = canEditTask && assigneeOptions.length > 0;
  const hasAssigneeChanges = draftSelectValue !== savedSelectValue;
  const hasDueDateChanges = (draftDueDate ?? null) !== (task.dueDate ?? null);
  const project = getProject(task.projectId);
  const prio = priorityMeta[task.priority];
  const statusLabel = statusColumns.find((s) => s.key === task.status)?.title ?? task.status;

  function handleSaveAssignee() {
    if (!onSaveChanges || isSaving) return;
    if (!hasAssigneeChanges && !hasDueDateChanges) return;
    onSaveChanges({ assigneeId: draftAssigneeId, dueDate: draftDueDate });
  }

  return (
    <Sheet open={!!task} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="space-y-1 border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{task.key}</span>
            <span>·</span>
            <span>{project?.name}</span>
          </div>
          <SheetTitle className="text-xl leading-snug">{task.title}</SheetTitle>
          <SheetDescription className="sr-only">
            Task details, checklist, comments, and activity for {task.key}.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 py-4 lg:grid-cols-[1fr_220px]">
          <div className="min-w-0 space-y-6">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </h3>
              <p className="text-sm leading-relaxed text-foreground/90">{task.description}</p>
            </section>

            <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="size-4 text-primary" />
                  AI assist
                </div>
                <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
                  Summarize task
                </Button>
              </div>
              {aiOpen && (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-lg bg-card p-3 shadow-soft">
                    <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Summary
                    </div>
                    <p className="mt-1 text-foreground/90">
                      This task involves implementing the requested feature, validating with QA, and
                      updating the documentation. Two open dependencies were detected in linked PRs.
                    </p>
                  </div>
                  <div className="rounded-lg bg-card p-3 shadow-soft">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      Generated checklist
                    </div>
                    <ul className="space-y-1.5">
                      {[
                        "Confirm spec with design",
                        "Land scaffolding PR",
                        "Wire up state & data",
                        "Add unit & e2e tests",
                        "Ship behind feature flag",
                      ].map((c) => (
                        <li key={c} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 grid size-4 place-items-center rounded border border-input">
                            <Plus className="size-3 text-muted-foreground" />
                          </span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Checklist
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

            <section>
              <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Paperclip className="size-3.5" /> Attachments
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Demo preview only — file upload is not available in this build.
              </p>
              {task.attachments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No attachments on this task.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {task.attachments.map((a) => (
                    <DemoAttachmentChip key={a.id} name={a.name} size={a.size} />
                  ))}
                </div>
              )}
            </section>

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

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Activity
              </h3>
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
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Field icon={CircleDot} label="Status">
              <Badge variant="secondary" className="border-0">
                {statusLabel}
              </Badge>
            </Field>
            <Field icon={Flag} label="Priority">
              <Badge variant="secondary" className={prio.className + " border-0"}>
                {prio.label}
              </Badge>
            </Field>
            <Field icon={UserIcon} label="Assignee">
              {canEditAssignee ? (
                <Select
                  value={draftSelectValue}
                  disabled={isSaving}
                  onValueChange={(value) => {
                    setDraftAssigneeId(value === UNASSIGNED_ASSIGNEE_VALUE ? null : value);
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_ASSIGNEE_VALUE}>Unassigned</SelectItem>
                    {assigneeOptions.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <span className="flex items-center gap-2">
                          <Avatar id={member.id} initials={member.avatar} size="sm" />
                          {member.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : resolvedAssignee ? (
                <span className="flex items-center gap-2 text-sm">
                  <Avatar id={resolvedAssignee.id} initials={resolvedAssignee.avatar} size="sm" />
                  {resolvedAssignee.name}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </Field>
            <Field icon={Calendar} label="Due date">
              {canEditTask ? (
                <Input
                  type="date"
                  className={cn("date-input-native h-9")}
                  disabled={isSaving}
                  value={draftDueDate ?? ""}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDraftDueDate(next === "" ? null : next);
                  }}
                />
              ) : (
                <span className="text-sm">{task.dueDate ?? "—"}</span>
              )}
            </Field>
            <Field icon={Flag} label="Labels">
              <div className="flex flex-wrap gap-1">
                {task.labels.map((l) => (
                  <span
                    key={l}
                    className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </Field>
            {canEditTask && (
              <Button
                type="button"
                size="sm"
                className="w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
                disabled={(!hasAssigneeChanges && !hasDueDateChanges) || isSaving}
                onClick={handleSaveAssignee}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isDeleting}
                onClick={() => {
                  if (
                    window.confirm(`Delete task "${task.title}"? This action cannot be undone.`)
                  ) {
                    onDelete(task.id);
                  }
                }}
              >
                <Trash2 className="size-4" />
                {isDeleting ? "Deleting…" : "Delete task"}
              </Button>
            )}
          </aside>
        </div>
      </SheetContent>
    </Sheet>
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
        Comments
      </h3>
      <div className="space-y-3">
        {isLoading ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Loading comments…
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-4 text-center text-xs text-destructive">
            Could not load comments. Try closing and reopening the task.
          </p>
        ) : comments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No comments yet. Be the first to leave a note.
          </p>
        ) : (
          comments.map((comment) => (
            <TaskCommentRow
              key={comment.id}
              comment={comment}
              isOwn={!!currentUserId && comment.author.id === currentUserId}
              isUpdating={updatingCommentId === comment.id}
              isDeleting={deletingCommentId === comment.id}
              onUpdate={onUpdateComment}
              onRequestDelete={setCommentToDelete}
            />
          ))
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
              <AlertDialogTitle>Delete comment?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingSelected}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={isDeletingSelected}
                onClick={() => void handleConfirmDelete()}
              >
                <Trash2 className="size-4" />
                {isDeletingSelected ? "Deleting…" : "Delete comment"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Textarea
          placeholder="Write a comment…"
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
            {isSubmitting ? "Posting…" : "Comment"}
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
      <Avatar id={comment.author.id} initials={authorInitials(comment.author)} size="sm" />
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

function attachmentExtension(name: string) {
  const ext = name.includes(".") ? name.split(".").pop() : null;
  return ext ? ext.toUpperCase().slice(0, 4) : "FILE";
}

function DemoAttachmentChip({ name, size }: { name: string; size: string }) {
  return (
    <div
      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-soft"
      title={name}
    >
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-[10px] font-semibold text-muted-foreground">
        {attachmentExtension(name)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-sm font-medium">
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{name}</span>
        </div>
        {size ? <div className="text-[11px] text-muted-foreground">{size}</div> : null}
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
