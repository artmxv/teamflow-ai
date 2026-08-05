import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";

export function Hero() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 public-ambient" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40" />

      <div className="mx-auto max-w-7xl px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-24">
        <div className="public-animate-in mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
          <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary" />
          <span className="min-w-0 break-words text-left">{t("landing.hero.badge")}</span>
        </div>

        <h1 className="public-animate-in public-animate-in-delay-1 public-hero-title mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {t("landing.hero.title")}
        </h1>

        <p className="public-animate-in public-animate-in-delay-2 public-body mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {t("landing.hero.subtitle")}
        </p>

        <div className="public-animate-in public-animate-in-delay-3 mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild size="lg" variant="brand">
            <Link to="/signup">
              {t("landing.cta.createAccount")} <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#features">{t("landing.hero.explore")}</a>
          </Button>
        </div>

        <div className="mt-4 px-2 text-xs text-muted-foreground">{t("landing.hero.planNote")}</div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  const { t } = useI18n();

  const sidebarItems: TKey[] = [
    "side.dashboard",
    "side.projects",
    "side.kanban",
    "side.team",
    "side.chat",
    "side.assistant",
  ];

  const stats: { labelKey: TKey; value: string }[] = [
    { labelKey: "landing.preview.activeProjects", value: "12" },
    { labelKey: "landing.preview.openTasks", value: "84" },
    { labelKey: "landing.preview.doneThisWeek", value: "37" },
    { labelKey: "landing.preview.teamMembers", value: "9" },
  ];

  const projects: { gradient: string; nameKey: TKey; percent: number }[] = [
    {
      gradient: "from-indigo-500 to-violet-500",
      nameKey: "landing.preview.projectOrion",
      percent: 72,
    },
    {
      gradient: "from-blue-500 to-cyan-500",
      nameKey: "landing.preview.projectMobile",
      percent: 41,
    },
    {
      gradient: "from-fuchsia-500 to-pink-500",
      nameKey: "landing.preview.projectMarketing",
      percent: 12,
    },
  ];

  return (
    <div className="public-animate-in public-animate-in-delay-3 mx-auto mt-14 max-w-6xl sm:mt-16">
      <div className="relative rounded-2xl border border-border bg-card/90 p-2 shadow-card sm:rounded-3xl">
        <div className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-brand opacity-20 blur-2xl sm:rounded-3xl" />
        <div className="overflow-hidden rounded-xl border border-border bg-background sm:rounded-2xl">
          <div className="flex min-w-0 items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-2">
            <span className="size-2.5 shrink-0 rounded-full bg-red-400/70" />
            <span className="size-2.5 shrink-0 rounded-full bg-amber-400/70" />
            <span className="size-2.5 shrink-0 rounded-full bg-emerald-400/70" />
            <div className="ml-3 min-w-0 truncate text-xs text-muted-foreground">
              {t("landing.preview.windowTitle")}
            </div>
          </div>
          <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-[180px_1fr]">
            <div className="hidden space-y-1.5 md:block">
              {sidebarItems.map((key, idx) => (
                <div
                  key={key}
                  className={
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs " +
                    (idx === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground")
                  }
                >
                  <span className="size-1.5 rounded-full bg-primary/70" /> {t(key)}
                </div>
              ))}
            </div>
            <div className="min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {stats.map((s) => (
                  <div
                    key={s.labelKey}
                    className="min-w-0 rounded-xl border border-border bg-card p-2.5 sm:p-3"
                  >
                    <div className="break-words text-[10px] text-muted-foreground">
                      {t(s.labelKey)}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                {projects.map((p) => (
                  <div
                    key={p.nameKey}
                    className="min-w-0 rounded-xl border border-border bg-card p-3"
                  >
                    <div className={"h-1.5 w-10 rounded-full bg-gradient-to-r " + p.gradient} />
                    <div className="mt-2 truncate text-xs font-medium">{t(p.nameKey)}</div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={"h-full rounded-full bg-gradient-to-r " + p.gradient}
                        style={{ width: p.percent + "%" }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {t("landing.preview.percentComplete").replace("{percent}", String(p.percent))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Sparkles className="size-3.5 shrink-0 text-primary" />
                    {t("landing.preview.briefingTitle")}
                  </div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {t("landing.preview.briefingBody")}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-left">
                  <div className="text-xs font-medium">{t("landing.preview.deadlinesTitle")}</div>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    <li className="truncate">{t("landing.preview.deadlineOne")}</li>
                    <li className="truncate">{t("landing.preview.deadlineTwo")}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
