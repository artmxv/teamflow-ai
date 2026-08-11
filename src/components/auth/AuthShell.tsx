import type { ReactNode } from "react";
import { ArrowRight, Check, FolderKanban, ListChecks } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PublicPageShell } from "@/components/landing/PublicPageShell";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

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
    <PublicPageShell mode="auth">
      <div className="auth-layout grid min-h-[100svh] lg:grid-cols-[54fr_46fr]">
        <aside className="auth-story-panel relative hidden overflow-hidden lg:flex lg:flex-col">
          <div className="auth-story-panel__grid" aria-hidden />
          <div className="relative z-10 flex h-full flex-col px-10 py-8 xl:px-16 xl:py-10">
            <BrandLogo className="w-fit" />
            <div className="my-auto max-w-[560px] py-10">
              <p className="public-eyebrow public-eyebrow--dark">TEAMFLOW AI / WORKSPACE</p>
              <h2 className="auth-story-title mt-5 max-w-[540px] text-balance text-4xl font-semibold tracking-[-0.045em] text-white xl:text-[3.4rem]">
                {t("auth.shell.leadTitle")}
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-white/58">{t("auth.shell.leadBody")}</p>

              <div className="auth-flow" aria-hidden>
                <div className="auth-flow__node"><FolderKanban /><span><small>01</small>{t("auth.shell.flowProject")}</span></div>
                <ArrowRight className="auth-flow__arrow" />
                <div className="auth-flow__node"><ListChecks /><span><small>02</small>{t("auth.shell.flowTask")}</span></div>
                <ArrowRight className="auth-flow__arrow" />
                <div className="auth-flow__node"><Check /><span><small>03</small>{t("auth.shell.flowStatus")}</span></div>
              </div>
            </div>
            <p className="text-xs text-white/32">© 2026 TeamFlow AI</p>
          </div>
        </aside>

        <main className="auth-form-panel flex min-h-[100svh] items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
          <div className="auth-form-wrap w-full max-w-[410px]">
            <div className="mb-8 flex items-center justify-between gap-3 lg:justify-end">
              <BrandLogo className="lg:hidden" />
              <LanguageSwitcher className="shrink-0" />
            </div>
            <div className="auth-card">
              <h1 className="text-3xl font-semibold tracking-[-0.035em]">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              <div className="auth-card__body mt-7">{children}</div>
              <div className="auth-card__footer mt-6 text-sm leading-relaxed text-muted-foreground">{footer}</div>
            </div>
          </div>
        </main>
      </div>
    </PublicPageShell>
  );
}
