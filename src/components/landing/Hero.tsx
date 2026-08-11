import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DashboardScene } from "@/components/landing/scenes/DashboardScene";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function Hero() {
  const { t } = useI18n();
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      if (reducedMotion.matches) {
        hero.style.setProperty("--hero-scroll-progress", "0");
        return;
      }

      const distance = Math.min(640, window.innerHeight * 0.72);
      const progress = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / distance));
      hero.style.setProperty("--hero-scroll-progress", progress.toFixed(3));
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    reducedMotion.addEventListener("change", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      reducedMotion.removeEventListener("change", scheduleUpdate);
    };
  }, []);

  return (
    <section ref={heroRef} className="public-hero relative overflow-hidden border-b border-border">
      <div className="public-hairline-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-[1280px] px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-20 lg:pb-20 lg:pt-24">
        <div className="mx-auto max-w-[860px] text-center">
          <div className="public-hero-scroll public-hero-scroll--eyebrow">
            <div className="public-animate-in text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700">
              {t("landing.hero.badge")}
            </div>
          </div>
          <div className="public-hero-scroll public-hero-scroll--headline">
            <h1 className="public-animate-in public-animate-in-delay-1 public-hero-title mx-auto mt-5 max-w-[840px] text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-[4.65rem]">
              {t("landing.hero.title")}
            </h1>
          </div>
          <div className="public-hero-scroll public-hero-scroll--support">
            <p className="public-animate-in public-animate-in-delay-2 public-body mx-auto mt-6 max-w-[720px] text-base text-muted-foreground sm:text-lg">
              {t("landing.hero.subtitle")}
            </p>
          </div>
          <div className="public-hero-scroll public-hero-scroll--actions">
            <div className="public-animate-in public-animate-in-delay-3 mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="brand" className="public-primary-button">
                <Link to="/signup">
                  {t("nav.start")} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="public-secondary-button">
                <Link to="/signin">{t("nav.signin")}</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="public-hero-scene-scroll">
          <div className="public-animate-in public-animate-in-delay-3 mx-auto mt-12 w-full max-w-[1240px] sm:mt-16">
            <DashboardScene />
          </div>
        </div>
      </div>
    </section>
  );
}
