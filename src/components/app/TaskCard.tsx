import { GripVertical, MessageSquare, Paperclip, CheckSquare } from "lucide-react";
import { type Task, getMember, priorityMeta, statusColumns, type TaskStatus } from "@/lib/mock-data";
import { Avatar } from "./Avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaskCard({
  task,
  onOpen,
  onStatusChange,
  isStatusUpdating,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onStatusChange?: (status: TaskStatus) => void;
  isStatusUpdating?: boolean;
}) {
  const assignee = getMember(task.assigneeId);
  const done = task.checklist.filter((c) => c.done).length;
  const prio = priorityMeta[task.priority];

  return (
    <div className="group w-full rounded-2xl border border-border bg-card p-3.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="w-full text-left"
      >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-mono text-muted-foreground">{task.key}</div>
        <GripVertical className="size-3.5 text-muted-foreground/60 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="mt-1 text-sm font-medium leading-snug">{task.title}</div>

      {task.labels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span
              key={l}
              className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
            >
              {l}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary" className={prio.className + " border-0"}>
            {prio.label}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3" /> {done}/{task.checklist.length}
          </span>
          {task.comments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" /> {task.comments.length}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3" /> {task.attachments.length}
            </span>
          )}
        </div>
        {assignee && <Avatar id={assignee.id} initials={assignee.avatar} size="sm" />}
      </div>
      </button>

      {onStatusChange && (
        <div
          className="mt-2 border-t border-border/60 pt-2"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Select
            value={task.status}
            disabled={isStatusUpdating}
            onValueChange={(value) => onStatusChange(value as TaskStatus)}
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusColumns.map((col) => (
                <SelectItem key={col.key} value={col.key}>
                  {col.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
