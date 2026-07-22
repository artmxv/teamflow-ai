/** Small green online indicator (6–8px). Only render when the user is actually online. */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ChatOnlineDot({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            role="status"
            aria-label={label}
            className={cn(
              "inline-block size-2 shrink-0 rounded-full bg-emerald-500 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              className,
            )}
          >
            <span className="sr-only">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
