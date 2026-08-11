import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AiCopilotScene } from "@/components/landing/scenes/AiCopilotScene";
import { CollaborationScene } from "@/components/landing/scenes/CollaborationScene";
import { WorkflowScene } from "@/components/landing/scenes/WorkflowScene";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function Features() {
  return (
    <>
      <AiCopilotSection />
      <WorkflowSection />
      <CollaborationSection />
    </>
  );
}

function AiCopilotSection() {
  const { t } = useI18n();

  return (
    <section id="ai" className="public-ai-section scroll-mt-16 border-b border-white/10">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <p className="public-eyebrow public-eyebrow--dark">{t("landing.ai.eyebrow")}</p>
            <h2 className="public-section-title mt-4 max-w-xl text-balance text-white">
              {t("landing.ai.title")}
            </h2>
          </div>
          <div className="lg:pb-1">
            <p className="public-body max-w-2xl text-white/62">{t("landing.ai.subtitle")}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-violet-300/80">
              {t("landing.ai.pointReadonly")}
            </p>
          </div>
        </div>
        <div className="mt-10 sm:mt-14"><AiCopilotScene /></div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const { t } = useI18n();

  return (
    <section id="product" className="scroll-mt-16 border-b border-border">
      <span id="features" className="pointer-events-none absolute -mt-16" aria-hidden />
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
        <div className="max-w-[760px]">
          <p className="public-eyebrow">{t("landing.workflow.eyebrow")}</p>
          <h2 className="public-section-title mt-4 text-balance">{t("landing.workflow.title")}</h2>
          <p className="public-body mt-5 max-w-2xl text-muted-foreground">{t("landing.workflow.subtitle")}</p>
        </div>
        <div className="mt-10 sm:mt-14"><WorkflowScene /></div>
      </div>
    </section>
  );
}

function CollaborationSection() {
  const { t } = useI18n();

  return (
    <section id="collaboration" className="public-collaboration-section scroll-mt-16 border-b border-border">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end lg:gap-16">
          <div>
            <p className="public-eyebrow">{t("landing.collaboration.eyebrow")}</p>
            <h2 className="public-section-title mt-4 text-balance">{t("landing.collaboration.title")}</h2>
          </div>
          <p className="public-body max-w-2xl text-muted-foreground">{t("landing.collaboration.subtitle")}</p>
        </div>
        <div className="mt-10 sm:mt-14"><CollaborationScene /></div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const { t } = useI18n();

  return (
    <section className="public-final-cta border-b border-border">
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-8 px-4 py-20 sm:px-6 sm:py-24 lg:flex-row lg:items-end lg:justify-between lg:py-28">
        <div>
          <p className="public-eyebrow">TEAMFLOW AI</p>
          <h2 className="public-section-title mt-4 max-w-[720px] text-balance">{t("landing.cta.title")}</h2>
          <p className="public-body mt-5 max-w-xl text-muted-foreground">{t("landing.cta.subtitle")}</p>
        </div>
        <Button asChild size="lg" variant="brand" className="public-primary-button shrink-0">
          <Link to="/signup">{t("nav.start")}<ArrowRight className="size-4" /></Link>
        </Button>
      </div>
    </section>
  );
}
