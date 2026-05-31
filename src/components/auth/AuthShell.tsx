import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden overflow-hidden lg:flex">
        <div className="absolute inset-0 bg-gradient-brand" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="relative z-10 flex w-full flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Sparkles className="size-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">TeamFlow AI</span>
          </Link>
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm leading-relaxed text-white/90">
                "TeamFlow's AI assistant gave us back two hours every standup. It's the project tool I always wanted."
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-white/20 text-xs font-semibold">RB</div>
                <div className="text-sm">
                  <div className="font-medium">Rita Bauer</div>
                  <div className="text-white/70 text-xs">Head of Product, Northwind</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-white/60">© 2026 TeamFlow Labs, Inc.</div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight">TeamFlow AI</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>
    </div>
  );
}
