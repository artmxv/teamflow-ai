import type { ReactNode } from "react";

import type { Priority } from "@/lib/mock-data";
import { taskPriorityDotClass } from "@/lib/task-priority-theme";
import { cn } from "@/lib/utils";

export function TaskPriorityIndicator({
  priority,
  children,
  className,
  dotClassName,
}: {
  priority: Priority;
  children: ReactNode;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span
        className={cn("size-2 shrink-0 rounded-full", taskPriorityDotClass[priority], dotClassName)}
        aria-hidden
      />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
