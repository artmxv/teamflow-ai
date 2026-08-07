import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import {
  BILLING_SUMMARY_QUERY_KEY,
  confirmBillingPayment,
  createBillingPlanChange,
  fetchBillingSummary,
  type BillingPlanId,
  type BillingPlanUnavailableReason,
  type BillingSummary,
} from "@/lib/api/billing";
import { Check, CreditCard, ExternalLink, Info, Loader2 } from "lucide-react";
import { assertBrowserOnline, friendlyApiErrorMessage } from "@/lib/api-error";
import { ApiError } from "@/lib/api/client";
import { AUTH_ME_QUERY_KEY } from "@/lib/auth/auth-cache";
import { WORKSPACES_QUERY_KEY } from "@/lib/workspace-queries";

export const Route = createFileRoute("/app/billing")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Billing — TeamFlow AI" }] }),
  component: BillingPage,
});

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
const PLAN_CONFIRMATION_TIMEOUT_MS = 60_000;

const UNAVAILABLE_REASON_KEYS: Record<BillingPlanUnavailableReason, TKey> = {
  PAYMENT_PROVIDER_NOT_CONFIGURED: "billing.reason.paymentNotConfigured",
  WORKSPACE_LIMIT_EXCEEDED: "billing.reason.workspaceLimit",
  MEMBER_LIMIT_EXCEEDED: "billing.reason.memberLimit",
  OWNER_ONLY: "billing.reason.ownerOnly",
};

function formatLimitValue(value: number | null, t: (k: TKey) => string): string {
  if (value === null) {
    return t("billing.unlimited");
  }
  return String(value);
}

function formatRubPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(value);
}

function usagePercent(used: number, max: number | null): number | null {
  if (max === null || max <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((used / max) * 100)));
}

