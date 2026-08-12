import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { requireAuth } from "@/lib/auth/route-guards";
import { useCurrentWorkspace } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app/AppShell";
import { AiEntityResponse } from "@/components/app/AiEntityResponse";
import { PageHeader } from "@/components/app/PageHeader";
import { BrandMark } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChartColumn,
  MessageSquareText,
  Send,
  Target,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import {
  AI_ASK_SUGGESTION_KEYS,
  parseAiAssistantAsk,
  type AiAssistantSearch,
} from "@/lib/ai-assistant-ask";
import {
  fetchWorkspaceAiSummary,
  sendAiCopilotMessage,
  workspaceAiSummaryQueryKey,
  type AiCopilotChatResponse,
  type AiCopilotHistoryMessage,
  type WorkspaceAiSummary,
} from "@/lib/api/ai";
import { fetchProjects, type ProjectApiItem } from "@/lib/api/projects";
import { fetchTasks, type TaskApiItem } from "@/lib/api/tasks";
import { effectiveDueDate } from "@/lib/due-datetime";
import { getProjectAccent } from "@/lib/project-color";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ai")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): AiAssistantSearch => ({
    ask: parseAiAssistantAsk(search.ask),
  }),
  head: () => ({ meta: [{ title: "AI Assistant — TeamFlow AI" }] }),
  component: AssistantPage,
});

