import { cn } from "@/lib/utils";

/** Small green online indicator (6–8px). Only render when the user is actually online. */
export function ChatOnlineDot({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn("inline-block size-2 shrink-0 rounded-full bg-emerald-500", className)}
    />
  );
}
