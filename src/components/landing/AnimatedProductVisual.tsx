import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Sparkles } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ProductSceneName = "dashboard" | "ai" | "kanban";

const SCENES: ProductSceneName[] = ["dashboard", "ai", "kanban"];
const SCENE_LABEL: Record<ProductSceneName, TKey> = {
  dashboard: "side.dashboard",
  ai: "side.assistant",
  kanban: "side.kanban",
};

type AnimatedProductVisualProps = {
  /** Hero is largest; auth and feature variants keep the same product language with calmer motion. */
  variant?: "hero" | "auth" | "feature";
  /** Locks the window to one real product scene (used by feature sections). */
  scene?: ProductSceneName;
  className?: string;
};

/**
 * Workspace window mockup with soft depth. Pass `scene` to lock a single
 * product surface (hero / feature sections use this for a stable first look).
 */
export function AnimatedProductVisual({
  variant = "hero",
  scene: fixedScene,
  className,
}: AnimatedProductVisualProps) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<ProductSceneName>("dashboard");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const isAuth = variant === "auth";
  const isFeature = variant === "feature";
  const activeScene = fixedScene ?? scene;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || fixedScene || !pageVisible) return;
    const intervalMs = isAuth ? 9400 : 7600;
    const id = window.setInterval(() => {
      setScene((current) => {
        const index = SCENES.indexOf(current);
        return SCENES[(index + 1) % SCENES.length]!;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [fixedScene, isAuth, pageVisible, reduceMotion]);

  const resetPointerDepth = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--product-pointer-x", "0deg");
    stage.style.setProperty("--product-pointer-y", "0deg");
    stage.style.setProperty("--product-pointer-shift-x", "0px");
    stage.style.setProperty("--product-pointer-shift-y", "0px");
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (variant !== "hero" || reduceMotion || event.pointerType !== "mouse") return;
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));

    stage.style.setProperty("--product-pointer-x", `${(-y * 0.85).toFixed(2)}deg`);
    stage.style.setProperty("--product-pointer-y", `${(x * 1.15).toFixed(2)}deg`);
    stage.style.setProperty("--product-pointer-shift-x", `${(x * 3).toFixed(1)}px`);
    stage.style.setProperty("--product-pointer-shift-y", `${(y * 2).toFixed(1)}px`);
  };

  return (
    <div
      ref={stageRef}
      className={cn("product-stage relative min-w-0", `product-stage--${variant}`, className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerDepth}
    >
      <div className="product-stage__glow" aria-hidden />
      <div className="product-stage__plane product-stage__plane--rear" aria-hidden />
      {!isAuth ? (
        <div className="product-stage__plane product-stage__plane--near" aria-hidden />
      ) : null}
      <div
        className={cn(
          "product-window relative rounded-2xl border border-border/90 bg-card/90 shadow-card",
          isAuth
            ? "product-window--auth p-1.5 sm:rounded-2xl sm:p-2"
            : isFeature
              ? "product-window--feature p-2 sm:rounded-3xl"
              : "product-window--hero p-2 sm:rounded-[1.75rem] sm:p-2.5",
        )}
      >
        <div className="product-window__edge" aria-hidden />

        <div className="product-window__screen overflow-hidden rounded-xl border border-border bg-background sm:rounded-2xl">
          <div className="product-window__chrome flex min-w-0 items-center gap-1.5 border-b border-border px-3 py-2">
            <span className="size-2.5 shrink-0 rounded-full bg-red-400/70" />
            <span className="size-2.5 shrink-0 rounded-full bg-amber-400/70" />
            <span className="size-2.5 shrink-0 rounded-full bg-emerald-400/70" />
            <div className="ml-3 min-w-0 truncate text-xs text-muted-foreground">
              {t("landing.preview.windowTitle")}
            </div>
            <div className="ml-auto hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {t(SCENE_LABEL[activeScene])}
            </div>
          </div>

          <div
            className={cn(
              "product-window__workspace grid gap-3 p-3 sm:p-4",
              isAuth
                ? "md:grid-cols-[120px_1fr]"
                : isFeature
                  ? "min-[560px]:grid-cols-[132px_1fr]"
                  : "md:grid-cols-[150px_1fr]",
            )}
          >
            <aside
              className={cn("hidden space-y-1", isFeature ? "min-[560px]:block" : "md:block")}
              aria-hidden
            >
              {SCENES.map((item) => (
                <div
                  key={item}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-500",
                    activeScene === item
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-colors duration-500",
                      activeScene === item ? "bg-primary" : "bg-primary/40",
                    )}
                  />
                  {t(SCENE_LABEL[item])}
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground/70">
                <span className="size-1.5 rounded-full bg-muted-foreground/35" />
                {t("side.projects")}
              </div>
            </aside>

            <div
              className={cn(
                "relative min-h-[17.5rem] min-w-0",
                isAuth
                  ? "sm:min-h-[16.5rem]"
                  : isFeature
                    ? "sm:min-h-[19rem]"
                    : "sm:min-h-[20rem] lg:min-h-[21rem]",
              )}
            >
              <ScenePanel active={activeScene === "dashboard"} reduceMotion={reduceMotion}>
                <DashboardScene dense={isAuth} />
              </ScenePanel>
              <ScenePanel active={activeScene === "ai"} reduceMotion={reduceMotion}>
                <AiScene dense={isAuth} />
              </ScenePanel>
              <ScenePanel active={activeScene === "kanban"} reduceMotion={reduceMotion}>
                <KanbanScene dense={isAuth} />
              </ScenePanel>
            </div>
          </div>
        </div>
      </div>

      {!reduceMotion && !fixedScene ? (
        <div
          className="product-stage__progress mt-4 flex items-center justify-center gap-1.5"
          aria-hidden
        >
          {SCENES.map((item) => (
            <span
              key={item}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                activeScene === item ? "w-5 bg-primary" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScenePanel({
  active,
  reduceMotion,
  children,
}: {
  active: boolean;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 min-w-0",
        reduceMotion ? (active ? "opacity-100" : "pointer-events-none opacity-0") : "landing-scene",
        !reduceMotion && active && "landing-scene--active",
        !reduceMotion && !active && "pointer-events-none",
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

function DashboardScene({ dense }: { dense: boolean }) {
  const { t } = useI18n();
  const stats: { labelKey: TKey; value: string }[] = [
    { labelKey: "landing.preview.activeProjects", value: "6" },
    { labelKey: "landing.preview.openTasks", value: "28" },
    { labelKey: "landing.preview.doneThisWeek", value: "14" },
    { labelKey: "landing.preview.teamMembers", value: "8" },
  ];
  const projects: { nameKey: TKey; percent: number; dot: string; bar: string }[] = [
    {
      nameKey: "landing.preview.projectOrion",
      percent: 72,
      dot: "bg-indigo-500",
      bar: "from-indigo-500 to-violet-500",
    },
    {
      nameKey: "landing.preview.projectMobile",
      percent: 41,
      dot: "bg-cyan-500",
      bar: "from-blue-500 to-cyan-500",
    },
    {
      nameKey: "landing.preview.projectMarketing",
      percent: 18,
      dot: "bg-fuchsia-500",
      bar: "from-fuchsia-500 to-pink-500",
    },
  ];

  return (
    <div className={cn("space-y-2.5", dense && "space-y-2")}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.labelKey}
            className="min-w-0 rounded-xl border border-border bg-card px-2.5 py-2"
          >
            <div className="truncate text-[10px] text-muted-foreground">{t(stat.labelKey)}</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums">{stat.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-2.5">
        <div className="text-[11px] font-medium text-muted-foreground">
          {t("landing.preview.deadlinesTitle")}
        </div>
        <ul className="mt-2 space-y-1.5">
          {projects.slice(0, dense ? 2 : 3).map((project) => (
            <li key={project.nameKey} className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", project.dot)} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {t(project.nameKey)}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {project.percent}%
              </span>
              <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-muted sm:block">
                <span
                  className={cn("block h-full rounded-full bg-gradient-to-r", project.bar)}
                  style={{ width: `${project.percent}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
      {!dense ? (
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            {t("landing.preview.compactAiTitle")}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {t("landing.preview.compactAiBody")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AiScene({ dense }: { dense: boolean }) {
  const { t } = useI18n();
  const chips: TKey[] = [
    "landing.preview.aiChipSummary",
    "landing.preview.aiChipAttention",
    "landing.preview.aiChipDeadlines",
  ];

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2.5", dense && "gap-2")}>
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card to-card p-3 shadow-soft">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="grid size-6 place-items-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          {t("landing.preview.aiTitle")}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {t("landing.preview.aiLead")}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((key) => (
            <span
              key={key}
              className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] text-foreground/80"
            >
              {t(key)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("landing.preview.aiRisksTitle")}
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
            <li className="truncate">{t("landing.preview.aiRiskOne")}</li>
            <li className="truncate">{t("landing.preview.aiRiskTwo")}</li>
            {!dense ? <li className="truncate">{t("landing.preview.aiRiskThree")}</li> : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("landing.preview.aiProjectsTitle")}
          </div>
          <ul className="mt-2 space-y-2">
            {[
              {
                nameKey: "landing.preview.projectOrion" as const,
                percent: 72,
                dot: "bg-indigo-500",
              },
              {
                nameKey: "landing.preview.projectMobile" as const,
                percent: 41,
                dot: "bg-cyan-500",
              },
            ].map((project) => (
              <li key={project.nameKey} className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 shrink-0 rounded-full", project.dot)} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                    {t(project.nameKey)}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {project.percent}%
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${project.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KanbanScene({ dense }: { dense: boolean }) {
  const { t } = useI18n();
  const columns: {
    titleKey: TKey;
    tasks: { id: string; titleKey: TKey; priorityKey: TKey; accent: string }[];
  }[] = [
    {
      titleKey: "board.backlog",
      tasks: [
        {
          id: "TF-141",
          titleKey: "landing.preview.taskReleaseStructure",
          priorityKey: "tasks.priorityMedium",
          accent: "bg-sky-500",
        },
        {
          id: "TF-142",
          titleKey: "landing.preview.taskKanbanResponsive",
          priorityKey: "tasks.priorityLow",
          accent: "bg-emerald-500",
        },
      ],
    },
    {
      titleKey: "board.inProgress",
      tasks: [
        {
          id: "TF-118",
          titleKey: "landing.preview.taskAiBriefing",
          priorityKey: "tasks.priorityUrgent",
          accent: "bg-violet-500",
        },
      ],
    },
    {
      titleKey: "board.review",
      tasks: [
        {
          id: "TF-109",
          titleKey: "landing.preview.taskCloseRelease",
          priorityKey: "tasks.priorityMedium",
          accent: "bg-fuchsia-500",
        },
      ],
    },
    {
      titleKey: "board.done",
      tasks: [
        {
          id: "TF-106",
          titleKey: "landing.preview.taskProjectStatuses",
          priorityKey: "tasks.priorityLow",
          accent: "bg-emerald-500",
        },
      ],
    },
  ];

  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
        <div className="text-xs font-semibold">{t("landing.preview.kanbanTitle")}</div>
        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px]">
          {t("landing.preview.kanbanTasks").replace("{count}", "4")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-4">
        {columns.map((column) => (
          <div key={column.titleKey} className="min-w-0 rounded-xl bg-muted/60 p-1.5 sm:p-2">
            <div className="mb-1.5 flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="min-w-0 truncate">{t(column.titleKey)}</span>
              <span className="shrink-0">{column.tasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {column.tasks.slice(0, dense ? 1 : 2).map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-border bg-card p-2 shadow-soft"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 shrink-0 rounded-full", task.accent)} />
                    <span className="text-[10px] text-muted-foreground">{task.id}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug">
                    {t(task.titleKey)}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="truncate rounded bg-accent/60 px-1 py-0.5 text-[9px] text-accent-foreground">
                      {t(task.priorityKey)}
                    </span>
                    <span className="size-3.5 shrink-0 rounded-full bg-gradient-brand" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
