import { type ReactNode } from "react";
import { Bot, Check, KanbanSquare, ListTodo, MessageSquare } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PublicPageShell } from "@/components/landing/PublicPageShell";
import { LanguageSwitcher, useI18n, type TKey } from "@/lib/i18n";

const AUTH_POINTS: TKey[] = [
  "landing.features.projectsTitle",
  "landing.features.kanbanTitle",
  "landing.features.chatTitle",
  "landing.features.briefingsTitle",
];

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
  const { t } = useI18n();

  return (
    <PublicPageShell className="relative">
      <div className="pointer-events-none absolute inset-0 public-ambient opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Brand panel — desktop only; mobile shows the form first */}
        <aside className="relative hidden overflow-hidden border-r border-border/60 lg:flex lg:flex-col lg:justify-center lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto w-full max-w-lg">
            <BrandLogo />
            <h2 className="public-heading mt-10 max-w-md text-balance text-3xl font-semibold tracking-tight xl:text-[2.1rem]">
              {t("auth.shell.leadTitle")}
            </h2>
            <p className="public-body mt-3 max-w-md text-sm text-muted-foreground">
              {t("auth.shell.leadBody")}
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-[1.45]">
              {AUTH_POINTS.map((key) => (
                <li key={key} className="flex items-center gap-2.5 text-foreground/90">
                  <span className="grid size-6 place-items-center rounded-md bg-accent text-accent-foreground">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-2xl border border-border bg-card/80 p-5 shadow-card">
              <div className="mb-4 text-xs font-medium leading-[1.3] text-muted-foreground">
                {t("landing.preview.windowTitle")}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniTile icon={ListTodo} label={t("side.projects")} />
                <MiniTile icon={KanbanSquare} label={t("side.kanban")} />
                <MiniTile icon={MessageSquare} label={t("side.chat")} />
                <MiniTile icon={Bot} label={t("side.assistant")} />
              </div>
              <p className="public-body mt-4 text-xs text-muted-foreground">
                {t("auth.shell.previewHint")}
              </p>
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <div className="flex items-center justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-5 flex items-center justify-between gap-3 lg:mb-6">
              <BrandLogo className="lg:hidden" />
              <LanguageSwitcher className="ml-auto shrink-0" />
            </div>

            <div className="rounded-2xl border border-border bg-card/85 p-5 shadow-card sm:p-7">
              <h1 className="public-heading text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="public-body mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              <div className="mt-6">{children}</div>
              <div className="mt-5 text-sm leading-[1.45] text-muted-foreground">{footer}</div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}

function MiniTile({ icon: Icon, label }: { icon: typeof ListTodo; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <Icon className="size-4 text-primary" aria-hidden />
      <div className="mt-2 truncate text-xs font-medium leading-[1.3]">{label}</div>
    </div>
  );
}
