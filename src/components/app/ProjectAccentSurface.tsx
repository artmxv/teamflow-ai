import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ProjectAccentSurfaceProps = {
  /** Tailwind `from-* to-*` project gradient classes. */
  gradient: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Project identity frame:
 * one clipped surface, bright left rail, left→right wash.
 * Replaces the old top color stripe on project cards / detail summary.
 */
export function ProjectAccentSurface({
  gradient,
  children,
  className,
  contentClassName,
}: ProjectAccentSurfaceProps) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft",
        className,
      )}
    >
      {/* Bright left identity rail — clipped by the same overflow/radius */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-[1] w-[3px] bg-gradient-to-b",
          gradient,
        )}
        aria-hidden
      />
      {/* Soft left→right project wash — same clip as the card surface */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r opacity-[0.15] dark:opacity-[0.22]",
          gradient,
        )}
        style={{
          WebkitMaskImage: "linear-gradient(to right, black 0%, transparent 72%)",
          maskImage: "linear-gradient(to right, black 0%, transparent 72%)",
        }}
        aria-hidden
      />
      <div className={cn("relative z-[1] flex min-h-0 flex-1 flex-col", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
