import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Check, CreditCard, Download, Info, Lock, Sparkles, UserPlus } from "lucide-react";

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

function formatLimitValue(value: number | null, t: (k: TKey) => string): string {
  if (value === null) {
    return t("billing.unlimited");
  }
  return String(value);
}

function formatUsageRatio(used: number, max: number | null): string {
  if (max === null) {
    return `${used} / ∞`;
  }
  return `${used} / ${max}`;
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            {t("billing.previewBilling")}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("side.billing")}</h1>
          <p className="text-sm text-muted-foreground">{t("billing.previewSubtitle")}</p>
        </div>
      </div>

      <Alert className="mb-6 border-primary/25 bg-primary/5">
        <Info className="size-4 text-primary" />
        <AlertTitle>{t("billing.previewNote")}</AlertTitle>
        <AlertDescription>{t("billing.paymentsLaterNote")}</AlertDescription>
      </Alert>

      {summaryQuery.isLoading ? (
        <BillingSkeleton />
      ) : summaryQuery.isError || !summary ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("board.errorTitle")}
        </div>
      ) : (
        <BillingContent
          summary={summary}
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

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                {t("billing.currentPlan")}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{t(currentPlanKey)}</h2>
              <p className="text-sm text-muted-foreground">{t("billing.planLimits")}</p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              {t("billing.previewBilling")}
            </Badge>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={t("billing.membersUsed")}
              value={formatUsageRatio(summary.usage.members, summary.limits.maxMembers)}
            />
            <Stat
              label={t("billing.pendingInvitations")}
              value={String(summary.usage.pendingInvitations)}
            />
            <Stat
              label={t("billing.workspacesUsed")}
              value={formatUsageRatio(summary.usage.workspaces, summary.limits.maxWorkspaces)}
            />
            <Stat
              label={t("billing.maxMembers")}
              value={formatLimitValue(summary.limits.maxMembers, t)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="text-base font-semibold">{t("billing.usage")}</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("billing.maxMembers")}</span>
              <span className="font-medium">{formatLimitValue(summary.limits.maxMembers, t)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("billing.maxWorkspaces")}</span>
              <span className="font-medium">
                {formatLimitValue(summary.limits.maxWorkspaces, t)}
              </span>
            </li>
          </ul>
          <Button
            variant="brand"
            className="mt-5 w-full"
            disabled={isMaxPlan}
            onClick={() => onSeatsOpenChange(true)}
          >
            <UserPlus className="size-4" />
            {t("billing.addSeats")}
          </Button>
        </div>
      </div>

      <section className="mt-8">
        <h3 className="mb-4 text-base font-semibold">{t("billing.changePlan")}</h3>
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

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-base font-semibold">
            <CreditCard className="size-4 text-primary" />
            {t("billing.paymentMethod")}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("billing.paymentsLaterNote")}</p>
          <div className="mt-4 rounded-xl border border-dashed border-border bg-gradient-to-br from-muted/40 to-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Visa
                </div>
                <div className="mt-2 font-mono text-lg tracking-widest">•••• •••• •••• 4242</div>
                <div className="mt-1 text-xs text-muted-foreground">Exp 09/28</div>
              </div>
              <Lock className="size-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("billing.paymentPlaceholder")}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onPaymentsLater}>
              {t("billing.updateCard")}
            </Button>
            <Button variant="secondary" size="sm" onClick={onPaymentsLater}>
              {t("billing.addCard")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="text-base font-semibold">{t("billing.whatsIncluded")}</h3>
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

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{t("billing.billingHistory")}</h3>
            <p className="text-xs text-muted-foreground">{t("billing.sampleBillingHistory")}</p>
          </div>
          <Badge variant="secondary">{t("common.sampleData")}</Badge>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("billing.invoice")}</TableHead>
                <TableHead>{t("billing.invoiceDate")}</TableHead>
                <TableHead>{t("billing.invoiceAmount")}</TableHead>
                <TableHead>{t("billing.invoiceStatus")}</TableHead>
                <TableHead className="text-right">{t("billing.downloadInvoice")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_INVOICES.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell>{invoice.amount}</TableCell>
                  <TableCell>
                    <Badge
                      variant={invoice.status === "paid" ? "default" : "secondary"}
                      className={
                        invoice.status === "paid"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : ""
                      }
                    >
                      {invoice.status === "paid" ? t("billing.paid") : t("billing.upcoming")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onInvoiceDownload}
                      aria-label={t("billing.downloadInvoice")}
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

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 shadow-soft transition ${
        plan.isCurrent ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      {plan.isCurrent ? (
        <Badge className="absolute right-3 top-3 border-0 bg-primary/15 text-primary">
          {t("billing.currentPlan")}
        </Badge>
      ) : null}
      <div className="text-lg font-semibold">{t(labelKey)}</div>
      <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
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
            variant={plan.id === "BUSINESS" || plan.id === "ENTERPRISE" ? "brand" : "outline"}
            size="sm"
            className="w-full"
            disabled={isSwitching}
            onClick={onSelect}
          >
            {t("billing.switchToPlan")}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="w-full" disabled>
              {t("billing.switchToPlan")}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {t("billing.viewOnly")}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
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
