import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppPageWidth = "default" | "wide" | "full";

export type AppPageProps = {
  children: ReactNode;
  className?: string;
  /** Content max-width. Shell uses `wide` by default so pages stay readable on ultra-wide screens. */
  width?: AppPageWidth;
};

const widthClass: Record<AppPageWidth, string> = {
  default: "max-w-6xl",
  wide: "max-w-[90rem]",
  full: "max-w-none",
};

/**
 * Shared page canvas inside AppShell: stable gutters and optional max-width.
 * Wrap route content via AppShell; do not mass-edit route files for layout alone.
 */
export function AppPage({ children, className, width = "wide" }: AppPageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7",
        widthClass[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
