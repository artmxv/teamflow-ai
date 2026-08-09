import type { ReactNode } from "react";

import type { ProjectStatus } from "@/lib/mock-data";
import { projectStatusDotClass } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function ProjectStatusIndicator({
  status,
  children,
  className,
  dotClassName,
}: {
  status: ProjectStatus;
  children: ReactNode;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      <span
        className={cn("size-2 shrink-0 rounded-full", projectStatusDotClass[status], dotClassName)}
        aria-hidden
      />
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}