function AssistantPage() {
  const { t, lang } = useI18n();
  const { data: currentWorkspace } = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const summaryQueryKey = workspaceId
    ? workspaceAiSummaryQueryKey(workspaceId, lang)
    : (["workspace-ai-summary", null, lang] as const);

  const { data, isLoading } = useQuery({
    // When workspaceId is null the query stays disabled; null in the key never matches a real id.
    queryKey: summaryQueryKey,
    queryFn: () => fetchWorkspaceAiSummary(lang),
    enabled: Boolean(workspaceId),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  return (
    <AppShell>
      <div className="flex min-h-0 flex-col xl:h-[calc(100dvh-8.5rem)] xl:overflow-hidden">
        <PageHeader
          title={t("ai.assistant")}
          subtitle={t("ai.groundedContext")}
          className="mb-2 shrink-0 sm:mb-3"
        />

        <div className="grid min-h-0 min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_20.5rem] xl:items-stretch xl:overflow-hidden xl:gap-4">
          <CopilotChat workspaceId={workspaceId} projects={projects} tasks={tasks} />
          <AiInsightRail
            projects={projects}
            summary={data ?? null}
            isSummaryLoading={isLoading || !workspaceId}
          />
        </div>
      </div>
    </AppShell>
  );
}

const RAIL_ICON_STROKE = 1.75;

function AiInsightRail({
  projects,
  summary,
  isSummaryLoading,
}: {
  projects: ProjectApiItem[];
  summary: WorkspaceAiSummary | null;
  isSummaryLoading: boolean;
}) {
  const { t, lang } = useI18n();
  const statusProjects = pickRailProjects(projects, 3);
  const upcomingDeadlines = pickUpcomingProjectDeadlines(projects, 3);

  return (
    <aside className="grid min-w-0 content-start gap-3 sm:grid-cols-2 xl:flex xl:h-full xl:min-h-0 xl:grid-cols-1 xl:flex-col xl:gap-3 xl:overflow-hidden">
      <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-soft xl:shrink-0">
        <InsightRailTitle icon={Target} title={t("ai.insightFocus")} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <InsightMetric
            value={isSummaryLoading ? 0 : (summary?.metrics.overdueTasks ?? 0)}
            label={t("ai.focusOverdue")}
            to="/app/tasks"
            search={{ due: "overdue" }}
            tone="text-destructive"
          />
          <InsightMetric
            value={isSummaryLoading ? 0 : (summary?.metrics.openTasks ?? 0)}
            label={t("ai.focusOpen")}
            to="/app/tasks"
            search={{ status: "open" }}
            tone="text-info"
          />
          <InsightMetric
            value={isSummaryLoading ? 0 : (summary?.metrics.urgentTasks ?? 0)}
            label={t("ai.focusUrgent")}
            to="/app/tasks"
            search={{ priority: "urgent" }}
            tone="text-amber-500 dark:text-amber-400"
          />
        </div>
      </section>

      <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-soft xl:shrink-0">
        <InsightRailTitle
          icon={CalendarClock}
          title={t("ai.insightDeadlines")}
          action={
            <Link to="/app/projects" className="text-xs font-medium text-primary hover:underline">
              {t("ai.insightAll")}
            </Link>
          }
        />
        <ul className="mt-3 space-y-0.5">
          {upcomingDeadlines.map((project) => (
            <UpcomingProjectDeadlineRow key={project.id} project={project} lang={lang} t={t} />
          ))}
          {upcomingDeadlines.length === 0 ? (
            <li className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">
              {t("ai.insightNoDeadlines")}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-soft sm:col-span-2 xl:col-span-1 xl:min-h-0 xl:flex-1">
        <InsightRailTitle
          icon={ChartColumn}
          title={t("ai.insightProjects")}
          action={
            <Link to="/app/projects" className="text-xs font-medium text-primary hover:underline">
              {t("ai.insightAll")}
            </Link>
          }
        />
        <ul className="mt-3 flex min-h-0 flex-1 flex-col justify-start gap-1">
          {statusProjects.map((project) => (
            <ProjectStatusRow key={project.id} project={project} t={t} />
          ))}
          {statusProjects.length === 0 ? (
            <li className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">
              {t("ai.metricsPending")}
            </li>
          ) : null}
        </ul>
      </section>
    </aside>
  );
}

function InsightRailTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          className="size-4 shrink-0 text-muted-foreground"
          strokeWidth={RAIL_ICON_STROKE}
          aria-hidden
        />
        <h2 className="min-w-0 text-sm font-semibold leading-none">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function InsightMetric({
  value,
  label,
  to,
  search,
  tone,
}: {
  value: number;
  label: string;
  to: "/app/tasks";
  search: { due?: "overdue"; status?: "open"; priority?: "urgent" };
  tone: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-muted/35 px-1 py-2.5 text-center transition hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
    >
      <span className={cn("block text-lg font-semibold tabular-nums leading-none", tone)}>
        {value}
      </span>
      <span className="mt-1.5 block whitespace-normal text-[11px] leading-tight text-muted-foreground">
        {label}
      </span>
    </Link>
  );
}

function UpcomingProjectDeadlineRow({
  project,
  lang,
  t,
}: {
  project: ProjectApiItem;
  lang: Lang;
  t: (key: TKey) => string;
}) {
  const accent = getProjectAccent(project);
  const dueLabel = formatProjectDeadlineLabel(project.dueDate!, lang);
  const dueTone = projectDeadlineTone(project.dueDate!);
  const openLabel =
    project.openTasks === 1
      ? t("ai.insightOpenTasksOne")
      : t("ai.insightOpenTasks").replace("{count}", String(project.openTasks));

  return (
    <li>
      <Link
        to="/app/projects/$projectId"
        params={{ projectId: project.id }}
        className="flex min-w-0 items-start gap-2 rounded-lg px-2 py-2 transition hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
      >
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", accent.dot)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-medium">{project.name}</span>
            <span
              className={cn(
                "shrink-0 text-[11px] font-medium tabular-nums",
                dueTone === "destructive" && "text-destructive",
                dueTone === "warning" && "text-amber-500 dark:text-amber-400",
                dueTone === "muted" && "text-muted-foreground",
              )}
            >
              {dueLabel}
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {openLabel}
          </span>
        </span>
      </Link>
    </li>
  );
}

function ProjectStatusRow({ project, t }: { project: ProjectApiItem; t: (key: TKey) => string }) {
  const accent = getProjectAccent(project);
  const doneTasks = Math.max(0, project.totalTasks - project.openTasks);
  const progress = Math.min(100, Math.max(0, project.progress));

  return (
    <li>
      <Link
        to="/app/projects/$projectId"
        params={{ projectId: project.id }}
        className="block min-w-0 rounded-lg px-2 py-2 transition hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", accent.dot)} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{project.name}</span>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            {progress}%
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/80">
          <div
            className={cn(
              "project-progress-fill h-full rounded-full bg-gradient-to-r",
              accent.progress,
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
          {t("ai.insightTaskRatio")
            .replace("{done}", String(doneTasks))
            .replace("{total}", String(project.totalTasks))}
        </div>
      </Link>
    </li>
  );
}

function pickRailProjects(projects: ProjectApiItem[], limit: number) {
  return [...projects]
    .filter((project) => project.status !== "COMPLETED")
    .sort((a, b) => {
      const activeRank = Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE");
      if (activeRank !== 0) return activeRank;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, limit);
}

function pickUpcomingProjectDeadlines(projects: ProjectApiItem[], limit: number) {
  return projects
    .filter((project) => project.status !== "COMPLETED" && Boolean(project.dueDate))
    .map((project) => ({
      project,
      dueMs: effectiveDueDate(project.dueDate!).getTime(),
    }))
    .filter((entry) => Number.isFinite(entry.dueMs))
    .sort((a, b) => a.dueMs - b.dueMs)
    .slice(0, limit)
    .map((entry) => entry.project);
}

function formatProjectDeadlineLabel(value: string, lang: Lang) {
  const date = effectiveDueDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

function projectDeadlineTone(value: string): "destructive" | "warning" | "muted" {
  const due = effectiveDueDate(value);
  const now = Date.now();
  if (due.getTime() < now) return "destructive";
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  if (due.getTime() - now <= threeDaysMs) return "warning";
  return "muted";
}

const COPILOT_MESSAGE_MAX_CHARS = 2_000;
const COPILOT_HISTORY_MAX_MESSAGES = 8;
const COPILOT_HISTORY_CONTENT_MAX_CHARS = 4_000;
const COPILOT_SUGGESTION_KEYS = [
  "ai.suggestionSummary",
  "ai.suggestionAttention",
  "ai.suggestionDeadlines",
  "ai.suggestionProjects",
] as const;

type CopilotUiMessage = AiCopilotHistoryMessage & {
  id: number;
  response?: AiCopilotChatResponse;
};

function CopilotChat({
  workspaceId,
  projects,
  tasks,
}: {
  workspaceId: string | null;
  projects: ProjectApiItem[];
  tasks: TaskApiItem[];
}) {
  const { t, lang } = useI18n();
  const { ask } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [messages, setMessages] = useState<CopilotUiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextMessageId = useRef(1);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const conversationMountedRef = useRef(false);
  const messagesRef = useRef(messages);
  const isSendingRef = useRef(isSending);
  messagesRef.current = messages;
  isSendingRef.current = isSending;

  useEffect(() => {
    if (!conversationMountedRef.current) {
      conversationMountedRef.current = true;
      return;
    }
    conversationEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, isSending]);

  function createMessage(
    role: CopilotUiMessage["role"],
    content: string,
    response?: AiCopilotChatResponse,
  ): CopilotUiMessage {
    const id = nextMessageId.current;
    nextMessageId.current += 1;
    return { id, role, content, response };
  }

  async function sendMessage(messageOverride?: string) {
    const message = (messageOverride ?? draft).trim();
    if (!workspaceId || !message || isSendingRef.current) return;
    if (message.length > COPILOT_MESSAGE_MAX_CHARS) {
      setError(t("ai.copilotTooLong"));
      return;
    }

    const history = messagesRef.current
      .slice(-COPILOT_HISTORY_MAX_MESSAGES)
      .map(({ role, content }) => ({
        role,
        content: content.slice(0, COPILOT_HISTORY_CONTENT_MAX_CHARS),
      }));
    setMessages((current) => [...current, createMessage("user", message)]);
    setDraft("");
    setError(null);
    isSendingRef.current = true;
    setIsSending(true);

    try {
      const response = await sendAiCopilotMessage({ message, locale: lang, history });
      setMessages((current) => [...current, createMessage("assistant", response.answer, response)]);
    } catch {
      setError(t("ai.copilotError"));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  useEffect(() => {
    if (!ask || !workspaceId) return;

    let cancelled = false;
    const prompt = t(AI_ASK_SUGGESTION_KEYS[ask]).trim();
    void navigate({ search: {}, replace: true });

    queueMicrotask(() => {
      if (cancelled || !prompt) return;
      void sendMessage(prompt);
    });

    return () => {
      cancelled = true;
    };
    // One-shot deep-link from Dashboard quick questions.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional ask handoff
  }, [ask, workspaceId, lang, t, navigate]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendMessage();
  }

  return (
    <section className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft xl:h-full xl:min-h-0">
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
        <BrandMark className="size-9 rounded-xl" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("ai.copilotTitle")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("ai.copilotDescription")}
          </p>
        </div>
      </div>

      <div
        className="app-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
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
                {message.role === "user" ? (
                  <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground [overflow-wrap:anywhere]">
                    {message.content}
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-tl-md border border-border bg-muted/45 px-4 py-3.5 text-foreground">
                    <AiEntityResponse content={message.content} projects={projects} tasks={tasks} />
                  </div>
                )}
                {message.response?.mode === "fallback" ? (
                  <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t("ai.copilotFallbackHint")}
                  </p>
                ) : message.response?.mode === "llm" && message.response.context.truncated ? (
                  <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t("ai.copilotContextPartial")}
                  </p>
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
        <div ref={conversationEndRef} aria-hidden />
      </div>

      <div className="shrink-0 border-t border-border p-3 sm:p-3.5">
        <div className="mb-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {COPILOT_SUGGESTION_KEYS.map((key) => {
            const suggestion = t(key);
            return (
              <button
                key={key}
                type="button"
                disabled={!workspaceId || isSending}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-background px-2.5 py-2 text-center text-xs font-medium leading-snug text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 lg:min-h-0"
                onClick={() => {
                  if (!isSending) void sendMessage(suggestion);
                }}
              >
                <span className="break-words whitespace-normal">{suggestion}</span>
              </button>
            );
          })}
        </div>
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
            className="min-h-14 min-w-0 flex-1 max-h-36 resize-y"
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
