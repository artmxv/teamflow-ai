import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";

const SAMPLE_TASKS: TKey[] = [
  "landing.preview.taskReleaseStructure",
  "landing.preview.taskKanbanResponsive",
  "landing.preview.taskTeamRoles",
  "landing.preview.taskProjectStatuses",
  "landing.preview.taskSprintDeadlines",
  "landing.preview.taskFileUploads",
  "landing.preview.taskAiBriefing",
  "landing.preview.taskAddMembers",
  "landing.preview.taskCloseRelease",
];

export function ProductPreview() {
  const { t } = useI18n();

  const productPoints: TKey[] = [
    "landing.product.pointChat",
    "landing.product.pointBriefings",
    "landing.product.pointAttachments",
    "landing.product.pointRoles",
  ];

  const columns: { titleKey: TKey; taskKeys: TKey[] }[] = [
    {
      titleKey: "board.todo",
      taskKeys: SAMPLE_TASKS.slice(0, 3),
    },
    {
      titleKey: "board.inProgress",
      taskKeys: SAMPLE_TASKS.slice(3, 6),
    },
    {
      titleKey: "board.review",
      taskKeys: SAMPLE_TASKS.slice(6, 9),
    },
  ];

  let taskId = 200;

  return (
    <section
      id="preview"
      className="scroll-mt-20 border-y border-border/60 bg-muted/25 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t("nav.product")}
            </div>
            <h2 className="public-heading mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.product.title")}
            </h2>
            <p className="public-body mt-4 text-muted-foreground">
              {t("landing.product.subtitle")}
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-[1.55]">
              {productPoints.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 break-words">{t(key)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild variant="brand">
                <Link to="/signup">{t("landing.cta.createAccount")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/signin">{t("nav.signin")}</Link>
              </Button>
            </div>
          </div>

          <div className="min-w-0 w-full rounded-2xl border border-border bg-card/90 p-2.5 shadow-card sm:rounded-3xl sm:p-3">
            <div className="overflow-hidden rounded-xl border border-border bg-background p-3.5 sm:rounded-2xl sm:p-5">
              <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
                <div className="text-base font-semibold leading-[1.3]">
                  {t("landing.preview.kanbanTitle")}
                </div>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs leading-[1.3]">
                  {t("landing.preview.kanbanTasks").replace("{count}", "9")}
                </span>
              </div>
              <div className="min-w-0">
                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                  {columns.map((col) => (
                    <div key={col.titleKey} className="min-w-0 rounded-xl bg-muted/60 p-2.5 sm:p-3">
                      <div className="mb-2.5 flex items-center justify-between gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-[1.3]">
                        <span className="min-w-0 truncate">{t(col.titleKey)}</span>
                        <span className="shrink-0">{col.taskKeys.length}</span>
                      </div>
                      <div className="space-y-2.5">
                        {col.taskKeys.map((taskKey) => {
                          const id = taskId++;
                          return (
                            <div
                              key={taskKey}
                              className="rounded-lg border border-border bg-card p-2.5 shadow-soft sm:p-3"
                            >
                              <div className="text-[11px] leading-[1.3] text-muted-foreground">
                                TF-{id}
                              </div>
                              <div className="mt-1 text-[13px] font-medium leading-snug line-clamp-2 sm:text-sm">
                                {t(taskKey)}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="rounded bg-accent/60 px-1.5 py-0.5 text-[10px] leading-[1.3] text-accent-foreground">
                                  {t("landing.preview.sampleTag")}
                                </span>
                                <span className="size-4 shrink-0 rounded-full bg-gradient-brand" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
