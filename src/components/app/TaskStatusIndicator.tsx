import type { ReactNode } from "react";

import type { TaskStatus } from "@/lib/mock-data";
import { taskStatusColumnDotClass } from "@/lib/task-status-theme";
import { cn } from "@/lib/utils";

export function TaskStatusIndicator({
  status,
  children,
  className,
  dotClassName,
}: {
  status: TaskStatus;
  children: ReactNode;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          taskStatusColumnDotClass[status],
          dotClassName,
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
