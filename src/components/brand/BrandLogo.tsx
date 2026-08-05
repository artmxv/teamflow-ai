import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  wordmarkClassName?: string;
  /** When false, renders a non-link mark (e.g. inside another link). */
  asLink?: boolean;
  size?: "sm" | "md";
};

/** Thin dual spark / bloom mark — purple + cyan, no filled tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Violet bloom / spark (left) */}
      <path
        d="M10 3.5C10 8.2 6.8 11.5 2.5 12.5C6.8 13.5 10 16.8 10 21.5C10 16.8 13.2 13.5 17.5 12.5C13.2 11.5 10 8.2 10 3.5Z"
        stroke="#A78BFA"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M10 7.2v10.6M5.1 12.5h9.8"
        stroke="#A78BFA"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      {/* Cyan bloom / spark (right, slightly lower) */}
      <path
        d="M24.5 6C24.5 10.1 21.8 12.9 18 13.8C21.8 14.7 24.5 17.5 24.5 21.6C24.5 17.5 27.2 14.7 31 13.8C27.2 12.9 24.5 10.1 24.5 6Z"
        stroke="#67E8F9"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M24.5 9.2v9.2M20.3 13.8h8.4"
        stroke="#67E8F9"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Public brand logo: dual thin geometric sparks + TeamFlow (light) / AI (cyan).
 */
export function BrandLogo({
  className,
  wordmarkClassName,
  asLink = true,
  size = "md",
}: BrandLogoProps) {
  const markSize = size === "sm" ? "h-6 w-[30px]" : "h-7 w-9";
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
        <span className="text-[color:var(--public-wordmark,#f4f6fb)]">TeamFlow</span>{" "}
        <span className="text-[color:var(--public-ai,#67E8F9)]">AI</span>
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
