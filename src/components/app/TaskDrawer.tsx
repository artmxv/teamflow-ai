import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [aiOpen, setAiOpen] = useState(false);
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(null);
  const [draftDueDate, setDraftDueDate] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setDraftAssigneeId(task.assigneeId);
    setDraftDueDate(task.dueDate);
  }, [task?.id, task?.assigneeId, task?.dueDate]);

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

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comments
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Demo only — comments are not saved. Use Save changes for assignee and due date.
              </p>
              <div className="space-y-3">
                {task.comments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    No comments yet.
                  </p>
                ) : (
                  task.comments.map((c, index) => (
                    <DemoCommentPlaceholder key={c.id} index={index} authorId={c.authorId} />
                  ))
                )}
                <Textarea
                  placeholder="Preview only — comments are not saved"
                  className="min-h-20 rounded-2xl opacity-80"
                  disabled
                  readOnly
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.message("Comments are demo-only", {
                        description: "Saving a task updates assignee and due date only.",
                      })
                    }
                  >
                    Comment (demo)
                  </Button>
                </div>
              </div>
            </section>

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

const demoCommentBodies = [
  "Looks good — can we align this with the API contract before merge?",
  "Blocked on design review; will update once tokens land.",
  "Added test notes in the linked doc.",
];

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

function DemoCommentPlaceholder({ index, authorId }: { index: number; authorId: string }) {
  const m = getMember(authorId);
  const body = demoCommentBodies[index % demoCommentBodies.length];
  return (
    <div className="flex gap-3">
      {m ? (
        <Avatar id={m.id} initials={m.avatar} />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          ?
        </span>
      )}
      <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">{m?.name ?? "Team member"}</span>
          <span className="shrink-0 text-muted-foreground">Demo</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{body}</p>
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
