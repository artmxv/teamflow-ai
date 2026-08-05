import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/auth/route-guards";
import { useCurrentWorkspace } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Megaphone,
  Copy,
  FolderKanban,
} from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { friendlyApiErrorMessage, isBrowserOffline } from "@/lib/api-error";
import {
  fetchWorkspaceAiSummary,
  workspaceAiSummaryQueryKey,
  type WorkspaceAiMetrics,
} from "@/lib/api/ai";

export const Route = createFileRoute("/app/ai")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "AI Assistant — TeamFlow AI" }] }),
  component: AssistantPage,
});

const SECTIONS = [
  { id: "overview", labelKey: "ai.sectionOverview" as const },
  { id: "highlights", labelKey: "ai.highlights" as const },
  { id: "risks", labelKey: "ai.risks" as const },
  { id: "actions", labelKey: "ai.actions" as const },
  { id: "standup", labelKey: "ai.standupSummary" as const },
  { id: "metrics", labelKey: "ai.sectionMetrics" as const },
] as const;

function AssistantPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: currentWorkspace } = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const summaryQueryKey = workspaceId
    ? workspaceAiSummaryQueryKey(workspaceId, lang)
    : (["workspace-ai-summary", null, lang] as const);

  const { data, error, isError, isLoading, isFetching, refetch } = useQuery({
    // When workspaceId is null the query stays disabled; null in the key never matches a real id.
    queryKey: summaryQueryKey,
    queryFn: () => fetchWorkspaceAiSummary(lang),
    enabled: Boolean(workspaceId),
  });

  const isEmptyWorkspace =
    !!data && data.metrics.totalProjects === 0 && data.metrics.totalTasks === 0;
  const showSectionContent = !!data && !isEmptyWorkspace;
  const navEnabled = !!data;

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleRegenerate() {
    if (!workspaceId) {
      return;
    }
    // DevTools Offline / real offline: do not treat paused or cached refetch as success.
    if (isBrowserOffline()) {
      toast.error(t("common.offline"));
      return;
    }

    const dataUpdatedAtBefore = queryClient.getQueryState(summaryQueryKey)?.dataUpdatedAt ?? 0;

    try {
      const result = await refetch();
      if (isBrowserOffline() || result.isPaused) {
        toast.error(t("common.offline"));
        return;
      }
      if (result.error) {
        throw result.error;
      }
      const dataUpdatedAtAfter = queryClient.getQueryState(summaryQueryKey)?.dataUpdatedAt ?? 0;
      // Cached/paused resolve without a real network success must not show success toast.
      if (dataUpdatedAtAfter <= dataUpdatedAtBefore) {
        toast.error(t("common.offline"));
        return;
      }
      toast.success(t("ai.summaryRefreshed"));
    } catch (regenerateError) {
      toast.error(friendlyApiErrorMessage(regenerateError, t, "ai.refreshError"));
    }
  }

  return (
    <AppShell>
      <PageHeader title={t("ai.assistant")} subtitle={t("ai.groundedContext")} className="mb-4" />

      <nav
        className="mb-3 -mx-1 overflow-x-auto px-1 lg:hidden"
        aria-label={t("ai.sectionsNavLabel")}
      >
        <ul className="flex w-max max-w-none gap-1.5 pb-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => scrollToSection(section.id)}
                disabled={!navEnabled || (section.id !== "metrics" && isEmptyWorkspace)}
                className="whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                {t(section.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="hidden flex-col rounded-2xl border border-border bg-card p-3 shadow-soft lg:flex">
          <div className="border-b border-border/60 pb-3">
            <div className="mb-2 flex items-center gap-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
              <BarChart3 className="size-3" /> {t("ai.metricsTitle")}
            </div>
            {isLoading || !workspaceId ? (
              <MetricsSkeleton />
            ) : data ? (
              <MetricsPanel metrics={data.metrics} />
            ) : (
              <p className="px-2 py-2 text-xs text-muted-foreground">{t("ai.metricsPending")}</p>
            )}
          </div>
          <div className="mt-4 flex flex-col border-b border-border/60 pb-3">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
              {t("ai.sectionsTitle")}
            </div>
            <ul className="space-y-0.5">
              {SECTIONS.filter((section) => section.id !== "metrics").map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    disabled={!showSectionContent}
                    className="flex w-full rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  >
                    {t(section.labelKey)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-9 w-full justify-center gap-1.5 border-border bg-control text-control-foreground hover:bg-control-hover"
            disabled={!workspaceId || isLoading || isFetching}
            onClick={() => void handleRegenerate()}
          >
            <RefreshCw className={"size-3.5 " + (isFetching ? "animate-spin" : "")} />
            {isFetching ? t("ai.regenerating") : t("ai.regenerate")}
          </Button>
        </aside>

        <section className="flex flex-col rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
              <Sparkles className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t("ai.assistant")}</div>
              <div className="text-xs text-muted-foreground">{t("ai.groundedContext")}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-9 shrink-0 justify-center gap-1.5 border-border bg-control text-control-foreground hover:bg-control-hover"
              disabled={!workspaceId || isLoading || isFetching}
              onClick={() => void handleRegenerate()}
            >
              <RefreshCw className={"size-3.5 " + (isFetching ? "animate-spin" : "")} />
              {isFetching ? t("ai.regenerating") : t("ai.regenerate")}
            </Button>
          </div>

          <div className="space-y-6 px-5 py-6">
            {!workspaceId || isLoading ? (
              <SummarySkeleton />
            ) : isError ? (
              <ApiErrorState
                title={t("ai.errorTitle")}
                error={error}
                hintKey="board.errorHint"
                onRetry={() => void refetch()}
                isRetrying={isFetching}
              />
            ) : data ? (
              isEmptyWorkspace ? (
                <>
                  <EmptyState
                    icon={Sparkles}
                    title={t("ai.emptyWorkspaceTitle")}
                    description={t("ai.emptyWorkspaceHint")}
                    primaryAction={
                      <Button variant="brand" asChild>
                        <Link to="/app/projects">
                          <FolderKanban className="size-4" />
                          {t("ai.goToProjects")}
                        </Link>
                      </Button>
                    }
                  />
                  <div id="metrics" className="scroll-mt-20 lg:hidden">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("ai.metricsTitle")}
                    </div>
                    <MetricsPanel metrics={data.metrics} />
                  </div>
                </>
              ) : (
                <>
                  <div id="overview" className="scroll-mt-20">
                    <AssistantBubble content={data.overview} />
                  </div>

                  <div id="highlights" className="scroll-mt-20">
                    <SectionBlock
                      icon={CheckCircle2}
                      title={t("ai.highlights")}
                      tone="ok"
                      items={data.highlights}
                    />
                  </div>

                  <div id="risks" className="scroll-mt-20">
                    <SectionBlock
                      icon={AlertTriangle}
                      title={t("ai.risks")}
                      tone="warn"
                      items={data.risks}
                    />
                  </div>

                  <div id="actions" className="scroll-mt-20">
                    <SectionBlock
                      icon={ListChecks}
                      title={t("ai.nextActions")}
                      tone="info"
                      items={data.recommendedNextActions}
                      ordered
                    />
                  </div>

                  <div id="standup" className="scroll-mt-20">
                    <StandupSummaryBlock
                      summary={data.standupSummary}
                      onCopy={() => copyStandupSummary(data.standupSummary, t)}
                    />
                  </div>

                  <div id="metrics" className="scroll-mt-20 lg:hidden">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("ai.metricsTitle")}
                    </div>
                    <MetricsPanel metrics={data.metrics} />
                  </div>
                </>
              )
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

async function copyStandupSummary(text: string, t: (key: TKey) => string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("ai.copied"));
    return true;
  } catch {
    toast.error(t("ai.copyError"));
    return false;
  }
}

