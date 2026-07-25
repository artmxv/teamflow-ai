import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  Github,
  KanbanSquare,
  ListTodo,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher, useI18n, type TKey } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TeamFlow AI — Project management for product teams" },
      {
        name: "description",
        content:
          "TeamFlow AI is a project management workspace for small product teams with projects, tasks, team chat, and grounded workspace briefings.",
      },
      { property: "og:title", content: "TeamFlow AI — Project management for product teams" },
      {
        property: "og:description",
        content:
          "Plan projects, manage tasks, collaborate in team chat, and review briefings grounded in your workspace data.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <Features />
      <DashboardPreview />
      <Pricing />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand shadow-glow">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="truncate text-base font-semibold tracking-tight">TeamFlow AI</span>
        </Link>
        <nav className="ml-2 hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">
            {t("nav.features")}
          </a>
          <a href="#preview" className="hover:text-foreground">
            {t("nav.product")}
          </a>
          <a href="#pricing" className="hover:text-foreground">
            {t("nav.pricing")}
          </a>
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher className="shrink-0" />
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            to="/signin"
            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"
          >
            {t("nav.signin")}
          </Link>
          <Button
            asChild
            size="sm"
            className="shrink-0 bg-gradient-brand text-white shadow-glow hover:opacity-95"
          >
            <Link to="/signup">
              <span className="sm:hidden">{t("landing.cta.createAccountShort")}</span>
              <span className="hidden sm:inline">{t("nav.start")}</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid opacity-50" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,oklch(0.7_0.18_277/0.18),transparent_60%)]" />

      <div className="mx-auto max-w-7xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-28">
        <div className="mx-auto inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
          <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary" />
          <span className="min-w-0 break-words text-left">{t("landing.hero.badge")}</span>
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          {t("landing.hero.titleBefore")}{" "}
          <span className="text-gradient-brand">{t("landing.hero.titleAccent")}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {t("landing.hero.subtitle")}
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            asChild
            size="lg"
            className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
          >
            <Link to="/signup">
              {t("landing.cta.createAccount")} <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/signin">{t("nav.signin")}</Link>
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
    "side.assistant",
  ];

  const stats: { labelKey: TKey; value: string }[] = [
    { labelKey: "landing.preview.activeProjects", value: "12" },
    { labelKey: "landing.preview.openTasks", value: "84" },
    { labelKey: "landing.preview.doneThisWeek", value: "37" },
    { labelKey: "landing.preview.teamMembers", value: "9" },
  ];

  const projects = [
    { c: "from-indigo-500 to-violet-500", n: "Orion Web App", p: 72 },
    { c: "from-blue-500 to-cyan-500", n: "Mobile App v3", p: 41 },
    { c: "from-fuchsia-500 to-pink-500", n: "Marketing Site", p: 12 },
  ];

  return (
    <div className="mx-auto mt-16 max-w-6xl">
      <div className="relative rounded-3xl border border-border bg-card p-2 shadow-card">
        <div className="absolute -inset-px -z-10 rounded-3xl bg-gradient-brand opacity-20 blur-2xl" />
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex min-w-0 items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-2">
            <span className="size-2.5 shrink-0 rounded-full bg-red-400/70" />
            <span className="size-2.5 shrink-0 rounded-full bg-amber-400/70" />
            <span className="size-2.5 shrink-0 rounded-full bg-emerald-400/70" />
            <div className="ml-3 min-w-0 truncate text-xs text-muted-foreground">
              {t("landing.preview.windowTitle")}
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-[180px_1fr]">
            <div className="hidden space-y-2 md:block">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((s) => (
                  <div
                    key={s.labelKey}
                    className="min-w-0 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="break-words text-[10px] text-muted-foreground">
                      {t(s.labelKey)}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {projects.map((p) => (
                  <div key={p.n} className="min-w-0 rounded-xl border border-border bg-card p-3">
                    <div className={"h-1.5 w-10 rounded-full bg-gradient-to-r " + p.c} />
                    <div className="mt-2 truncate text-xs font-medium">{p.n}</div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={"h-full rounded-full bg-gradient-to-r " + p.c}
                        style={{ width: p.p + "%" }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {t("landing.preview.percentComplete").replace("{percent}", String(p.p))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-gradient-to-br from-primary/8 to-transparent p-3 text-left">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Sparkles className="size-3.5 shrink-0 text-primary" />
                  {t("landing.preview.briefingTitle")}
                </div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {t("landing.preview.briefingBody")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  const { t } = useI18n();

  const items: { icon: typeof KanbanSquare; titleKey: TKey; bodyKey: TKey }[] = [
    {
      icon: ListTodo,
      titleKey: "landing.features.projectsTitle",
      bodyKey: "landing.features.projectsBody",
    },
    {
      icon: KanbanSquare,
      titleKey: "landing.features.kanbanTitle",
      bodyKey: "landing.features.kanbanBody",
    },
    {
      icon: MessageSquare,
      titleKey: "landing.features.chatTitle",
      bodyKey: "landing.features.chatBody",
    },
    {
      icon: Bot,
      titleKey: "landing.features.briefingsTitle",
      bodyKey: "landing.features.briefingsBody",
    },
    {
      icon: ShieldCheck,
      titleKey: "landing.features.rolesTitle",
      bodyKey: "landing.features.rolesBody",
    },
    {
      icon: Bell,
      titleKey: "landing.features.notificationsTitle",
      bodyKey: "landing.features.notificationsBody",
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("landing.features.eyebrow")}
        </div>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("landing.features.title")}
        </h2>
        <p className="mt-4 text-muted-foreground">{t("landing.features.subtitle")}</p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, titleKey, bodyKey }) => (
          <div
            key={titleKey}
            className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">{t(titleKey)}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{t(bodyKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPreview() {
  const { t } = useI18n();

  const productPoints: TKey[] = [
    "landing.product.pointChat",
    "landing.product.pointBriefings",
    "landing.product.pointAttachments",
    "landing.product.pointRoles",
  ];

  const columns: { titleKey: TKey; n: number }[] = [
    { titleKey: "board.todo", n: 4 },
    { titleKey: "board.inProgress", n: 3 },
    { titleKey: "board.review", n: 5 },
  ];

  return (
    <section id="preview" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t("nav.product")}
            </div>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.product.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("landing.product.subtitle")}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {productPoints.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0 break-words">{t(key)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
                <Link to="/signup">{t("landing.cta.createAccount")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/signin">{t("nav.signin")}</Link>
              </Button>
            </div>
          </div>
          <div className="min-w-0 rounded-3xl border border-border bg-card p-2 shadow-card">
            <div className="overflow-hidden rounded-2xl border border-border bg-background p-4">
              <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">{t("landing.preview.kanbanTitle")}</div>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px]">
                  {t("landing.preview.kanbanTasks").replace("{count}", "12")}
                </span>
              </div>
              <div className="min-w-0 overflow-x-auto">
                <div className="grid min-w-[28rem] grid-cols-3 gap-3 sm:min-w-0">
                  {columns.map((col) => (
                    <div key={col.titleKey} className="min-w-0 rounded-xl bg-muted/60 p-2">
                      <div className="mb-2 flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="min-w-0 truncate">{t(col.titleKey)}</span>
                        <span className="shrink-0">{col.n}</span>
                      </div>
                      <div className="space-y-2">
                        {Array.from({ length: col.n }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border bg-card p-2 shadow-soft"
                          >
                            <div className="text-[10px] text-muted-foreground">TF-{200 + i}</div>
                            <div className="truncate text-xs font-medium">
                              {t("landing.preview.sampleTask")}
                            </div>
                            <div className="mt-1.5 flex items-center justify-between">
                              <span className="rounded bg-accent/60 px-1 py-0.5 text-[9px] text-accent-foreground">
                                {t("landing.preview.sampleTag")}
                              </span>
                              <span className="size-4 rounded-full bg-gradient-brand" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Marketing plan limits — mirrors backend PLAN_CONFIG (members / workspaces only). */
const MARKETING_PLANS = [
  {
    id: "FREE" as const,
    nameKey: "billing.plan.free" as const,
    descKey: "billing.planDesc.free" as const,
    maxMembers: 5,
    maxWorkspaces: 1,
    paid: false,
  },
  {
    id: "TEAM" as const,
    nameKey: "billing.plan.team" as const,
    descKey: "billing.planDesc.team" as const,
    maxMembers: 10,
    maxWorkspaces: 2,
    paid: true,
  },
  {
    id: "BUSINESS" as const,
    nameKey: "billing.plan.business" as const,
    descKey: "billing.planDesc.business" as const,
    maxMembers: 20,
    maxWorkspaces: 5,
    paid: true,
  },
  {
    id: "ENTERPRISE" as const,
    nameKey: "billing.plan.enterprise" as const,
    descKey: "billing.planDesc.enterprise" as const,
    maxMembers: null,
    maxWorkspaces: null,
    paid: true,
  },
];

function Pricing() {
  const { t } = useI18n();

  const featureLines = (plan: (typeof MARKETING_PLANS)[number]) => {
    const members =
      plan.maxMembers === null
        ? t("pricing.unlimitedMembers")
        : t("pricing.upToMembers").replace("{count}", String(plan.maxMembers));
    const workspaces =
      plan.maxWorkspaces === null
        ? t("pricing.unlimitedWorkspaces")
        : plan.maxWorkspaces === 1
          ? t("pricing.oneWorkspace")
          : t("pricing.upToWorkspaces").replace("{count}", String(plan.maxWorkspaces));
    return [members, workspaces];
  };

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("nav.pricing")}
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("pricing.title")}
        </h2>
        <p className="mt-4 text-muted-foreground">{t("pricing.subtitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("billing.onlineBillingUnavailable")}
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition"
          >
            <div className="text-sm font-semibold">{t(plan.nameKey)}</div>
            <div className="mt-3">
              <span className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {plan.paid ? t("billing.comingSoon") : t("pricing.priceFree")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t(plan.descKey)}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {featureLines(plan).map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0 break-words">{line}</span>
                </li>
              ))}
            </ul>
            {plan.paid ? (
              <Button className="mt-6 w-full" variant="outline" disabled>
                {t("billing.comingSoon")}
              </Button>
            ) : (
              <Button
                asChild
                className="mt-6 w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
              >
                <Link to="/signup">{t("pricing.getStarted")}</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  const { t } = useI18n();

  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-brand p-8 text-white shadow-glow sm:p-14">
        <div className="absolute inset-0 bg-grid opacity-25" />
        <div className="relative z-10 grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <h3 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("landing.cta.title")}
            </h3>
            <p className="mt-2 max-w-xl text-white/85">{t("landing.cta.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/signup">{t("landing.cta.createAccount")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              <Link to="/signin">{t("nav.signin")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const { t } = useI18n();

  const links = [
    { href: "#features", label: t("nav.features") },
    { href: "#preview", label: t("nav.product") },
    { href: "#pricing", label: t("nav.pricing") },
  ] as const;

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-sm">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand">
                <Sparkles className="size-4 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight">TeamFlow AI</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">{t("footer.tagline")}</p>
          </div>
          <nav
            aria-label={t("landing.footer.navLabel")}
            className="flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
          >
            {links.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </a>
            ))}
            <Link to="/signin" className="hover:text-foreground">
              {t("nav.signin")}
            </Link>
            <Link to="/signup" className="hover:text-foreground">
              {t("nav.start")}
            </Link>
            <a
              href="https://github.com/artmxv/teamflow-ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("landing.footer.githubAria")}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Github className="size-4" aria-hidden />
              GitHub
            </a>
          </nav>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>© 2026 TeamFlow AI. {t("footer.rights")}.</span>
        </div>
      </div>
    </footer>
  );
}
