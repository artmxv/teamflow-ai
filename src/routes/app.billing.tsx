import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { PageHeader } from "@/components/app/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n, type TKey } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { AUTH_ME_QUERY_KEY } from "@/lib/auth/auth-cache";
import type { AuthMeData } from "@/lib/api/auth";
import {
  fetchBillingSummary,
  updateBillingPlan,
  type BillingPlanId,
  type BillingSummary,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import { Check, CreditCard, Download, Info, Lock, Mail, Sparkles, UserPlus } from "lucide-react";

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

const PLAN_FEATURE_KEYS: Record<BillingPlanId, TKey[]> = {
  FREE: [
    "billing.feature.free.workspace",
    "billing.feature.free.members",
    "billing.feature.free.workspaces",
  ],
  TEAM: ["billing.feature.team.members", "billing.feature.team.workspaces"],
  BUSINESS: [
    "billing.feature.business.members",
    "billing.feature.business.workspaces",
    "billing.feature.business.priority",
  ],
  ENTERPRISE: [
    "billing.feature.enterprise.members",
    "billing.feature.enterprise.workspaces",
    "billing.feature.enterprise.custom",
  ],
};

const SAMPLE_INVOICES = [
  { id: "INV-2026-001", date: "Mar 1, 2026", amount: "$49.00", status: "paid" as const },
  { id: "INV-2026-002", date: "Apr 1, 2026", amount: "$49.00", status: "upcoming" as const },
];

const PREVIEW_BILLING_EMAIL = "billing@workspace.example";

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
  return Math.min(100, Math.round((used / max) * 100));
}

function billingErrorMessage(error: unknown, t: (k: TKey) => string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return t("billing.viewOnly");
    }
    if (error.code === "MEMBER_LIMIT_REACHED") {
      return t("billing.memberLimitReached");
    }
  }
  return error instanceof Error ? error.message : t("board.errorTitle");
}

function BillingPage() {
  const { t } = useI18n();
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const [seatsOpen, setSeatsOpen] = useState(false);
  const isOwner = me?.workspace?.role === "OWNER";
  const billingEmail = me?.user?.email?.trim() || PREVIEW_BILLING_EMAIL;

  const summaryQuery = useQuery({
    queryKey: BILLING_QUERY_KEY,
    queryFn: fetchBillingSummary,
  });

  const switchPlanMutation = useMutation({
    mutationFn: (plan: BillingPlanId) => updateBillingPlan(plan),
    onSuccess: (data) => {
      queryClient.setQueryData(BILLING_QUERY_KEY, data);
      queryClient.setQueryData<AuthMeData | undefined>(AUTH_ME_QUERY_KEY, (prev) => {
        if (!prev?.workspace) {
          return prev;
        }
        return {
          ...prev,
          workspace: { ...prev.workspace, plan: data.currentPlan },
        };
      });
      void queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      toast.success(t("billing.planSwitched"));
    },
    onError: (error) => {
      toast.error(billingErrorMessage(error, t));
    },
  });

  const summary = summaryQuery.data;
  const showPaymentsLater = () => toast.info(t("billing.paymentsLaterToast"));
  const showInvoiceDownloadLater = () => toast.info(t("billing.invoiceDownloadLater"));

  return (
    <AppShell>
      <PageHeader
        title={t("side.billing")}
        subtitle={t("billing.previewSubtitle")}
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5 shrink-0" />
            {t("billing.previewBilling")}
          </div>
        }
      />

      <Alert className="mb-6 border-border/80 bg-card shadow-soft ring-1 ring-primary/15">
        <Info className="size-4 text-primary" />
        <AlertTitle className="text-foreground">{t("billing.previewNote")}</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {t("billing.paymentsLaterNote")}
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
        <BillingContent
          summary={summary}
          billingEmail={billingEmail}
          isOwner={isOwner}
          seatsOpen={seatsOpen}
          onSeatsOpenChange={setSeatsOpen}
          onSelectPlan={(plan) => switchPlanMutation.mutate(plan)}
          isSwitching={switchPlanMutation.isPending}
          onPaymentsLater={showPaymentsLater}
          onInvoiceDownload={showInvoiceDownloadLater}
          t={t}
        />
      )}
    </AppShell>
  );
}

