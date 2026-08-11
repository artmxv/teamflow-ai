import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type GoogleAuthButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

/** Official multicolor Google "G" — no third-party icon package. */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  label,
  onClick,
  disabled = false,
  loading = false,
  className,
}: GoogleAuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-control-border bg-card px-4 text-sm font-medium leading-[1.3] text-foreground shadow-[0_1px_2px_rgba(31,29,25,0.04)] outline-none transition-[background-color,border-color,box-shadow]",
        "hover:border-[color-mix(in_oklch,var(--control-border)_78%,var(--foreground))] hover:bg-control-hover hover:shadow-[0_2px_8px_rgba(31,29,25,0.06)]",
        "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--brand-ring)_40%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <GoogleGlyph className="size-4 shrink-0" />
      )}
      <span>{label}</span>
    </button>
  );
}
