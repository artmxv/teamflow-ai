import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, MessageSquare, Paperclip } from "lucide-react";
import { type Task, priorityMeta, statusColumns, type TaskStatus } from "@/lib/mock-data";
import { priorityLabel, taskStatusLabel, useI18n } from "@/lib/i18n";
import { formatDueDateTimeShort } from "@/lib/due-datetime";
import { translateStarterProjectName, translateStarterTitle } from "@/lib/starter-content";
import type { AssigneeOption } from "@/lib/assignee-options";
import { cn } from "@/lib/utils";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TaskDragData = {
  type: "task";
  taskId: string;
  status: TaskStatus;
};

export function TaskCard({
  task,
  assignees = [],
  onOpen,
  onStatusChange,
  isStatusUpdating,
  draggable = false,
  dragOverlay = false,
}: {
  task: Task;
  assignees?: AssigneeOption[];
  onOpen: (task: Task) => void;
  onStatusChange?: (status: TaskStatus) => void;
  isStatusUpdating?: boolean;
  draggable?: boolean;
  /** Rendered inside DragOverlay (no drag hooks). */
  dragOverlay?: boolean;
}) {
  const { t, lang } = useI18n();
  const prio = priorityMeta[task.priority];
  const dueDateLabel = task.dueDate ? formatDueDateTimeShort(task.dueDate) : null;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task", taskId: task.id, status: task.status } satisfies TaskDragData,
    disabled: !draggable || dragOverlay,
  });

  const style =
    draggable && !dragOverlay && transform
      ? { transform: CSS.Translate.toString(transform) }
      : undefined;

  return (
    <div
      ref={draggable && !dragOverlay ? setNodeRef : undefined}
      style={style}
      className={cn(
        "group w-full rounded-2xl border border-border bg-card p-3.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card",
        draggable && !dragOverlay && isDragging && "z-50 opacity-40",
        dragOverlay && "cursor-grabbing shadow-card ring-2 ring-primary/25",
      )}
      {...(draggable && !dragOverlay ? { ...attributes, ...listeners } : {})}
    >
      <button type="button" onClick={() => onOpen(task)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-mono text-muted-foreground">{task.key}</div>
          <GripVertical
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/60",
              draggable ? "opacity-70" : "opacity-0 transition group-hover:opacity-100",
            )}
          />
        </div>
        <div className="mt-1 text-sm font-medium leading-snug">
          {translateStarterTitle(task.title, lang)}
        </div>

        {task.labels.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {task.labels.map((l) => (
              <span
                key={l}
                className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {translateStarterProjectName(l, lang)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary" className={prio.className + " border-0"}>
              {priorityLabel(task.priority, t)}
            </Badge>
            {dueDateLabel ? (
              <span className="inline-flex items-center gap-1" title="Due date">
                <Calendar className="size-3 shrink-0" />
                <span className="truncate">{dueDateLabel}</span>
              </span>
            ) : null}
            {(task.commentsCount ?? task.comments.length) > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3" /> {task.commentsCount ?? task.comments.length}
              </span>
            )}
            {(task.attachmentsCount ?? task.attachments.length) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="size-3" /> {task.attachmentsCount ?? task.attachments.length}
              </span>
            )}
          </div>
          <AssigneeAvatars assignees={assignees} className="shrink-0" />
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
                  {taskStatusLabel(col.key, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
