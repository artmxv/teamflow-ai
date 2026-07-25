import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { PageHeader } from "@/components/app/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useI18n, type TKey } from "@/lib/i18n";
import { fetchBillingSummary, type BillingPlanId, type BillingSummary } from "@/lib/api/billing";
import { Info } from "lucide-react";

export const Route = createFileRoute("/app/billing")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Billing — TeamFlow AI" }] }),
  component: BillingPage,
});

const BILLING_QUERY_KEY = ["billing", "summary"] as const;

const PLAN_LABEL_KEYS: Record<BillingPlanId, TKey> = {
  FREE: "billing.plan.free",
  TEAM: "billing.plan.team",
  BUSINESS: "billing.plan.business",
  ENTERPRISE: "billing.plan.enterprise",
};

const PLAN_DESC_KEYS: Record<BillingPlanId, TKey> = {
  FREE: "billing.planDesc.free",
  TEAM: "billing.planDesc.team",
  BUSINESS: "billing.planDesc.business",
  ENTERPRISE: "billing.planDesc.enterprise",
};

function formatLimitValue(value: number | null, t: (k: TKey) => string): string {
  if (value === null) {
    return t("billing.unlimited");
  }
  return String(value);
}

function usagePercent(used: number, max: number | null): number | null {
  if (max === null || max <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((used / max) * 100)));
}

function BillingPage() {
  const { t } = useI18n();

  const summaryQuery = useQuery({
    queryKey: BILLING_QUERY_KEY,
    queryFn: fetchBillingSummary,
  });

  const summary = summaryQuery.data;

  return (
    <AppShell>
      <PageHeader title={t("side.billing")} subtitle={t("billing.previewSubtitle")} />

      <Alert className="mb-6 border-border/80 bg-card shadow-soft ring-1 ring-primary/15">
        <Info className="size-4 text-primary" />
        <AlertTitle className="text-foreground">{t("billing.previewTitle")}</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {t("billing.previewBanner")}
        </AlertDescription>
      </Alert>

      {summaryQuery.isLoading ? (
        <BillingSkeleton />
      ) : summaryQuery.isError || !summary ? (
        <ApiErrorState
          title={t("billing.loadErrorTitle")}
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : (
        <BillingContent summary={summary} t={t} />
      )}
    </AppShell>
  );
}

function BillingContent({ summary, t }: { summary: BillingSummary; t: (k: TKey) => string }) {
  const currentPlanKey = PLAN_LABEL_KEYS[summary.currentPlan];
  const seatsUsed = summary.usage.members + summary.usage.pendingInvitations;
  const membersPercent = usagePercent(summary.usage.members, summary.limits.maxMembers);
  const seatsPercent = usagePercent(seatsUsed, summary.limits.maxMembers);
  const workspacesPercent = usagePercent(summary.usage.workspaces, summary.limits.maxWorkspaces);

  return (
    <>
      <section aria-labelledby="billing-overview-heading">
        <h2 id="billing-overview-heading" className="sr-only">
          {t("billing.overview")}
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("billing.overview")}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">{t(currentPlanKey)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("billing.planLimits")}</p>
              </div>
              <Badge variant="outline" className="shrink-0 border-primary/30 bg-card text-primary">
                {t("billing.currentPlan")}
              </Badge>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Stat
                label={t("billing.activeMembers")}
                value={`${summary.usage.members}${
                  summary.limits.maxMembers !== null
                    ? ` / ${summary.limits.maxMembers}`
                    : ` · ${t("billing.unlimited")}`
                }`}
              />
              <Stat
                label={t("billing.pendingInvitations")}
                value={String(summary.usage.pendingInvitations)}
                muted
              />
              <Stat
                label={t("billing.seatsUsed")}
                value={`${seatsUsed}${
                  summary.limits.maxMembers !== null
                    ? ` / ${summary.limits.maxMembers}`
                    : ` · ${t("billing.unlimited")}`
                }`}
              />
              <Stat
                label={t("billing.workspacesUsed")}
                value={`${summary.usage.workspaces} / ${formatLimitValue(summary.limits.maxWorkspaces, t)}`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="text-base font-semibold">{t("billing.planUsage")}</h3>
            <div className="mt-5 space-y-5">
              <UsageRow
                label={t("billing.activeMembers")}
                used={summary.usage.members}
                max={summary.limits.maxMembers}
                percent={membersPercent}
                unlimitedLabel={t("billing.unlimited")}
              />
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 text-muted-foreground">
                    {t("billing.pendingInvitations")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {summary.usage.pendingInvitations}
                  </span>
                </div>
              </div>
              <UsageRow
                label={t("billing.seatsUsed")}
                used={seatsUsed}
                max={summary.limits.maxMembers}
                percent={seatsPercent}
                unlimitedLabel={t("billing.unlimited")}
              />
              <UsageRow
                label={t("billing.workspacesUsed")}
                used={summary.usage.workspaces}
                max={summary.limits.maxWorkspaces}
                percent={workspacesPercent}
                unlimitedLabel={t("billing.unlimited")}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="billing-plans-heading">
        <div className="mb-4">
          <h3 id="billing-plans-heading" className="text-base font-semibold">
            {t("billing.planDetails")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("billing.onlineBillingUnavailable")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summary.plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} t={t} />
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("billing.ownerManagesLater")}</p>
      </section>
    </>
  );
}

function UsageRow({
  label,
  used,
  max,
  percent,
  unlimitedLabel,
}: {
  label: string;
  used: number;
  max: number | null;
  percent: number | null;
  unlimitedLabel: string;
}) {
  const valueLabel = max === null ? `${used} · ${unlimitedLabel}` : `${used} / ${max}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="min-w-0 text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{valueLabel}</span>
      </div>
      {percent !== null ? (
        <Progress className="mt-2 h-2" value={percent} />
      ) : (
        <div className="mt-2 h-2 rounded-full bg-primary/15" aria-hidden />
      )}
    </div>
  );
}

function PlanCard({ plan, t }: { plan: BillingSummary["plans"][number]; t: (k: TKey) => string }) {
  const labelKey = PLAN_LABEL_KEYS[plan.id];
  const planName = t(labelKey);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-5 shadow-soft ${
        plan.isCurrent ? "border-primary ring-1 ring-primary/25" : "border-border"
      }`}
    >
      {plan.isCurrent ? (
        <Badge className="absolute right-3 top-3 border-0 bg-primary/15 font-normal text-primary">
          {t("billing.currentPlan")}
        </Badge>
      ) : null}
      <div className={`text-lg font-semibold ${plan.isCurrent ? "pr-24" : ""}`}>{planName}</div>
      <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
        {t(PLAN_DESC_KEYS[plan.id])}
      </p>
      <ul className="mt-3 flex-1 space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <li>
          {t("billing.maxMembers")}: {formatLimitValue(plan.maxMembers, t)}
        </li>
        <li>
          {t("billing.maxWorkspaces")}: {formatLimitValue(plan.maxWorkspaces, t)}
        </li>
      </ul>
      <div className="mt-4">
        {plan.isCurrent ? (
          <Button variant="outline" size="sm" className="w-full" disabled>
            {t("billing.currentPlan")}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="w-full" disabled>
              {t("billing.comingSoon")}
            </Button>
            <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
              {t("billing.onlineBillingUnavailable")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border p-4 ${
        muted ? "border-dashed bg-muted/25" : "bg-card/80 shadow-sm"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 break-words text-lg font-semibold tabular-nums ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
