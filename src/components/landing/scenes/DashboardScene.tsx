import {
  AlarmClock,
  AlertTriangle,
  CircleAlert,
  CreditCard,
  Flame,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Settings,
  Sparkles,
  Trello,
  UserRoundX,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import { ProductFrame } from "./ProductFrame";

const projectBars = [
  { key: "landing.preview.projectOrion" as const, value: 76, color: "#7c6ff0" },
  { key: "landing.preview.projectMobile" as const, value: 58, color: "#248bbb" },
  { key: "landing.preview.projectMarketing" as const, value: 41, color: "#c27942" },
];

const activityBuckets = [
  { label: "Wed", created: 32, done: 18 },
  { label: "Thu", created: 45, done: 26 },
  { label: "Fri", created: 58, done: 42 },
  { label: "Sat", created: 38, done: 24 },
  { label: "Sun", created: 54, done: 36 },
  { label: "Mon", created: 72, done: 48 },
  { label: "Tue", created: 100, done: 63 },
];

// Keep this in lockstep with APP_NAV_ITEMS so the public scene mirrors the real app shell.
const sidebarItems = [
  LayoutDashboard,
  FolderKanban,
  Trello,
  ListChecks,
  Users,
  MessageSquare,
  Sparkles,
  Settings,
  CreditCard,
];

export function DashboardScene() {
  const { t } = useI18n();

  const metrics = [
    { label: t("dashboard.overdue"), value: "0", icon: AlertTriangle, tone: "danger" },
    { label: t("dashboard.dueSoon"), value: "2", icon: AlarmClock, tone: "warning" },
    { label: t("dashboard.urgentOpen"), value: "3", icon: Flame, tone: "danger" },
    { label: t("dashboard.unassigned"), value: "6", icon: UserRoundX, tone: "muted" },
  ];

  return (
    <ProductFrame className="dashboard-scene">
      <div className="dashboard-scene__shell">
        <aside className="dashboard-scene__sidebar" aria-hidden>
          <div className="dashboard-scene__workspace">AC</div>
          {sidebarItems.map((Icon, index) => (
            <span key={index} className={index === 0 ? "is-active" : undefined}>
              <Icon />
            </span>
          ))}
        </aside>

        <div className="dashboard-scene__content">
          <div className="dashboard-scene__heading">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Acme Studio
              </p>
              <h3 className="mt-1 text-[15px] font-semibold">{t("dashboard.overviewTitle")}</h3>
            </div>
          </div>

          <div className="dashboard-scene__metrics">
            {metrics.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className={`dashboard-metric dashboard-metric--${tone}`}>
                <span className="dashboard-metric__icon"><Icon aria-hidden /></span>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="dashboard-scene__main-grid">
            <div className="dashboard-panel dashboard-panel--activity">
              <div className="dashboard-activity-head">
                <div>
                  <span>{t("dashboard.taskActivity")}</span>
                  <small>{t("dashboard.doneTasksActivityNote")}</small>
                </div>
                <div className="dashboard-periods"><b>{t("dashboard.periodWeek")}</b><span>{t("dashboard.periodMonth")}</span><span>{t("dashboard.periodYear")}</span></div>
              </div>
              <div className="dashboard-chart-legend"><span><i className="is-created" />{t("dashboard.createdTasks")}</span><span><i className="is-done" />{t("dashboard.doneTasks")}</span></div>
              <div className="dashboard-chart-wrap" aria-hidden>
                <div className="dashboard-chart-axis"><span>8</span><span>6</span><span>4</span><span>2</span><span>0</span></div>
                <div className="dashboard-bar-chart">
                  {activityBuckets.map((bucket) => (
                    <div className="dashboard-bar-chart__bucket" key={bucket.label}>
                      <div className="dashboard-bar-chart__bars">
                        <span className="is-created" style={{ "--bar-height": `${bucket.created}%` } as CSSProperties} />
                        <span className="is-done" style={{ "--bar-height": `${bucket.done}%` } as CSSProperties} />
                      </div>
                      <small>{bucket.label}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="dashboard-panel dashboard-panel--status">
              <div className="dashboard-panel__title"><span>{t("dashboard.taskStatus")}</span></div>
              <div className="dashboard-status">
                <div className="dashboard-status__ring" aria-hidden />
                <div className="dashboard-status__legend">
                  <span><i className="bg-[#94a3b8]" />{t("board.backlog")} <b>5</b></span>
                  <span><i className="bg-[#0ea5e9]" />{t("board.inProgress")} <b>4</b></span>
                  <span><i className="bg-[#f59e0b]" />{t("board.review")} <b>2</b></span>
                  <span><i className="bg-[#10b981]" />{t("board.done")} <b>6</b></span>
                </div>
              </div>
            </div>

            <div className="dashboard-panel dashboard-panel--insight">
              <div className="dashboard-panel__title">
                <span className="flex items-center gap-1.5"><Sparkles className="size-3 text-violet-600" />{t("landing.preview.compactAiTitle")}</span>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {t("landing.preview.briefingBody")}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-violet-700">
                <CircleAlert className="size-3" /> {t("landing.preview.aiRiskOne")}
              </div>
              <div className="dashboard-insight-signals">
                <span><b>2</b>{t("dashboard.overdue")}</span>
                <span><b>3</b>{t("dashboard.urgentOpen")}</span>
              </div>
            </div>

            <div className="dashboard-panel dashboard-panel--projects">
              <div className="dashboard-panel__title"><span>{t("dashboard.projectProgress")}</span></div>
              <div className="mt-3 space-y-3">
                {projectBars.map((project) => (
                  <div key={project.key}>
                    <div className="mb-1 flex justify-between gap-3 text-[10px]"><span className="truncate font-medium">{t(project.key)}</span><span className="text-muted-foreground">{project.value}%</span></div>
                    <div className="h-1 overflow-hidden bg-[#e8e5dd]"><span className="public-progress-enter block h-full" style={{ width: `${project.value}%`, background: project.color }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-panel dashboard-panel--deadlines">
              <div className="dashboard-panel__title"><span>{t("dashboard.upcomingDeadlines")}</span></div>
              <div className="mt-3 space-y-2.5 text-[10px]">
                <div className="flex items-start gap-2"><span className="mt-0.5 size-1.5 shrink-0 bg-amber-500" /><span>{t("landing.preview.deadlineOne")}</span></div>
                <div className="flex items-start gap-2"><span className="mt-0.5 size-1.5 shrink-0 bg-violet-500" /><span>{t("landing.preview.deadlineTwo")}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProductFrame>
  );
}
