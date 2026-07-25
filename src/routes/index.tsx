import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  KanbanSquare,
  Bot,
  Users,
  ShieldCheck,
  Zap,
  Check,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { Github, Twitter, Linkedin } from "lucide-react";

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
      <LogoCloud />
      <Features />
      <DashboardPreview />
      <Pricing />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand shadow-glow">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight">TeamFlow AI</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#preview" className="hover:text-foreground">
            Product
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#" className="hover:text-foreground">
            Docs
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Link
            to="/app/dashboard"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block"
          >
            Sign in
          </Link>
          <Button
            asChild
            size="sm"
            className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
          >
            <Link to="/app/dashboard">
              Get started free <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid opacity-50" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,oklch(0.7_0.18_277/0.18),transparent_60%)]" />

      <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 text-center sm:pt-28">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
          <span className="inline-block size-1.5 rounded-full bg-primary" />
          New · Workspace briefings and standup summaries
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          The focused workspace for{" "}
          <span className="text-gradient-brand">modern product teams</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          TeamFlow AI brings projects, tasks, deadlines, and team chat into one calm, fast workspace
          — with briefings based on the workspace data you can access.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
          >
            <Link to="/app/dashboard">
              Open live demo <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/app/dashboard">
              <PlayCircle className="size-4" /> View demo
            </Link>
          </Button>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Free for up to 5 teammates · No credit card required
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="mx-auto mt-16 max-w-6xl">
      <div className="relative rounded-3xl border border-border bg-card p-2 shadow-card">
        <div className="absolute -inset-px -z-10 rounded-3xl bg-gradient-brand opacity-20 blur-2xl" />
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-2">
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-emerald-400/70" />
            <div className="ml-3 text-xs text-muted-foreground">teamflow.ai/app/dashboard</div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-[180px_1fr]">
            <div className="hidden space-y-2 md:block">
              {["Dashboard", "Projects", "Kanban", "Team", "AI Assistant"].map((i, idx) => (
                <div
                  key={i}
                  className={
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs " +
                    (idx === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground")
                  }
                >
                  <span className="size-1.5 rounded-full bg-primary/70" /> {i}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: "Active projects", v: "12" },
                  { l: "Open tasks", v: "84" },
                  { l: "Done this week", v: "37" },
                  { l: "Team members", v: "9" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-border bg-card p-3">
                    <div className="text-[10px] text-muted-foreground">{s.l}</div>
                    <div className="mt-1 text-lg font-semibold">{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { c: "from-indigo-500 to-violet-500", n: "Orion Web App", p: 72 },
                  { c: "from-blue-500 to-cyan-500", n: "Mobile App v3", p: 41 },
                  { c: "from-fuchsia-500 to-pink-500", n: "Marketing Site", p: 12 },
                ].map((p) => (
                  <div key={p.n} className="rounded-xl border border-border bg-card p-3">
                    <div className={"h-1.5 w-10 rounded-full bg-gradient-to-r " + p.c} />
                    <div className="mt-2 text-xs font-medium">{p.n}</div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={"h-full rounded-full bg-gradient-to-r " + p.c}
                        style={{ width: p.p + "%" }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{p.p}% complete</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-gradient-to-br from-primary/8 to-transparent p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Sparkles className="size-3.5 text-primary" />
                  Workspace briefing
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Overview from accessible projects: 3 high-priority tasks are unassigned. Next:
                  assign owners and review open risks.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoCloud() {
  const logos = ["Northwind", "Atlas Robotics", "Quanta", "Lumen Labs", "Helios", "Vertex"];
  return (
    <section className="border-y border-border/60 bg-muted/30 py-10">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trusted by fast-moving product teams
        </div>
        <div className="mt-6 grid grid-cols-2 items-center gap-x-8 gap-y-4 text-sm font-semibold text-muted-foreground/70 sm:grid-cols-3 md:grid-cols-6">
          {logos.map((l) => (
            <div key={l} className="tracking-tight">
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: KanbanSquare,
      title: "A board that keeps work visible",
      body: "Drag-and-drop kanban with statuses, priorities, assignees, and deadlines.",
    },
    {
      icon: Bot,
      title: "Grounded workspace briefings",
      body: "Review an overview, risks, recommended next actions, and a standup summary based on accessible projects and tasks.",
    },
    {
      icon: Users,
      title: "Made for small teams",
      body: "Workspaces, roles, and approvals that scale from 3 to 30 without ceremony.",
    },
    {
      icon: Zap,
      title: "Calm by default",
      body: "Quiet notifications, smart inbox, and zero-noise updates that respect focus time.",
    },
    {
      icon: ShieldCheck,
      title: "Secure & private",
      body: "Workspace roles and permissions so the right people can manage projects and invites.",
    },
    {
      icon: Sparkles,
      title: "Polished, fast UI",
      body: "Designed for keyboard-first power users. 60fps interactions, even on big boards.",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          Why TeamFlow
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything your team needs. Nothing they don't.
        </h2>
        <p className="mt-4 text-muted-foreground">
          We obsessed over the small things so your team can focus on shipping the big ones.
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section id="preview" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              Product
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              A workspace that earns its place on your dock
            </h2>
            <p className="mt-4 text-muted-foreground">
              From the daily standup view to the deep-focus kanban, TeamFlow is designed for product
              teams that ship every week.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Realtime collaboration with presence and cursors",
                "Workspace briefings with overview, risks, and standup summaries",
                "Custom workflows, fields, and saved views",
                "Native iOS, Android, and desktop apps",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex gap-3">
              <Button asChild className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
                <Link to="/app/dashboard">Open live demo</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/board">Try the kanban</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-2 shadow-card">
            <div className="overflow-hidden rounded-2xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="text-sm font-semibold">Sprint 24 · Kanban</div>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px]">12 tasks</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { t: "Todo", n: 4 },
                  { t: "In Progress", n: 3 },
                  { t: "Review", n: 5 },
                ].map((col) => (
                  <div key={col.t} className="rounded-xl bg-muted/60 p-2">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>{col.t}</span>
                      <span>{col.n}</span>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: col.n }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-border bg-card p-2 shadow-soft"
                        >
                          <div className="text-[10px] text-muted-foreground">TF-{200 + i}</div>
                          <div className="text-xs font-medium">Polish onboarding copy</div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="rounded bg-accent/60 px-1 py-0.5 text-[9px] text-accent-foreground">
                              design
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
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
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
                <Link to="/app/dashboard">{t("pricing.getStarted")}</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-brand p-10 text-white shadow-glow sm:p-14">
        <div className="absolute inset-0 bg-grid opacity-25" />
        <div className="relative z-10 grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Bring calm focus to your next sprint
            </h3>
            <p className="mt-2 max-w-xl text-white/85">
              Get the workspace your team will actually want to open every morning.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/app/dashboard">Get started free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              <Link to="/app/dashboard">View demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand">
                <Sparkles className="size-4 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight">TeamFlow AI</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Project management and grounded workspace briefings for modern product teams.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="grid size-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 md:col-span-8">
            {[
              { h: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { h: "Company", links: ["About", "Careers", "Blog", "Contact"] },
              { h: "Resources", links: ["Docs", "Guides", "Status", "Security"] },
              { h: "Legal", links: ["Privacy", "Terms", "DPA", "Cookies"] },
            ].map((col) => (
              <div key={col.h}>
                <div className="text-sm font-semibold">{col.h}</div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="hover:text-foreground">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© 2026 TeamFlow Labs, Inc. · All rights reserved</span>
          <span className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              Status
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
