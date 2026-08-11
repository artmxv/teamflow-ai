import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scopes dark public marketing tokens so `/app` themes stay untouched. */
export function PublicPageShell({
  children,
  className,
  mode = "landing",
}: {
  children: ReactNode;
  className?: string;
  mode?: "landing" | "auth";
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("public-scrollbar");
    root.classList.toggle("public-auth-route", mode === "auth");

    return () => {
      root.classList.remove("public-scrollbar", "public-auth-route");
    };
  }, [mode]);

  return (
    <div
      className={cn(
        "public-dark min-h-screen text-foreground",
        mode === "auth" && "public-auth-page",
        className,
      )}
    >
      {children}
    </div>
  );
}
