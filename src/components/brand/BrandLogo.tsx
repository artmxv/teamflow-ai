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
 * Theme-aware "AI" word used next to the TeamFlow wordmark in app chrome and boot.
 * Same size/weight/baseline as TeamFlow; only color differs (theme primary).
 */
export function BrandAiBadge({ className }: BrandAiBadgeProps) {
  return (
    <span
      className={cn(
        "leading-[1.2] tracking-tight text-[color:var(--public-ai,var(--primary))]",
        className,
      )}
    >
      AI
    </span>
  );
}

/**
 * Primary application mark: theme-aware spark (same identity as AI Copilot).
 * Colors come from --brand-from / --brand-to of the active product theme.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "brand-mark relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
      aria-hidden
    >
      <span className="brand-mark__glow" />
      <span className="brand-mark__shine" />
      <Sparkles
        className="brand-mark__icon relative z-10 size-[68%] text-white"
        strokeWidth={2.25}
      />
    </span>
  );
}

/**
 * @deprecated Prefer BrandMark. Kept for any stray imports during the logo transition.
 */
export function TeamFlowMark({ className }: { className?: string }) {
  return <BrandMark className={className} />;
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
  const markSize = size === "sm" ? "size-8" : "size-9";
  const textSize = size === "sm" ? "text-[15px]" : "text-lg";

  const content = (
    <>
      <BrandMark className={cn("shrink-0 self-center", markSize)} />
      <span
        className={cn(
          "inline-flex items-baseline gap-1.5 whitespace-nowrap font-semibold tracking-tight leading-none",
          textSize,
          wordmarkClassName,
        )}
      >
        <span className="text-[color:var(--public-wordmark,var(--foreground))]">TeamFlow</span>
        <BrandAiBadge />
      </span>
    </>
  );

  if (!asLink) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>{content}</span>
    );
  }

  return (
    <Link to="/" className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {content}
    </Link>
  );
}
