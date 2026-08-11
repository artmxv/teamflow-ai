import { Fragment, useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import type { DashboardTaskPriority, DashboardTaskStatus } from "@/lib/api/dashboard";
import type { ProjectApiItem } from "@/lib/api/projects";
import type { TaskApiItem } from "@/lib/api/tasks";
import { dashboardPriorityLabel, dashboardStatusLabel, useI18n } from "@/lib/i18n";
import { getProjectAccent } from "@/lib/project-color";
import { cn } from "@/lib/utils";

type AiEntityResponseProps = {
  content: string;
  projects: ProjectApiItem[];
  tasks: TaskApiItem[];
  /** Tighter typography for dashboard AI preview cards. */
  compact?: boolean;
  className?: string;
};

type ParsedLine =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "number"; text: string; marker: string }
  | { kind: "space" };

type EntityIndex = {
  taskByKey: Map<string, TaskApiItem>;
  projectByName: Map<string, ProjectApiItem>;
  taskMatcher: RegExp | null;
  projectMatcher: RegExp | null;
};

type TextMatch = {
  index: number;
  value: string;
  kind: "task" | "project" | "meta";
  task?: TaskApiItem;
  project?: ProjectApiItem;
  label?: string;
};

const ENTITY_BOUNDARY = /[\p{L}\p{N}_]/u;
const STATUS_ENUMS = ["BACKLOG", "IN_PROGRESS", "REVIEW", "DONE"] as const;
const PRIORITY_ENUMS = ["LOW", "MEDIUM", "URGENT"] as const;
/** Match only UPPERCASE API enums so plain English words like "done" are not rewritten. */
const META_ENUM_PATTERN = new RegExp(
  `\\b(?:${[...STATUS_ENUMS, ...PRIORITY_ENUMS].join("|")})\\b`,
  "g",
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize fancy dashes so TF‑141 (unicode hyphen) still matches TF-141. */
function normalizeEntitySource(value: string) {
  return value.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-");
}

function normalizeLine(rawLine: string): ParsedLine | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return { kind: "space" };
  if (/^```/.test(trimmed) || /^\|?\s*:?-{3,}/.test(trimmed)) return null;

  const withoutDecoration = trimmed
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^>\s?/, "")
    .replace(/^\|\s*|\s*\|$/g, "")
    .replace(/\s*\|\s*/g, " · ");
  const numbered = withoutDecoration.match(/^(\d+)[.)]\s+(.+)$/);
  if (numbered) return { kind: "number", marker: `${numbered[1]}.`, text: numbered[2] };

  const bullet = withoutDecoration.match(/^[-*•]\s+(.+)$/);
  if (bullet) return { kind: "bullet", text: bullet[1] };

  return { kind: "paragraph", text: withoutDecoration };
}

function parseContent(content: string) {
  const parsed = content.replace(/\r\n?/g, "\n").split("\n").map(normalizeLine).filter(Boolean);
  const result: ParsedLine[] = [];

  for (const line of parsed) {
    if (!line) continue;
    if (line.kind === "space" && result.at(-1)?.kind === "space") continue;
    result.push(line);
  }

  while (result[0]?.kind === "space") result.shift();
  while (result.at(-1)?.kind === "space") result.pop();
  return result;
}

/** Unique project names that are safe to match inline (avoid 1-char noise). */
function isProjectNameSafeForInlineMatch(name: string) {
  return name.trim().length >= 2;
}

function isBounded(text: string, index: number, length: number) {
  const previous = text[index - 1];
  const next = text[index + length];
  return !((previous && ENTITY_BOUNDARY.test(previous)) || (next && ENTITY_BOUNDARY.test(next)));
}

function collectRegexMatches(
  text: string,
  matcher: RegExp,
  mapMatch: (value: string, index: number) => TextMatch | null,
) {
  const matches: TextMatch[] = [];
  for (const match of text.matchAll(matcher)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!isBounded(text, index, value.length)) continue;
    const mapped = mapMatch(value, index);
    if (mapped) matches.push(mapped);
  }
  return matches;
}

function pickNonOverlapping(matches: TextMatch[]) {
  const sorted = [...matches].sort((left, right) => {
    if (left.index !== right.index) return left.index - right.index;
    return right.value.length - left.value.length;
  });
  const picked: TextMatch[] = [];
  let cursor = 0;
  for (const match of sorted) {
    if (match.index < cursor) continue;
    picked.push(match);
    cursor = match.index + match.value.length;
  }
  return picked;
}

function EntityText({
  text,
  entities,
  metaLabels,
}: {
  text: string;
  entities: EntityIndex;
  metaLabels: Map<string, string>;
}) {
  const source = normalizeEntitySource(text);
  const matches: TextMatch[] = [];

  if (entities.taskMatcher) {
    matches.push(
      ...collectRegexMatches(source, entities.taskMatcher, (value, index) => {
        const task =
          entities.taskByKey.get(value) ?? entities.taskByKey.get(value.toUpperCase()) ?? null;
        if (!task) return null;
        return { index, value, kind: "task", task };
      }),
    );
  }

  if (entities.projectMatcher) {
    matches.push(
      ...collectRegexMatches(source, entities.projectMatcher, (value, index) => {
        const project = entities.projectByName.get(value);
        if (!project) return null;
        return { index, value, kind: "project", project };
      }),
    );
  }

  matches.push(
    ...collectRegexMatches(source, META_ENUM_PATTERN, (value, index) => {
      const label = metaLabels.get(value.toUpperCase());
      if (!label) return null;
      return { index, value, kind: "meta", label };
    }),
  );

  const picked = pickNonOverlapping(matches);
  if (picked.length === 0) return source;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of picked) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));

    if (match.kind === "task" && match.task) {
      nodes.push(
        <Link
          key={`task-${match.task.id}-${match.index}`}
          to="/app/tasks"
          search={{ taskId: match.task.id }}
          aria-label={`${match.task.key} · ${match.task.title}`}
          title={`${match.task.key} · ${match.task.title}`}
          className="inline-flex items-baseline rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-primary underline-offset-2 transition hover:bg-primary/16 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          {match.task.key}
        </Link>,
      );
    } else if (match.kind === "project" && match.project) {
      nodes.push(
        <Link
          key={`project-${match.project.id}-${match.index}`}
          to="/app/projects/$projectId"
          params={{ projectId: match.project.id }}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 align-baseline font-medium text-foreground underline-offset-2 transition hover:bg-muted hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <span
            className={cn("size-2 shrink-0 rounded-full", getProjectAccent(match.project).dot)}
            aria-hidden
          />
          <span className="truncate">{match.project.name}</span>
        </Link>,
      );
    } else {
      nodes.push(
        <span key={`meta-${match.index}-${match.value}`} className="font-medium text-foreground">
          {match.label ?? match.value}
        </span>,
      );
    }

    cursor = match.index + match.value.length;
  }

  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}

export function AiEntityResponse({
  content,
  projects,
  tasks,
  compact = false,
  className,
}: AiEntityResponseProps) {
  const { t } = useI18n();
  const lines = parseContent(content);

  const metaLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const status of STATUS_ENUMS) {
      labels.set(status, dashboardStatusLabel(status as DashboardTaskStatus, t));
    }
    for (const priority of PRIORITY_ENUMS) {
      labels.set(priority, dashboardPriorityLabel(priority as DashboardTaskPriority, t));
    }
    return labels;
  }, [t]);

  const entities = useMemo<EntityIndex>(() => {
    const taskByKey = new Map<string, TaskApiItem>();
    const uniqueTaskKeys = new Set<string>();
    for (const task of tasks) {
      const trimmed = task.key.trim();
      if (!trimmed) continue;
      taskByKey.set(trimmed, task);
      taskByKey.set(trimmed.toUpperCase(), task);
      taskByKey.set(trimmed.toLowerCase(), task);
      uniqueTaskKeys.add(trimmed);
    }

    const projectNameCounts = new Map<string, number>();
    for (const project of projects) {
      projectNameCounts.set(project.name, (projectNameCounts.get(project.name) ?? 0) + 1);
    }
    const projectByName = new Map<string, ProjectApiItem>();
    for (const project of projects) {
      if (
        isProjectNameSafeForInlineMatch(project.name) &&
        projectNameCounts.get(project.name) === 1
      ) {
        projectByName.set(project.name, project);
      }
    }

    const taskCandidates = [...uniqueTaskKeys].sort((left, right) => right.length - left.length);
    const projectCandidates = [...projectByName.keys()].sort(
      (left, right) => right.length - left.length,
    );

    return {
      taskByKey,
      projectByName,
      taskMatcher:
        taskCandidates.length > 0
          ? new RegExp(taskCandidates.map(escapeRegExp).join("|"), "gi")
          : null,
      projectMatcher:
        projectCandidates.length > 0
          ? new RegExp(projectCandidates.map(escapeRegExp).join("|"), "g")
          : null,
    };
  }, [projects, tasks]);

  return (
    <div
      className={cn(
        "break-words [overflow-wrap:anywhere]",
        compact ? "space-y-1.5 text-xs leading-relaxed" : "space-y-3 text-sm leading-6",
        className,
      )}
    >
      {lines.map((line, index) => {
        if (line.kind === "space")
          return <div key={`space-${index}`} className={compact ? "h-1" : "h-1.5"} aria-hidden />;
        if (line.kind === "bullet" || line.kind === "number") {
          return (
            <div
              key={`${line.kind}-${index}`}
              className="grid grid-cols-[1.35rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1"
            >
              <span className="pt-px text-right font-medium text-muted-foreground">
                {line.kind === "bullet" ? "•" : line.marker}
              </span>
              <p className="min-w-0">
                <EntityText text={line.text} entities={entities} metaLabels={metaLabels} />
              </p>
            </div>
          );
        }
        return (
          <p key={`paragraph-${index}`} className="min-w-0">
            <EntityText text={line.text} entities={entities} metaLabels={metaLabels} />
          </p>
        );
      })}
    </div>
  );
}
