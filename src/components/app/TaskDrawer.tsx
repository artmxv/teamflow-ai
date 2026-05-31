import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  type Task,
  getMember,
  getProject,
  priorityMeta,
  statusColumns,
} from "@/lib/mock-data";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskDrawer({
  task,
  onOpenChange,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  if (!task) return null;
  const assignee = getMember(task.assigneeId);
  const project = getProject(task.projectId);
  const prio = priorityMeta[task.priority];
  const statusLabel = statusColumns.find((s) => s.key === task.status)?.title ?? task.status;

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
                    <div className="text-xs font-semibold uppercase tracking-wide text-primary">Summary</div>
                    <p className="mt-1 text-foreground/90">
                      This task involves implementing the requested feature, validating with QA, and updating the documentation. Two open dependencies were detected in linked PRs.
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
                        c.done ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {c.done && <Check className="size-3" />}
                    </span>
                    <span className={cn(c.done && "text-muted-foreground line-through")}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Paperclip className="size-3.5" /> Attachments
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {task.attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-secondary text-xs font-semibold">
                      {a.name.split(".").pop()?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comments
              </h3>
              <div className="space-y-3">
                {task.comments.map((c) => {
                  const m = getMember(c.authorId);
                  return (
                    <div key={c.id} className="flex gap-3">
                      {m && <Avatar id={m.id} initials={m.avatar} />}
                      <div className="flex-1 rounded-2xl border border-border bg-card p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{m?.name}</span>
                          <span className="text-muted-foreground">{c.createdAt}</span>
                        </div>
                        <p className="mt-1 text-sm">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
                <Textarea placeholder="Write a comment…" className="min-h-20 rounded-2xl" />
                <div className="flex justify-end">
                  <Button size="sm">Comment</Button>
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
              <Badge variant="secondary" className="border-0">{statusLabel}</Badge>
            </Field>
            <Field icon={Flag} label="Priority">
              <Badge variant="secondary" className={prio.className + " border-0"}>{prio.label}</Badge>
            </Field>
            <Field icon={UserIcon} label="Assignee">
              {assignee ? (
                <span className="flex items-center gap-2 text-sm">
                  <Avatar id={assignee.id} initials={assignee.avatar} size="sm" />
                  {assignee.name}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </Field>
            <Field icon={Calendar} label="Due date">
              <span className="text-sm">{task.dueDate ?? "—"}</span>
            </Field>
            <Field icon={Flag} label="Labels">
              <div className="flex flex-wrap gap-1">
                {task.labels.map((l) => (
                  <span key={l} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                    {l}
                  </span>
                ))}
              </div>
            </Field>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
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
