import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/auth/route-guards";
import { useCurrentWorkspace } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { BrandMark } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  BarChart3,
  ShieldAlert,
  ListChecks,
  ClipboardList,
  Compass,
  Copy,
  FolderKanban,
  Lightbulb,
  MessageSquareText,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { friendlyApiErrorMessage, isBrowserOffline } from "@/lib/api-error";
import {
  fetchWorkspaceAiSummary,
  sendAiCopilotMessage,
  workspaceAiSummaryQueryKey,
  type AiCopilotChatResponse,
  type AiCopilotHistoryMessage,
  type WorkspaceAiMetrics,
} from "@/lib/api/ai";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ai")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "AI Assistant — TeamFlow AI" }] }),
  component: AssistantPage,
});

const SECTIONS = [
  { id: "overview", labelKey: "ai.sectionOverview" as const, icon: Compass },
  { id: "highlights", labelKey: "ai.highlights" as const, icon: Lightbulb },
  { id: "risks", labelKey: "ai.risks" as const, icon: ShieldAlert },
  { id: "actions", labelKey: "ai.actions" as const, icon: ListChecks },
  { id: "standup", labelKey: "ai.standupSummary" as const, icon: ClipboardList },
  { id: "metrics", labelKey: "ai.sectionMetrics" as const, icon: BarChart3 },
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

      <CopilotChat key={workspaceId ?? "no-workspace"} workspaceId={workspaceId} />

      <nav
        className="mb-3 mt-4 -mx-1 overflow-x-auto px-1 lg:hidden"
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
          <div className="mt-4 flex flex-col">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
              {t("ai.sectionsTitle")}
            </div>
            <ul className="space-y-0.5">
              {SECTIONS.filter((section) => section.id !== "metrics").map((section) => {
                const Icon = section.icon;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      disabled={!showSectionContent}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted/80 text-muted-foreground">
                        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 truncate">{t(section.labelKey)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="flex flex-col rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <BrandMark className="size-9 rounded-xl" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t("ai.assistant")}</div>
              <div className="text-xs text-muted-foreground">{t("ai.groundedContext")}</div>
            </div>
            <Button
              variant="brand"
              size="sm"
              className="ml-auto h-9 shrink-0 justify-center gap-1.5"
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
                    icon={Compass}
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
                    <SectionMarker icon={BarChart3} title={t("ai.metricsTitle")} />
                    <MetricsPanel metrics={data.metrics} />
                  </div>
                </>
              ) : (
                <>
                  <div id="overview" className="scroll-mt-20">
                    <SectionMarker icon={Compass} title={t("ai.sectionOverview")} />
                    <AssistantBubble content={data.overview} />
                  </div>

                  <div id="highlights" className="scroll-mt-20">
                    <SectionBlock
                      icon={Lightbulb}
                      title={t("ai.highlights")}
                      tone="ok"
                      items={data.highlights}
                    />
                  </div>

                  <div id="risks" className="scroll-mt-20">
                    <SectionBlock
                      icon={ShieldAlert}
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
                    <SectionMarker icon={BarChart3} title={t("ai.metricsTitle")} />
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

const COPILOT_MESSAGE_MAX_CHARS = 2_000;
const COPILOT_HISTORY_MAX_MESSAGES = 8;
const COPILOT_HISTORY_CONTENT_MAX_CHARS = 4_000;

type CopilotUiMessage = AiCopilotHistoryMessage & {
  id: number;
  response?: AiCopilotChatResponse;
};

function CopilotChat({ workspaceId }: { workspaceId: string | null }) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<CopilotUiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextMessageId = useRef(1);

  function createMessage(
    role: CopilotUiMessage["role"],
    content: string,
    response?: AiCopilotChatResponse,
  ): CopilotUiMessage {
    const id = nextMessageId.current;
    nextMessageId.current += 1;
    return { id, role, content, response };
  }

  async function sendMessage() {
    const message = draft.trim();
    if (!workspaceId || !message || isSending) return;
    if (message.length > COPILOT_MESSAGE_MAX_CHARS) {
      setError(t("ai.copilotTooLong"));
      return;
    }

    const history = messages.slice(-COPILOT_HISTORY_MAX_MESSAGES).map(({ role, content }) => ({
      role,
      content: content.slice(0, COPILOT_HISTORY_CONTENT_MAX_CHARS),
    }));
    setMessages((current) => [...current, createMessage("user", message)]);
    setDraft("");
    setError(null);
    setIsSending(true);

    try {
      const response = await sendAiCopilotMessage({ message, locale: lang, history });
      setMessages((current) => [...current, createMessage("assistant", response.answer, response)]);
    } catch {
      setError(t("ai.copilotError"));
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendMessage();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{t("ai.copilotTitle")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("ai.copilotDescription")}
          </p>
        </div>
      </div>

      <div
        className="max-h-[420px] min-h-40 space-y-4 overflow-y-auto px-5 py-5"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <MessageSquareText className="size-5" aria-hidden />
            <p>{t("ai.copilotEmpty")}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div className="max-w-[88%] space-y-1.5">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {message.role === "user" ? t("ai.copilotYou") : t("ai.copilotName")}
                </div>
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    message.role === "user"
                      ? "rounded-tr-md bg-primary text-primary-foreground"
                      : "rounded-tl-md border border-border bg-muted/50 text-foreground",
                  )}
                >
                  {message.content}
                </div>
                {message.response?.mode === "fallback" ? (
                  <div className="px-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t("ai.copilotFallback")}</span>
                    {" · "}
                    {t("ai.copilotFallbackHint")}
                  </div>
                ) : message.response?.mode === "llm" && message.response.context.truncated ? (
                  <div className="px-1 text-xs text-muted-foreground">
                    {t("ai.copilotContextPartial")}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        {isSending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              {t("ai.copilotSending")}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("ai.copilotPlaceholder")}
            aria-label={t("ai.copilotPlaceholder")}
            maxLength={COPILOT_MESSAGE_MAX_CHARS}
            rows={2}
            disabled={!workspaceId || isSending}
            className="max-h-40 min-h-20 resize-y"
          />
          <Button
            type="button"
            variant="brand"
            className="h-10 shrink-0 gap-2"
            disabled={!workspaceId || !draft.trim() || isSending}
            onClick={() => void sendMessage()}
          >
            <Send className="size-4" aria-hidden />
            {t("ai.copilotSend")}
          </Button>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
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
      <SectionMarker
        icon={ClipboardList}
        title={t("ai.standupSummary")}
        trailing={
          summary.trim() ? (
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="ml-auto h-8 gap-1.5 text-xs font-medium normal-case tracking-normal"
              onClick={() => void handleCopy()}
            >
              <Copy className="size-3.5" />
              {copied ? t("ai.copiedShort") : t("ai.copy")}
            </Button>
          ) : null
        }
      />
      <AssistantBubble content={summary} emptyMessage={t("ai.standupEmpty")} />
    </>
  );
}

function SectionMarker({
  icon: Icon,
  title,
  toneClass,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  toneClass?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex min-h-7 items-center gap-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg bg-muted/80",
          toneClass ?? "text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      <span className="leading-none">{title}</span>
      {trailing}
    </div>
  );
}

function AssistantBubble({ content, emptyMessage }: { content: string; emptyMessage?: string }) {
  const isEmpty = !content.trim();

  return (
    <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm">
      {isEmpty && emptyMessage ? <p className="text-muted-foreground">{emptyMessage}</p> : content}
    </div>
  );
}

function SectionBlock({
  icon,
  title,
  tone,
  items,
  ordered = false,
}: {
  icon: LucideIcon;
  title: string;
  tone: "warn" | "ok" | "info";
  items: string[];
  ordered?: boolean;
}) {
  const toneClass = {
    warn: "text-warning-foreground",
    ok: "text-success",
    info: "text-info",
  }[tone];

  const ListTag = ordered ? "ol" : "ul";
  const listClass = ordered ? "list-decimal pl-4" : "list-disc pl-4";

  return (
    <div>
      <SectionMarker icon={icon} title={title} toneClass={toneClass} />
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
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-full max-w-[95%] rounded-2xl" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
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
