import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, History, FolderKanban, FileText, ArrowUpRight } from "lucide-react";
import { suggestedPrompts, projects } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/ai")({
  head: () => ({ meta: [{ title: "AI Assistant — TeamFlow AI" }] }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string; sources?: { title: string; meta: string }[] };

const seed: Msg[] = [
  {
    role: "user",
    content: "Summarize what shipped this week across Orion Web App",
  },
  {
    role: "assistant",
    content:
      "This week the Orion Web App team shipped 12 tasks across the new dashboard, billing edge cases, and the workspace switcher. Velocity is up 18% week-over-week and there are 3 open reviews ahead of Friday's release.",
    sources: [
      { title: "Sprint 24 board", meta: "8 tasks · Done" },
      { title: "PR: invite member modal", meta: "Marketing Site · Review" },
      { title: "Weekly digest", meta: "Generated yesterday" },
    ],
  },
];

const histories: { title: string; messages: Msg[] }[] = [
  { title: "Weekly digest · Orion", messages: seed },
  {
    title: "Risk report · Mobile v3",
    messages: [
      { role: "user", content: "What risks are blocking Mobile App v3?" },
      {
        role: "assistant",
        content:
          "Mobile App v3 has 3 high-priority tasks without owners and the offline sync milestone is trending 2 days late.",
        sources: [{ title: "Mobile App v3", meta: "3 risks · Active" }],
      },
    ],
  },
  {
    title: "Standup draft · 11:00",
    messages: [
      { role: "user", content: "Draft today's standup update" },
      {
        role: "assistant",
        content:
          "Yesterday the team closed dashboard polish and billing copy. Today the focus is QA on board filters and member invites.",
      },
    ],
  },
  {
    title: "Backlog grooming",
    messages: [
      { role: "user", content: "Find stale backlog items" },
      {
        role: "assistant",
        content:
          "I found 5 backlog tasks older than 30 days. Two look like duplicates and one needs product clarification.",
      },
    ],
  },
  {
    title: "Onboarding outline",
    messages: [
      { role: "user", content: "Outline onboarding for new admins" },
      {
        role: "assistant",
        content:
          "Start with workspace setup, invite flow, project templates, and notification preferences. Add AI assistant examples at the end.",
      },
    ],
  },
];

function AssistantPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");
  const [project, setProject] = useState(projects[0].id);
  const [activeHistory, setActiveHistory] = useState(0);

  function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      {
        role: "assistant",
        content:
          "Here's what I found in your workspace context. I've grouped relevant tasks and flagged 2 risks. Want me to draft a Slack update from this?",
        sources: [
          { title: "Build kanban drag-and-drop", meta: "Orion Web App · In progress" },
          { title: "Integrate AI summary endpoint", meta: "Orion Web App · In progress" },
        ],
      },
    ]);
    setInput("");
  }

  return (
    <AppShell title={t("ai.assistant")}>
      <div className="grid h-[calc(100vh-7rem)] gap-4 lg:grid-cols-[260px_1fr]">
        {/* History sidebar */}
        <aside className="hidden flex-col rounded-2xl border border-border bg-card p-3 shadow-soft lg:flex">
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="size-3.5" /> History
          </div>
          <ul className="flex-1 space-y-0.5 overflow-y-auto">
            {histories.map((history, i) => (
              <li key={history.title}>
                <button
                  onClick={() => {
                    setActiveHistory(i);
                    setMessages(history.messages);
                  }}
                  className={
                    "group flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-secondary " +
                    (activeHistory === i ? "bg-secondary text-foreground" : "text-muted-foreground")
                  }
                >
                  <span className="truncate">{history.title}</span>
                  <ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              setActiveHistory(-1);
              setMessages([]);
            }}
          >
            New chat
          </Button>
        </aside>

        {/* Chat area */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
              <Sparkles className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">TeamFlow AI</div>
              <div className="text-xs text-muted-foreground">Grounded in your workspace context</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <FolderKanban className="size-3.5 text-muted-foreground" />
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
            {messages.map((m, i) => (
              <Message key={i} msg={m} />
            ))}

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.suggestedPrompts")}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs transition hover:border-primary/30 hover:bg-accent/50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ai.askAnything")}
              className="min-h-12 max-h-40 flex-1 resize-none rounded-xl"
            />
            <Button type="submit" className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function Message({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-brand px-4 py-2.5 text-sm text-white shadow-soft">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex max-w-[85%] gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm">
          {msg.content}
        </div>
        {msg.sources && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sources
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {msg.sources.map((s) => (
                <div key={s.title} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                  <div className="grid size-7 place-items-center rounded-lg bg-secondary"><FileText className="size-3.5 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{s.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
