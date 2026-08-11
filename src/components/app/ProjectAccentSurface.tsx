import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ProjectAccentSurfaceProps = {
  /** Tailwind `from-* to-*` project gradient classes. */
  gradient: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  showFlag?: boolean;
};

/**
 * Neutral project surface with one restrained color identity tab.
 */
export function ProjectAccentSurface({
  gradient,
  children,
  className,
  contentClassName,
  showFlag = true,
}: ProjectAccentSurfaceProps) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft transition-[border-color,box-shadow,transform] duration-200",
        className,
      )}
    >
      {showFlag ? (
        <div
          className={cn(
            "project-identity-flag pointer-events-none absolute left-4 top-0 z-[2] h-5 w-3 bg-gradient-to-b shadow-sm [clip-path:polygon(0_0,100%_0,100%_72%,50%_100%,0_72%)]",
            gradient,
          )}
          aria-hidden
        />
      ) : null}
      <div className={cn("relative z-[1] flex min-h-0 flex-1 flex-col", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