function isBillingPlanId(value: string | null): value is BillingPlanId {
  return value === "FREE" || value === "TEAM" || value === "BUSINESS" || value === "ENTERPRISE";
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function billingErrorMessage(
  error: unknown,
  t: (key: TKey) => string,
  requestedPlan?: BillingPlanId,
): string {
  if (!(error instanceof ApiError)) {
    return friendlyApiErrorMessage(error, t, "billing.loadErrorTitle");
  }

  const detailsPlan =
    typeof error.details?.targetPlan === "string" && isBillingPlanId(error.details.targetPlan)
      ? error.details.targetPlan
      : requestedPlan;
  const planName = detailsPlan ? t(PLAN_LABEL_KEYS[detailsPlan]) : "";
  const used = typeof error.details?.used === "number" ? error.details.used : null;
  const limit = typeof error.details?.limit === "number" ? error.details.limit : null;

  if (error.code === "PLAN_MEMBER_LIMIT_EXCEEDED" && used !== null && limit !== null) {
    return interpolate(t("billing.error.memberLimit"), { plan: planName, used, limit });
  }
  if (error.code === "PLAN_WORKSPACE_LIMIT_EXCEEDED" && used !== null && limit !== null) {
    return interpolate(t("billing.error.workspaceLimit"), { plan: planName, used, limit });
  }

  const errorKeys: Partial<Record<string, TKey>> = {
    BILLING_OWNER_REQUIRED: "billing.error.ownerOnly",
    BILLING_NOT_CONFIGURED: "billing.error.notConfigured",
    PLAN_ALREADY_CURRENT: "billing.error.alreadyCurrent",
    PLAN_NOT_SELF_SERVICE: "billing.error.notSelfService",
    YOOKASSA_ERROR: "billing.error.yookassa",
    PAYMENT_PROVIDER_UNAVAILABLE: "billing.error.providerUnavailable",
    YOOKASSA_TEST_MODE_REQUIRED: "billing.error.testModeRequired",
    PAYMENT_AMOUNT_MISMATCH: "billing.error.paymentFailed",
    PAYMENT_METADATA_MISMATCH: "billing.error.paymentFailed",
    PAYMENT_CANCELED: "billing.error.paymentCanceled",
    PAYMENT_NOT_FOUND: "billing.error.paymentFailed",
    PAYMENT_NOT_READY: "billing.error.paymentPending",
  };
  const key = error.code ? errorKeys[error.code] : undefined;
  return key ? t(key) : friendlyApiErrorMessage(error, t, "billing.loadErrorTitle");
}

function BillingPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const returnHandledRef = useRef(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const summaryQuery = useQuery({
    queryKey: BILLING_SUMMARY_QUERY_KEY,
    queryFn: fetchBillingSummary,
    refetchInterval: pendingPaymentId ? 5_000 : false,
  });

  const summary = summaryQuery.data;
  const planChangeMutation = useMutation({
    networkMode: "always",
    mutationFn: async (plan: Exclude<BillingPlanId, "ENTERPRISE">) => {
      assertBrowserOnline();
      return createBillingPlanChange(plan);
    },
    onSuccess: async (result) => {
      if (result.flow === "PAYMENT") {
        window.location.assign(result.confirmationUrl);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BILLING_SUMMARY_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
      ]);
      toast.success(t("billing.changeConfirmed"));
    },
    onError: (error, plan) => toast.error(billingErrorMessage(error, t, plan)),
  });

  useEffect(() => {
    if (returnHandledRef.current) {
      return;
    }
    returnHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const billingState = params.get("billing");
    const paymentId = params.get("paymentId");
    if (!billingState) {
      return;
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("billing");
    cleanUrl.searchParams.delete("paymentId");
    cleanUrl.searchParams.delete("plan");
    window.history.replaceState(window.history.state, "", cleanUrl);

    if (billingState === "cancelled") {
      toast.info(t("billing.changeCancelled"));
      return;
    }
    if (billingState !== "return" || !paymentId) {
      void queryClient.invalidateQueries({ queryKey: BILLING_SUMMARY_QUERY_KEY });
      return;
    }

    setPendingPaymentId(paymentId);
    setConfirmingPayment(true);
    toast.info(t("billing.checkingPayment"));

    void (async () => {
      try {
        assertBrowserOnline();
        const confirmation = await confirmBillingPayment(paymentId);
        await queryClient.invalidateQueries({ queryKey: BILLING_SUMMARY_QUERY_KEY });
        if (confirmation.status === "SUCCEEDED") {
          setPendingPaymentId(null);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
            queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
          ]);
          toast.success(t("billing.paymentSucceeded"));
          return;
        }
        if (confirmation.status === "CANCELED") {
          setPendingPaymentId(null);
          toast.error(t("billing.paymentCanceled"));
          return;
        }
        toast.info(t("billing.paymentPending"));
      } catch (error) {
        toast.error(billingErrorMessage(error, t));
      } finally {
        setConfirmingPayment(false);
      }
    })();
  }, [queryClient, t]);

  useEffect(() => {
    if (!pendingPaymentId || confirmingPayment) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPendingPaymentId(null);
      toast.info(t("billing.changeStillProcessing"));
    }, PLAN_CONFIRMATION_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [confirmingPayment, pendingPaymentId, t]);

  useEffect(() => {
    if (!pendingPaymentId || confirmingPayment || !summary) {
      return;
    }

    void (async () => {
      try {
        const confirmation = await confirmBillingPayment(pendingPaymentId);
        if (confirmation.status === "SUCCEEDED") {
          setPendingPaymentId(null);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: BILLING_SUMMARY_QUERY_KEY }),
            queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
            queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
          ]);
          toast.success(t("billing.paymentSucceeded"));
        } else if (confirmation.status === "CANCELED") {
          setPendingPaymentId(null);
          toast.error(t("billing.paymentCanceled"));
        }
      } catch {
        // Keep polling via refetchInterval until timeout.
      }
    })();
  }, [confirmingPayment, pendingPaymentId, queryClient, summary, t]);

  return (
    <AppShell>
      <PageHeader title={t("side.billing")} subtitle={t("billing.subtitle")} />

      {confirmingPayment || pendingPaymentId ? (
        <Alert className="mb-6 border-primary/25 bg-card shadow-soft ring-1 ring-primary/10">
          <Loader2 className="size-4 animate-spin text-primary" />
          <AlertTitle className="text-foreground">{t("billing.checkingPayment")}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {t("billing.paymentPending")}
          </AlertDescription>
        </Alert>
      ) : null}

      {summary ? (
        <Alert
          className={`mb-6 bg-card shadow-soft ${summary.billingConfigured ? "border-emerald-400/25 ring-1 ring-emerald-400/10" : "border-amber-400/25 ring-1 ring-amber-400/10"}`}
        >
          <Info className="size-4 text-primary" />
          <AlertTitle className="text-foreground">
            {summary.billingConfigured
              ? t("billing.yookassaReadyTitle")
              : t("billing.yookassaUnavailableTitle")}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {summary.billingConfigured
              ? summary.canManageBilling
                ? t("billing.yookassaReadyOwnerDesc")
                : t("billing.readOnlyDesc")
              : t("billing.yookassaUnavailableDesc")}
          </AlertDescription>
        </Alert>
      ) : null}

      {summaryQuery.isLoading ? (
        <BillingSkeleton />
      ) : summaryQuery.isError || !summary ? (
        <ApiErrorState
          title={t("billing.loadErrorTitle")}
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : (
        <BillingContent
          summary={summary}
          t={t}
          locale={lang}
          planChangePending={
            planChangeMutation.isPending ? (planChangeMutation.variables ?? null) : null
          }
          onPlanChange={(plan) => planChangeMutation.mutate(plan)}
        />
      )}
    </AppShell>
  );
}

