import { CalendarDays, ChevronDown, Filter, Flag, GripVertical, MessageSquareText, Paperclip, Plus, RotateCcw, Users } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { ProductFrame } from "./ProductFrame";

type WorkflowTask = {
  id: string;
  title: TKey;
  priority: "low" | "medium" | "urgent";
  owner: string;
  date: string;
  comments: number;
  attachments?: number;
};

const columns: Array<{ title: TKey; count: number; countAfter?: number; tasks: WorkflowTask[] }> = [
  { title: "board.backlog", count: 5, tasks: [
    { id: "TF-143", title: "landing.preview.taskSprintDeadlines", priority: "medium", owner: "MS", date: "12 Aug", comments: 3 },
    { id: "TF-146", title: "landing.preview.taskAddMembers", priority: "low", owner: "IV", date: "13 Aug", comments: 1 },
    { id: "TF-149", title: "landing.preview.taskLaunchMetrics", priority: "medium", owner: "EK", date: "15 Aug", comments: 2, attachments: 1 },
  ] },
  { title: "board.inProgress", count: 6, countAfter: 5, tasks: [
    { id: "TF-141", title: "landing.preview.taskKanbanResponsive", priority: "urgent", owner: "DP", date: "12 Aug", comments: 6, attachments: 1 },
    { id: "TF-137", title: "landing.preview.taskReleaseStructure", priority: "urgent", owner: "AK", date: "12 Aug", comments: 5, attachments: 2 },
    { id: "TF-139", title: "landing.preview.taskAiBriefing", priority: "medium", owner: "LN", date: "13 Aug", comments: 2 },
    { id: "TF-145", title: "landing.preview.sampleTask", priority: "medium", owner: "MS", date: "14 Aug", comments: 4, attachments: 1 },
  ] },
  { title: "board.review", count: 2, countAfter: 3, tasks: [
    { id: "TF-141", title: "landing.preview.taskKanbanResponsive", priority: "urgent", owner: "DP", date: "12 Aug", comments: 6, attachments: 1 },
    { id: "TF-142", title: "landing.preview.taskFileUploads", priority: "low", owner: "EK", date: "13 Aug", comments: 2, attachments: 3 },
    { id: "TF-147", title: "landing.preview.taskMobileQa", priority: "urgent", owner: "IV", date: "14 Aug", comments: 3 },
  ] },
  { title: "board.done", count: 7, tasks: [
    { id: "TF-132", title: "landing.preview.taskTeamRoles", priority: "medium", owner: "AM", date: "09 Aug", comments: 2 },
    { id: "TF-128", title: "landing.preview.taskProjectStatuses", priority: "low", owner: "MS", date: "08 Aug", comments: 1 },
    { id: "TF-135", title: "landing.preview.taskCloseRelease", priority: "medium", owner: "AK", date: "10 Aug", comments: 4, attachments: 2 },
  ] },
];

export function WorkflowScene() {
  const { t } = useI18n();

  return (
    <ProductFrame title={t("landing.preview.kanbanTitle")} className="workflow-scene">
      <div className="workflow-scene__content">
        <div className="workflow-scene__scroll app-scrollbar">
        <div className="workflow-toolbar">
          <div className="workflow-toolbar__label"><Filter />{t("board.filters")}</div>
          <div className="workflow-filter"><Flag /><span>{t("tasks.allPriorities")}</span><ChevronDown /></div>
          <div className="workflow-filter"><Users /><span>{t("tasks.allAssignees")}</span><ChevronDown /></div>
          <button type="button" tabIndex={-1}><RotateCcw />{t("common.clearFilters")}</button>
          <button className="workflow-toolbar__create" type="button" tabIndex={-1}><Plus />{t("common.newTask")}</button>
        </div>

        <div className="workflow-board">
          {columns.map((column, columnIndex) => (
            <div className="workflow-column" key={column.title}>
              <div className="workflow-column__heading"><span className={`workflow-status workflow-status--${columnIndex}`} />{t(column.title)}<b className={column.countAfter ? "workflow-count workflow-count--change" : "workflow-count"}><span>{column.count}</span>{column.countAfter ? <span>{column.countAfter}</span> : null}</b></div>
              <div className="workflow-column__tasks">
                {column.tasks.map((task, taskIndex) => (
                  <div
                    className={
                      task.id === "TF-141" && columnIndex === 1
                        ? "workflow-task workflow-drag-origin"
                        : task.id === "TF-141" && columnIndex === 2
                          ? "workflow-task workflow-drop-card"
                        : columnIndex === 2 && taskIndex === 1
                          ? "workflow-task workflow-task--arrive"
                          : "workflow-task"
                    }
                    key={task.id}
                  >
                    <div className="workflow-task__id"><span>{task.id}</span><GripVertical /></div>
                    <p>{t(task.title)}</p>
                    <span className={`workflow-task__project workflow-task__project--${(columnIndex + taskIndex) % 3}`}><i />{t((["landing.preview.projectOrion", "landing.preview.projectMobile", "landing.preview.projectMarketing"] as TKey[])[(columnIndex + taskIndex) % 3])}</span>
                    <i className={`workflow-task__priority priority-${task.priority}`}>{t(`tasks.priority${task.priority === "urgent" ? "Urgent" : task.priority === "medium" ? "Medium" : "Low"}` as TKey)}</i>
                    <div className="workflow-task__meta">
                      <span><CalendarDays />{task.date}</span>
                      <span><MessageSquareText />{task.comments}</span>
                      {task.attachments ? <span><Paperclip />{task.attachments}</span> : null}
                      <b>{task.owner}</b>
                    </div>
                    <div className="workflow-task__status"><span className={`workflow-status workflow-status--${columnIndex}`} />{t(column.title)}<ChevronDown /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="workflow-drag-demo" aria-hidden>
            <div className="workflow-task__id"><span>TF-141</span><GripVertical /></div>
            <p>{t("landing.preview.taskKanbanResponsive")}</p>
            <span className="workflow-drag-demo__project"><i />{t("landing.preview.projectOrion")}</span>
            <i className="workflow-task__priority priority-urgent">{t("tasks.priorityUrgent")}</i>
            <span className="workflow-drag-demo__status"><i>{t("board.inProgress")}</i><i>{t("board.review")}</i></span>
            <div className="workflow-task__meta"><span><CalendarDays />12 Aug</span><span><MessageSquareText />6</span><span><Paperclip />1</span><b>DP</b></div>
          </div>
        </div>
        </div>
      </div>
    </ProductFrame>
  );
}
