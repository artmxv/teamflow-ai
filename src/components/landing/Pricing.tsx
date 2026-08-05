import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";

/** Marketing plan limits — mirrors backend PLAN_CONFIG (members / workspaces only). Restored from pre–Stage 109 landing. */
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

export function Pricing() {
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
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("nav.pricing")}
        </div>
        <h2 className="public-heading mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("pricing.title")}
        </h2>
        <p className="public-body mt-4 text-muted-foreground">{t("pricing.subtitle")}</p>
        <p className="public-body mt-2 text-sm text-muted-foreground">
          {t("billing.onlineBillingUnavailable")}
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className="flex h-full flex-col rounded-2xl border border-border bg-card/80 p-6 shadow-soft"
          >
            <div className="text-sm font-semibold leading-[1.3]">{t(plan.nameKey)}</div>
            <div className="mt-3">
              <span className="text-3xl font-semibold tracking-tight leading-[1.1] sm:text-4xl">
                {plan.paid ? t("billing.comingSoon") : t("pricing.priceFree")}
              </span>
            </div>
            <p className="public-body mt-1 text-sm text-muted-foreground">{t(plan.descKey)}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm leading-[1.55]">
              {featureLines(plan).map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 break-words">{line}</span>
                </li>
              ))}
            </ul>
            {plan.paid ? (
              <Button className="mt-6 w-full" variant="outline" disabled>
                {t("billing.comingSoon")}
              </Button>
            ) : (
              <Button asChild variant="brand" className="mt-6 w-full">
                <Link to="/signup">{t("pricing.getStarted")}</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
