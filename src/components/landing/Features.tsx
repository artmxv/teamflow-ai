import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  FolderKanban,
  ListChecks,
  MessageSquare,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AnimatedProductVisual } from "@/components/landing/AnimatedProductVisual";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";

type ProductCapability = {
  icon: LucideIcon;
  titleKey: TKey;
  bodyKey: TKey;
};

const AI_POINTS: TKey[] = [
  "landing.ai.pointAttention",
  "landing.ai.pointDeadlines",
  "landing.ai.pointLinks",
  "landing.ai.pointReadonly",
];

const PRODUCT_CAPABILITIES: ProductCapability[] = [
  {
    icon: FolderKanban,
    titleKey: "landing.grid.projectsTitle",
    bodyKey: "landing.grid.projectsBody",
  },
  {
    icon: ListChecks,
    titleKey: "landing.grid.tasksTitle",
    bodyKey: "landing.grid.tasksBody",
  },
  {
    icon: Users,
    titleKey: "landing.grid.teamTitle",
    bodyKey: "landing.grid.teamBody",
  },
  {
    icon: MessageSquare,
    titleKey: "landing.grid.chatTitle",
    bodyKey: "landing.grid.chatBody",
  },
  {
    icon: Sparkles,
    titleKey: "landing.grid.aiTitle",
    bodyKey: "landing.grid.aiBody",
  },
];

export function Features() {
  return (
    <>
      <AiCopilotSection />
      <ProductSection />
    </>
  );
}

function AiCopilotSection() {
  const { t } = useI18n();

  return (
    <section
      id="ai"
      className="relative scroll-mt-16 overflow-hidden border-b border-border/55 bg-muted/15 py-16 sm:py-20 lg:flex lg:min-h-[76svh] lg:items-center"
    >
      <div className="pointer-events-none absolute inset-0 public-section-glow public-section-glow--ai" />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {t("landing.ai.eyebrow")}
          </div>
          <h2 className="public-heading mt-3 max-w-xl text-balance text-3xl font-semibold tracking-[-0.025em] sm:text-4xl lg:text-[2.7rem] lg:leading-[1.08]">
            {t("landing.ai.title")}
          </h2>
          <p className="public-body mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("landing.ai.subtitle")}
          </p>

          <ul className="mt-7 grid gap-x-6 gap-y-3 text-sm leading-[1.55] sm:grid-cols-2 lg:grid-cols-1">
            {AI_POINTS.map((key) => (
              <li key={key} className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 break-words">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 lg:-mr-4">
          <AnimatedProductVisual variant="feature" scene="ai" />
        </div>
      </div>
    </section>
  );
}

function ProductSection() {
  const { t } = useI18n();

  return (
    <section
      id="product"
      className="relative scroll-mt-16 overflow-hidden py-16 sm:py-20 lg:flex lg:min-h-[82svh] lg:items-center"
    >
      <span id="features" className="pointer-events-none absolute -top-16" aria-hidden />
      <div className="pointer-events-none absolute inset-0 public-section-glow public-section-glow--product" />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-11 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <div className="min-w-0 lg:order-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {t("landing.grid.eyebrow")}
          </div>
          <h2 className="public-heading mt-3 max-w-xl text-balance text-3xl font-semibold tracking-[-0.025em] sm:text-4xl lg:text-[2.7rem] lg:leading-[1.08]">
            {t("landing.product.title")}
          </h2>
          <p className="public-body mt-4 max-w-xl text-muted-foreground">
            {t("landing.product.subtitle")}
          </p>

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {PRODUCT_CAPABILITIES.map(({ icon: Icon, titleKey, bodyKey }) => (
              <div
                key={titleKey}
                className="public-capability group flex min-w-0 items-start gap-3 rounded-xl border border-border/80 bg-card/55 px-3.5 py-3 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/80"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition duration-300 group-hover:bg-primary/15 group-hover:text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-[1.35]">{t(titleKey)}</span>
                  <span className="mt-0.5 block text-xs leading-[1.45] text-muted-foreground">
                    {t(bodyKey)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 lg:order-1 lg:-ml-4">
          <AnimatedProductVisual variant="feature" scene="dashboard" />
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const { t } = useI18n();

  return (
    <section className="border-t border-border/55 px-4 py-14 sm:px-6 sm:py-16">
      <div className="public-final-cta mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card/80 px-5 py-10 text-center shadow-card sm:px-10 sm:py-12">
        <h2 className="public-heading mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("landing.cta.title")}
        </h2>
        <p className="public-body mx-auto mt-3 max-w-xl text-muted-foreground">
          {t("landing.cta.subtitle")}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="brand">
            <Link to="/signup">
              {t("nav.start")} <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/signin">{t("nav.signin")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
