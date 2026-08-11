import { CalendarClock, ChartColumn, LockKeyhole, Send, Sparkles, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ProductFrame } from "./ProductFrame";

export function AiCopilotScene() {
  const { t } = useI18n();

  return (
    <ProductFrame tone="dark" title={t("landing.preview.aiTitle")} className="ai-copilot-scene">
      <div className="ai-copilot-scene__layout">
        <div className="ai-conversation">
          <div className="ai-conversation__context">
            <span className="ai-scene-avatar"><Sparkles className="size-3.5" /></span>
            <span><strong>TeamFlow AI</strong><small>{t("landing.ai.pointReadonly")}</small></span>
          </div>

          <div className="ai-question"><span className="ai-question__text">{t("landing.ai.demoQuestion")}</span></div>

          <div className="ai-answer">
            <small className="ai-answer__label">COPILOT</small>
            <div className="ai-answer__summary">
              <p>{t("landing.ai.demoAnswer")}</p>
              <ul>
                <li><b>TF-141</b><span>{t("landing.ai.nextStepOne")}</span></li>
                <li><b>TF-137</b><span>{t("landing.ai.nextStepTwo")}</span></li>
                <li><i /> <span>{t("landing.preview.projectOrion")} · 76%</span></li>
              </ul>
            </div>
            <p className="ai-answer__source"><LockKeyhole />{t("landing.ai.demoSource")}</p>
          </div>

          <div className="ai-suggestions">
            <span>{t("ai.suggestionSummary")}</span>
            <span>{t("ai.suggestionAttention")}</span>
            <span>{t("ai.suggestionDeadlines")}</span>
            <span>{t("ai.suggestionProjects")}</span>
          </div>
          <div className="ai-composer-preview">
            <span>{t("ai.copilotPlaceholder")}</span>
            <button type="button" tabIndex={-1} aria-hidden><Send /></button>
          </div>
        </div>

        <aside className="ai-insight-rail">
          <section className="ai-rail-card">
            <div className="ai-insight-rail__heading"><span><Target />{t("ai.insightFocus")}</span></div>
            <div className="ai-focus-grid">
              <span><b className="text-rose-300">0</b><small>{t("ai.focusOverdue")}</small></span>
              <span><b className="text-sky-300">9</b><small>{t("ai.focusOpen")}</small></span>
              <span><b className="text-amber-300">1</b><small>{t("ai.focusUrgent")}</small></span>
            </div>
          </section>
          <section className="ai-rail-card">
            <div className="ai-insight-rail__heading"><span><CalendarClock />{t("ai.insightDeadlines")}</span><small>{t("ai.insightAll")}</small></div>
            <div className="ai-deadline"><i className="bg-violet-400" /><span><strong>{t("landing.preview.projectOrion")}</strong>{t("landing.preview.deadlineOne")}</span></div>
            <div className="ai-deadline"><i className="bg-sky-400" /><span><strong>{t("landing.preview.projectMobile")}</strong>{t("landing.preview.deadlineTwo")}</span></div>
          </section>
          <section className="ai-rail-card ai-rail-card--projects">
            <div className="ai-insight-rail__heading"><span><ChartColumn />{t("ai.insightProjects")}</span><small>{t("ai.insightAll")}</small></div>
            <div className="ai-project-progress">
              <div><span><i className="bg-violet-400" />{t("landing.preview.projectOrion")}</span><strong>76%</strong></div>
              <div className="h-1 overflow-hidden bg-white/10"><span className="public-progress-enter block h-full w-[76%] bg-violet-400" /></div>
              <div><span><i className="bg-sky-400" />{t("landing.preview.projectMobile")}</span><strong>58%</strong></div>
              <div className="h-1 overflow-hidden bg-white/10"><span className="public-progress-enter block h-full w-[58%] bg-sky-400" /></div>
              <div><span><i className="bg-amber-400" />{t("landing.preview.projectMarketing")}</span><strong>41%</strong></div>
              <div className="h-1 overflow-hidden bg-white/10"><span className="public-progress-enter block h-full w-[41%] bg-amber-400" /></div>
            </div>
          </section>
        </aside>
      </div>
    </ProductFrame>
  );
}