function BillingContent({
  summary,
  billingEmail,
  isOwner,
  seatsOpen,
  onSeatsOpenChange,
  onSelectPlan,
  isSwitching,
  onPaymentsLater,
  onInvoiceDownload,
  t,
}: {
  summary: BillingSummary;
  billingEmail: string;
  isOwner: boolean;
  seatsOpen: boolean;
  onSeatsOpenChange: (open: boolean) => void;
  onSelectPlan: (plan: BillingPlanId) => void;
  isSwitching: boolean;
  onPaymentsLater: () => void;
  onInvoiceDownload: () => void;
  t: (k: TKey) => string;
}) {
  const currentPlanKey = PLAN_LABEL_KEYS[summary.currentPlan];
  const featureKeys = PLAN_FEATURE_KEYS[summary.currentPlan];
  const isMaxPlan = summary.currentPlan === "ENTERPRISE";
  const membersPercent = usagePercent(summary.usage.members, summary.limits.maxMembers);
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("billing.overview")}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">{t(currentPlanKey)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("billing.planLimits")}</p>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-card text-primary">
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
                label={t("billing.workspacesUsed")}
                value={`${summary.usage.workspaces} / ${formatLimitValue(summary.limits.maxWorkspaces, t)}`}
              />
              <Stat
                label={t("billing.maxMembers")}
                value={formatLimitValue(summary.limits.maxMembers, t)}
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
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{t("billing.pendingInvitations")}</span>
                  <span className="font-medium tabular-nums">
                    {summary.usage.pendingInvitations}
                  </span>
                </div>
              </div>
              <UsageRow
                label={t("billing.workspacesUsed")}
                used={summary.usage.workspaces}
                max={summary.limits.maxWorkspaces}
                percent={workspacesPercent}
                unlimitedLabel={t("billing.unlimited")}
              />
            </div>
            <Button
              variant="brand"
              className="mt-6 w-full"
              disabled={isMaxPlan}
              onClick={() => onSeatsOpenChange(true)}
            >
              <UserPlus className="size-4" />
              {t("billing.addSeats")}
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="billing-plans-heading">
        <div className="mb-4">
          <h3 id="billing-plans-heading" className="text-base font-semibold">
            {t("billing.planDetails")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("billing.paymentsLaterNote")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summary.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isOwner={isOwner}
              isSwitching={isSwitching}
              onSelect={() => onSelectPlan(plan.id)}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="size-4 text-primary" />
              {t("billing.cardPreview")}
            </div>
            <Badge variant="secondary" className="font-normal">
              {t("billing.previewData")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("billing.paymentPlaceholder")}</p>
          <div className="mt-4 rounded-xl border border-border bg-gradient-to-br from-muted/50 via-card to-card p-5 shadow-inner dark:from-muted/25 dark:via-card dark:to-card/90">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Visa
                </div>
                <div className="mt-2 font-mono text-lg tracking-wide text-foreground">
                  Visa •••• 4242
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Exp 09/28</div>
              </div>
              <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4 text-sm">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{t("billing.billingEmail")}</div>
                <div className="truncate font-medium">{billingEmail}</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onPaymentsLater}>
              {t("billing.updateCard")}
            </Button>
            <Button variant="brand" size="sm" onClick={onPaymentsLater}>
              {t("billing.addCard")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="text-base font-semibold">{t("billing.includedFeatures")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(currentPlanKey)} · {t("billing.planLimits")}
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {featureKeys.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{t("billing.sampleBillingHistory")}</h3>
            <p className="text-xs text-muted-foreground">{t("billing.previewData")}</p>
          </div>
          <Badge variant="secondary" className="font-normal">
            {t("billing.previewData")}
          </Badge>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-muted/20 dark:bg-muted/10">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("billing.invoice")}</TableHead>
                <TableHead>{t("billing.invoiceDate")}</TableHead>
                <TableHead>{t("billing.invoiceAmount")}</TableHead>
                <TableHead>{t("billing.invoiceStatus")}</TableHead>
                <TableHead className="text-right">{t("billing.download")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_INVOICES.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm font-medium">{invoice.id}</TableCell>
                  <TableCell className="text-muted-foreground">{invoice.date}</TableCell>
                  <TableCell className="font-medium tabular-nums">{invoice.amount}</TableCell>
                  <TableCell>
                    <Badge
                      variant={invoice.status === "paid" ? "default" : "secondary"}
                      className={
                        invoice.status === "paid"
                          ? "border-0 bg-emerald-500/15 font-normal text-emerald-700 dark:text-emerald-400"
                          : "font-normal"
                      }
                    >
                      {invoice.status === "paid" ? t("billing.paid") : t("billing.upcoming")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={onInvoiceDownload}
                      aria-label={t("billing.downloadInvoice").replace("{id}", invoice.id)}
                    >
                      <Download className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <SeatsDialog open={seatsOpen} onOpenChange={onSeatsOpenChange} isMaxPlan={isMaxPlan} t={t} />
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
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
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
  isOwner,
  isSwitching,
  onSelect,
  t,
}: {
  plan: BillingSummary["plans"][number];
  isOwner: boolean;
  isSwitching: boolean;
  onSelect: () => void;
  t: (k: TKey) => string;
}) {
  const labelKey = PLAN_LABEL_KEYS[plan.id];
  const planName = t(labelKey);
  const isRecommended = plan.id === "BUSINESS" && !plan.isCurrent;
  const switchLabel = t("billing.switchToPlan").replace("{plan}", planName);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition ${
        plan.isCurrent
          ? "border-primary ring-1 ring-primary/25"
          : isRecommended
            ? "border-border ring-1 ring-primary/15"
            : "border-border"
      }`}
    >
      {plan.isCurrent ? (
        <Badge className="absolute right-3 top-3 border-0 bg-primary/15 font-normal text-primary">
          {t("billing.currentPlan")}
        </Badge>
      ) : isRecommended ? (
        <Badge className="absolute right-3 top-3 border-0 bg-primary/15 font-normal text-primary">
          {t("billing.recommended")}
        </Badge>
      ) : null}
      <div className="text-lg font-semibold pr-20">{planName}</div>
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
        ) : isOwner ? (
          <Button
            variant="brand"
            size="sm"
            className="w-full"
            disabled={isSwitching}
            onClick={onSelect}
          >
            {switchLabel}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="w-full" disabled>
              {switchLabel}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {t("billing.ownerOnly")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SeatsDialog({
  open,
  onOpenChange,
  isMaxPlan,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMaxPlan: boolean;
  t: (k: TKey) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("billing.addSeats")}</DialogTitle>
          <DialogDescription>
            {isMaxPlan ? t("billing.unlimited") : t("billing.seatsControlledByPlan")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        className={`mt-1 text-lg font-semibold tabular-nums ${muted ? "text-muted-foreground" : ""}`}
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
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
