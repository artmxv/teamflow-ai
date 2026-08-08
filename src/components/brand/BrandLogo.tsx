import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  wordmarkClassName?: string;
  /** When false, renders a non-link mark (e.g. inside another link). */
  asLink?: boolean;
  size?: "sm" | "md";
};

type BrandAiBadgeProps = {
  className?: string;
};

/**
 * Theme-aware "AI" chip used next to the TeamFlow wordmark in app chrome and boot.
 * Uses active theme primary tokens (default / ocean / emerald / sunset × light / dark).
 */
export function BrandAiBadge({ className }: BrandAiBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-md bg-primary/14 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary",
        className,
      )}
    >
      AI
    </span>
  );
}

/**
 * Compact AI flash mark (restored from backup/yookassa-ui-wip-2026-08-07).
 * Colors come from --brand-from / --brand-to of the active product theme.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "brand-mark relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
      aria-hidden
    >
      <span className="brand-mark__glow" />
      <span className="brand-mark__shine" />
      <Sparkles
        className="brand-mark__icon relative z-10 size-[58%] text-white"
        strokeWidth={2.35}
      />
    </span>
  );
}

/**
 * TeamFlow wordmark with a distinct AI accent.
 * Public surfaces may override via --public-wordmark / --public-ai*; app falls back to theme tokens.
 */
export function BrandLogo({
  className,
  wordmarkClassName,
  asLink = true,
  size = "md",
}: BrandLogoProps) {
  const markSize = size === "sm" ? "size-7 rounded-[10px]" : "size-8 rounded-xl";
  const textSize = size === "sm" ? "text-sm" : "text-base";

  const content = (
    <>
      <BrandMark className={cn("shrink-0", markSize)} />
      <span
        className={cn(
          "whitespace-nowrap font-semibold tracking-tight leading-[1.2]",
          textSize,
          wordmarkClassName,
        )}
      >
        <span className="text-[color:var(--public-wordmark,var(--foreground))]">TeamFlow</span>{" "}
        <span className="rounded-[0.35em] bg-[color:var(--public-ai-surface,color-mix(in_oklch,var(--primary)_16%,transparent))] px-[0.3em] py-[0.08em] text-[color:var(--public-ai,var(--primary))]">
          AI
        </span>
      </span>
    </>
  );

  if (!asLink) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>{content}</span>
    );
  }

  return (
    <Link to="/" className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      {content}
    </Link>
  );
}
