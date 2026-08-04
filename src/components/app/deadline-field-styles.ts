import { cn } from "@/lib/utils";

/**
 * Status + Date + Time in one compact row on dialog/desktop widths.
 * Uses fr proportions (status narrower, date medium, time medium-small).
 * `minmax(0, …)` lets columns share ~lg dialog width without wrapping;
 * below 480px the row stacks cleanly.
 */
export const deadlineStatusDateTimeRowClassName =
  "grid grid-cols-1 items-start gap-3 min-[480px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)]";

/** Shared purple focus/open ring for deadline triggers (matches Input/Select). */
const deadlineFocusRing =
  "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

const deadlineOpenRing =
  "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/30";

/** Shared trigger look for deadline date + time fields (matches Input). */
export function deadlineFieldTriggerClassName(options?: { empty?: boolean; className?: string }) {
  return cn(
    "flex h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-control-border bg-control px-3 py-1 text-left text-sm text-control-foreground shadow-sm",
    "transition-[color,background-color,border-color,box-shadow]",
    "hover:bg-control-hover",
    deadlineFocusRing,
    deadlineOpenRing,
    "active:bg-control-active",
    "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-control",
    options?.empty ? "text-muted-foreground" : "text-control-foreground",
    options?.className,
  );
}

/**
 * Selected day / hour / minute: TeamFlow purple (not bright blue).
 * Dark purple tint, purple border, soft glow, light readable text.
 */
export function deadlineSelectedItemClassName(className?: string) {
  return cn(
    "border border-primary bg-primary text-primary-foreground shadow-glow",
    "ring-1 ring-primary/40",
    className,
  );
}