function StandupSummaryBlock({
  summary,
  onCopy,
}: {
  summary: string;
  onCopy: () => Promise<boolean> | boolean | void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const result = await onCopy();
    if (result === false) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Megaphone className="size-3.5" /> {t("ai.standupSummary")}
        {summary.trim() ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5 border-border bg-control text-xs font-medium normal-case tracking-normal text-control-foreground hover:bg-control-hover"
            onClick={() => void handleCopy()}
          >
            <Copy className="size-3.5" />
            {copied ? t("ai.copiedShort") : t("ai.copy")}
          </Button>
        ) : null}
      </div>
      <AssistantBubble content={summary} emptyMessage={t("ai.standupEmpty")} />
    </>
  );
}

function AssistantBubble({ content, emptyMessage }: { content: string; emptyMessage?: string }) {
  const isEmpty = !content.trim();

  return (
    <div className="flex max-w-[95%] gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm">
        {isEmpty && emptyMessage ? (
          <p className="text-muted-foreground">{emptyMessage}</p>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

function SectionBlock({
  icon: Icon,
  title,
  tone,
  items,
  ordered = false,
}: {
  icon: typeof CheckCircle2;
  title: string;
  tone: "warn" | "ok" | "info";
  items: string[];
  ordered?: boolean;
}) {
  const toneClass = {
    warn: "bg-warning/15 text-warning-foreground",
    ok: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  }[tone];

  const ListTag = ordered ? "ol" : "ul";
  const listClass = ordered ? "list-decimal pl-4" : "list-disc pl-4";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={
            "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold " +
            toneClass
          }
        >
          <Icon className="size-3" />
          {title}
        </span>
      </div>
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        <ListTag className={"space-y-2 " + listClass}>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ListTag>
      </div>
    </div>
  );
}

function MetricsPanel({ metrics }: { metrics: WorkspaceAiMetrics }) {
  const { t } = useI18n();
  const items = [
    { label: t("ai.metricProjects"), value: metrics.totalProjects },
    { label: t("ai.metricActiveProjects"), value: metrics.activeProjects },
    { label: t("ai.metricTasks"), value: metrics.totalTasks },
    { label: t("ai.metricOpenTasks"), value: metrics.openTasks },
    { label: t("ai.metricDoneTasks"), value: metrics.completedTasks },
    { label: t("ai.metricUrgentOpen"), value: metrics.urgentTasks },
    { label: t("ai.metricHighPriority"), value: metrics.highPriorityTasks },
    { label: t("ai.metricInReview"), value: metrics.reviewTasks },
    { label: t("ai.metricOverdue"), value: metrics.overdueTasks },
  ];

  return (
    <ul className="space-y-1 px-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-secondary"
        >
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-semibold tabular-nums">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Skeleton className="size-8 rounded-xl" />
        <Skeleton className="h-24 flex-1 rounded-2xl" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <ul className="space-y-2 px-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="flex justify-between px-2 py-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-6" />
        </li>
      ))}
    </ul>
  );
}
