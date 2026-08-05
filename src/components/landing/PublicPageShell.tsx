import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scopes dark public marketing tokens so `/app` themes stay untouched. */
export function PublicPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("public-dark min-h-screen text-foreground", className)}>{children}</div>
  );
}
