import type { LucideIcon } from "lucide-react";
import { isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon?: ReactNode | LucideIcon;
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
};

function renderIcon(icon: ReactNode | LucideIcon) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Icon = icon as LucideIcon;
  return <Icon className="size-5" aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  const hasActions = primaryAction || secondaryAction;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-gradient-to-br from-primary/[0.04] via-card to-card text-center shadow-soft",
        compact ? "px-4 py-8" : "px-6 py-12 sm:px-10",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mx-auto grid place-items-center rounded-2xl border border-border/60 bg-accent/50 text-accent-foreground",
            compact ? "size-10" : "size-12",
          )}
        >
          {renderIcon(icon)}
        </div>
      ) : null}

      <h3
        className={cn("font-semibold tracking-tight", compact ? "mt-3 text-sm" : "mt-4 text-base")}
      >
        {title}
      </h3>

      {description ? (
        <p
          className={cn(
            "mx-auto max-w-sm text-muted-foreground",
            compact ? "mt-1 text-xs" : "mt-1.5 text-sm",
          )}
        >
          {description}
        </p>
      ) : null}

      {children}

      {hasActions ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 sm:flex-row",
            compact ? "mt-4" : "mt-5",
          )}
        >
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
