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
  "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring";

const deadlineOpenRing =
  "data-[state=open]:border-ring data-[state=open]:ring-1 data-[state=open]:ring-ring";

/** Shared trigger look for deadline date + time fields (matches Input). */
export function deadlineFieldTriggerClassName(options?: {
  empty?: boolean;
  className?: string;
}) {
  return cn(
    "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-sm",
    "transition-[color,background-color,border-color,box-shadow]",
    "hover:border-ring/45 hover:bg-secondary/40",
    deadlineFocusRing,
    deadlineOpenRing,
    "active:border-ring active:bg-secondary/50",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:bg-transparent",
    options?.empty ? "text-muted-foreground" : "text-foreground",
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
