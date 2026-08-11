import { type ReactNode } from "react";
import { AnimatedProductVisual } from "@/components/landing/AnimatedProductVisual";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PublicPageShell } from "@/components/landing/PublicPageShell";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  /** Sign-in uses a clean atmospheric panel; sign-up can keep the product preview. */
  visual = "product",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  visual?: "product" | "ambient";
}) {
  const { t } = useI18n();
  const isAmbient = visual === "ambient";

  return (
    <PublicPageShell mode="auth" className="relative">
      <div className="pointer-events-none absolute inset-0 public-ambient opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />

      <div className="auth-layout relative z-10 grid min-h-[100svh] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
        <aside
          className={cn(
            "auth-visual-panel relative hidden min-h-0 overflow-hidden border-r border-border/60 lg:flex lg:flex-col lg:justify-center lg:px-10 lg:py-8 xl:px-14",
            isAmbient && "auth-visual-panel--ambient",
          )}
        >
          <div
            className={cn(
              "auth-visual-content mx-auto w-full",
              isAmbient ? "max-w-xl" : "max-w-2xl",
            )}
          >
            <BrandLogo />
            <h2
              className={cn(
                "auth-lead-title public-heading max-w-lg text-balance font-semibold tracking-tight",
                isAmbient
                  ? "mt-10 text-4xl leading-[1.08] xl:text-[2.75rem]"
                  : "mt-8 text-3xl xl:text-[2.1rem]",
              )}
            >
              {t("auth.shell.leadTitle")}
            </h2>
            <p
              className={cn(
                "auth-lead-body public-body max-w-lg text-muted-foreground",
                isAmbient ? "mt-5 text-base leading-relaxed" : "mt-3 text-sm",
              )}
            >
              {t("auth.shell.leadBody")}
            </p>

            {isAmbient ? (
              <div className="auth-ambient-stage relative mt-12 h-[min(42vh,22rem)] w-full max-w-lg" aria-hidden>
                <div className="auth-ambient-glow" />
                <div className="auth-visual-orbit auth-visual-orbit--ambient">
                  <span className="auth-visual-orbit__dot" />
                </div>
              </div>
            ) : (
              <>
                <div className="auth-visual-composition relative mt-5 max-w-[640px]">
                  <div className="auth-visual-orbit" aria-hidden>
                    <span className="auth-visual-orbit__dot" />
                  </div>
                  <AnimatedProductVisual variant="auth" scene="dashboard" className="relative z-10" />
                </div>

                <p className="auth-preview-hint public-body mt-3 max-w-xl text-xs text-muted-foreground">
                  {t("auth.shell.previewHint")}
                </p>
              </>
            )}
          </div>
        </aside>

        <div className="auth-form-panel flex min-h-0 items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-4">
          <div className="auth-form-wrap w-full max-w-[430px]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <BrandLogo className="lg:hidden" />
              <LanguageSwitcher className="ml-auto shrink-0" />
            </div>

            <div className="auth-card rounded-2xl border border-border bg-card/85 p-5 shadow-card sm:p-6">
              <h1 className="public-heading text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="public-body mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              <div className="auth-card__body mt-5">{children}</div>
              <div className="auth-card__footer mt-4 text-sm leading-[1.45] text-muted-foreground">
                {footer}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