function BillingContent({
  summary,
  t,
  locale,
  planChangePending,
  onPlanChange,
}: {
  summary: BillingSummary;
  t: (k: TKey) => string;
  locale: string;
  planChangePending: BillingPlanId | null;
  onPlanChange: (plan: Exclude<BillingPlanId, "ENTERPRISE">) => void;
}) {
  const currentPlanKey = PLAN_LABEL_KEYS[summary.currentPlan];
  const seatsUsed = summary.usage.members + summary.usage.pendingInvitations;
  const membersPercent = usagePercent(summary.usage.members, summary.limits.maxMembers);
  const seatsPercent = usagePercent(seatsUsed, summary.limits.maxMembers);
  const workspacesPercent = usagePercent(summary.usage.workspaces, summary.limits.maxWorkspaces);
  const planChangeBusy = planChangePending !== null;

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
          <p className="mt-1 text-sm text-muted-foreground">{t("billing.planChangeDesc")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summary.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              t={t}
              locale={locale}
              canManageBilling={summary.canManageBilling}
              busy={planChangeBusy}
              pending={planChangePending === plan.id}
              onPlanChange={onPlanChange}
            />
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("billing.ownerNote")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("billing.noAutoRenewalNote")}</p>
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

function PlanCard({
  plan,
  t,
  locale,
  canManageBilling,
  busy,
  pending,
  onPlanChange,
}: {
  plan: BillingSummary["plans"][number];
  t: (k: TKey) => string;
  locale: string;
  canManageBilling: boolean;
  busy: boolean;
  pending: boolean;
  onPlanChange: (plan: Exclude<BillingPlanId, "ENTERPRISE">) => void;
}) {
  const labelKey = PLAN_LABEL_KEYS[plan.id];
  const planName = t(labelKey);
  const canChange = canManageBilling && plan.action === "SELECT";
  const unavailableReasonText =
    plan.action === "UNAVAILABLE" && plan.unavailableReason
      ? t(UNAVAILABLE_REASON_KEYS[plan.unavailableReason])
      : null;
  const actionLabel =
    plan.action === "SELECT"
      ? plan.id === "FREE"
        ? t("billing.selectFreeCta")
        : t("billing.selectPlanCta")
      : t("billing.unavailableAction");

  const priceLabel =
    plan.monthlyPriceRub === 0
      ? t("pricing.priceFree")
      : plan.monthlyPriceRub === null
        ? t("billing.priceOnRequest")
        : `${formatRubPrice(plan.monthlyPriceRub, locale)} ₽`;

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
      <div className="mt-3 flex items-end gap-1">
        <span className="text-2xl font-semibold tracking-tight">{priceLabel}</span>
        {plan.monthlyPriceRub ? (
          <span className="pb-0.5 text-xs text-muted-foreground">{t("billing.perMonth")}</span>
        ) : null}
      </div>
      <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
        {t(PLAN_DESC_KEYS[plan.id])}
      </p>
      <ul className="mt-3 flex-1 space-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            {t("billing.maxMembers")}: {formatLimitValue(plan.maxMembers, t)}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            {t("billing.maxWorkspaces")}: {formatLimitValue(plan.maxWorkspaces, t)}
          </span>
        </li>
      </ul>
      <div className="mt-4">
        {plan.isCurrent ? (
          <Button variant="outline" size="sm" className="w-full" disabled>
            {t("billing.currentPlan")}
          </Button>
        ) : plan.action === "CONTACT" && canManageBilling ? (
          <Button asChild variant="warning" size="sm" className="w-full">
            <a href="mailto:sales@teamflow.ai?subject=TeamFlow%20Enterprise">
              {t("billing.contactSales")}
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        ) : (
          <Button
            variant={plan.id === "BUSINESS" ? "brand" : "info"}
            size="sm"
            className="w-full"
            disabled={!canChange || busy}
            onClick={() => {
              if (plan.id !== "ENTERPRISE") {
                onPlanChange(plan.id);
              }
            }}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}
            {pending ? t("billing.openingPayment") : actionLabel}
          </Button>
        )}
        <div className="mt-2 min-h-[2.5rem]">
          {unavailableReasonText ? (
            <p className="text-center text-xs leading-snug text-muted-foreground">
              {unavailableReasonText}
            </p>
          ) : null}
        </div>
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
