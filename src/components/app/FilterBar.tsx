import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared primary create CTA (New task / New project). */
export const CREATE_ACTION_BUTTON_CLASSNAME =
  "h-10 min-w-[10.5rem] gap-2 px-4 text-sm font-medium max-sm:w-full sm:min-w-[11rem]";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

/** Unified search/filter panel surface for /app list pages. */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card/80 p-3 shadow-soft sm:mb-5 sm:p-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
