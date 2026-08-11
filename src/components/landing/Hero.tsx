import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AnimatedProductVisual } from "@/components/landing/AnimatedProductVisual";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function Hero() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden border-b border-border/45">
      <div className="pointer-events-none absolute inset-0 -z-10 public-ambient" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40" />

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-8 lg:py-12">
        <div className="min-w-0 text-left">
          <div className="public-animate-in inline-flex max-w-full text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="min-w-0 break-words">{t("landing.hero.badge")}</span>
          </div>

          <h1 className="public-animate-in public-animate-in-delay-1 public-hero-title mt-6 max-w-xl text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl lg:text-[3.65rem] lg:leading-[1.01]">
            {t("landing.hero.title")}
          </h1>

          <p className="public-animate-in public-animate-in-delay-2 public-body mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("landing.hero.subtitle")}
          </p>

          <div className="public-animate-in public-animate-in-delay-3 mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg" variant="brand">
              <Link to="/signup">
                {t("nav.start")} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/signin">{t("nav.signin")}</Link>
            </Button>
          </div>

          <div className="public-animate-in public-animate-in-delay-3 mt-4 text-xs text-muted-foreground">
            {t("landing.hero.planNote")}
          </div>
        </div>

        <div className="public-animate-in public-animate-in-delay-2 min-w-0 lg:-mr-8 xl:-mr-12">
          <AnimatedProductVisual variant="hero" scene="dashboard" />
        </div>
      </div>
    </section>
  );
}
