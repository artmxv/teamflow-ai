export type AiLocale = "en" | "ru";

export function parseAiLocale(value: unknown): AiLocale {
  return value === "ru" ? "ru" : "en";
}

type Metrics = {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  urgentTasks: number;
  highPriorityTasks: number;
  reviewTasks: number;
  overdueTasks: number;
};

export function formatCount(
  locale: AiLocale,
  count: number,
  singular: string,
  plural: string,
): string {
  const label = count === 1 ? singular : plural;
  return `${count} ${label}`;
}

export function buildOverviewCopy(locale: AiLocale, metrics: Metrics): string {
  if (locale === "ru") {
    if (metrics.totalProjects === 0) {
      return "В пространстве пока нет проектов. Создайте проект и добавьте задачи, чтобы отслеживать работу.";
    }
    const projectPart =
      metrics.activeProjects === metrics.totalProjects
        ? formatCount(locale, metrics.totalProjects, "проект", "проектов")
        : `${metrics.activeProjects} активных из ${metrics.totalProjects} проектов`;
    if (metrics.totalTasks === 0) {
      return `В пространстве ${projectPart}, но задач пока нет. Добавьте задачи для отслеживания прогресса.`;
    }
    const openLabel = metrics.openTasks === 1 ? "открытая задача" : "открытых задач";
    const doneLabel = metrics.completedTasks === 1 ? "выполненная задача" : "выполненных задач";
    return `В пространстве ${projectPart}, ${metrics.openTasks} ${openLabel} и ${metrics.completedTasks} ${doneLabel}.`;
  }

  if (metrics.totalProjects === 0) {
    return "The workspace has no projects yet. Create a project and add tasks to start tracking delivery.";
  }
  const projectPart =
    metrics.activeProjects === metrics.totalProjects
      ? formatCount(locale, metrics.totalProjects, "project", "projects")
      : `${metrics.activeProjects} active of ${metrics.totalProjects} projects`;
  if (metrics.totalTasks === 0) {
    return `The workspace has ${projectPart} but no tasks yet. Add tasks to monitor progress and priorities.`;
  }
  const openLabel = metrics.openTasks === 1 ? "open task" : "open tasks";
  const doneLabel = metrics.completedTasks === 1 ? "completed task" : "completed tasks";
  return `The workspace has ${projectPart}, ${metrics.openTasks} ${openLabel}, and ${metrics.completedTasks} ${doneLabel}.`;
}

export function emptyWorkspaceHighlight(locale: AiLocale): string {
  return locale === "ru"
    ? "Пространство готово к первому проекту и списку задач."
    : "Workspace is ready for the first project and task backlog.";
}

export function completedHighlight(locale: AiLocale, count: number): string {
  if (locale === "ru") {
    return count === 1
      ? "1 задача выполнена в пространстве."
      : `${count} задач выполнено в пространстве.`;
  }
  return count === 1
    ? "1 task has been completed across the workspace."
    : `${count} tasks have been completed across the workspace.`;
}

export function inProgressHighlight(locale: AiLocale, count: number): string {
  if (locale === "ru") {
    return count === 1 ? "1 задача в работе." : `${count} задач в работе.`;
  }
  return count === 1
    ? "1 task is actively in progress."
    : `${count} tasks are actively in progress.`;
}

export function activeProjectsHighlight(locale: AiLocale, names: string[]): string {
  const list = names.slice(0, 3).join(", ");
  const suffix = names.length > 3 ? (locale === "ru" ? " и другие" : ", and others") : "";
  return locale === "ru"
    ? `Активные направления: ${list}${suffix}.`
    : `Active delivery focus: ${list}${suffix}.`;
}

export function defaultHighlight(locale: AiLocale): string {
  return locale === "ru"
    ? "Работа идёт; продолжайте двигать задачи по процессу."
    : "Work is underway; continue moving tasks through the workflow.";
}

export function noRisks(locale: AiLocale): string {
  return locale === "ru"
    ? "Серьёзных рисков сейчас не обнаружено."
    : "No major risks detected at this time.";
}

export function overdueRisk(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    const suffix = count === 1 ? "просроченная задача" : "просроченных задач";
    return `${count} ${suffix} требуют внимания: ${sample}.`;
  }
  return `${count} overdue task${count === 1 ? "" : "s"} need attention: ${sample}.`;
}

export function urgentRisk(locale: AiLocale, count: number): string {
  if (locale === "ru") {
    return count === 1
      ? "1 срочная открытая задача может заблокировать поставку."
      : `${count} срочных открытых задач могут заблокировать поставку.`;
  }
  return `${count} urgent open task${count === 1 ? "" : "s"} may block delivery if not addressed soon.`;
}

export function highPriorityRisk(locale: AiLocale, count: number): string {
  if (locale === "ru") {
    return count === 1
      ? "1 задача с высоким приоритетом должна быть запланирована в текущем спринте."
      : `${count} задач с высоким приоритетом нужно запланировать в текущем спринте.`;
  }
  return `${count} high-priority open task${count === 1 ? "" : "s"} should be scheduled in the current sprint.`;
}

export function starterActions(locale: AiLocale, kind: "projects" | "tasks"): string[] {
  if (locale === "ru") {
    if (kind === "projects") {
      return [
        "Создайте первый проект для организации работы.",
        "Определите начальные этапы и ответственных.",
        "Добавьте задачи с приоритетами и сроками после создания проекта.",
      ];
    }
    return [
      "Разбейте активные проекты на конкретные задачи с ответственными.",
      "Установите приоритеты и сроки для отслеживания прогресса.",
      "Согласуйте объём работы с командой и цели первого спринта.",
    ];
  }
  if (kind === "projects") {
    return [
      "Create the first project to organize work by initiative.",
      "Define initial milestones and owners for the new project.",
      "Add tasks with priorities and due dates once the project exists.",
    ];
  }
  return [
    "Break active projects into actionable tasks with clear owners.",
    "Set priorities and due dates on new tasks to enable progress tracking.",
    "Review project scope with the team and align on the first sprint goals.",
  ];
}

export function rebalanceAction(locale: AiLocale): string {
  return locale === "ru"
    ? "Проведите короткое планирование и перераспределите открытые задачи."
    : "Run a short planning pass to rebalance open tasks across active projects.";
}

export function updateStatusesAction(locale: AiLocale): string {
  return locale === "ru"
    ? "Обновите статусы задач после сегодняшней работы для актуальной сводки."
    : "Update task statuses after today's work to keep the workspace summary accurate.";
}

export function reviewBoardAction(locale: AiLocale): string {
  return locale === "ru"
    ? "Просмотрите доску с командой и назначьте ответственных за открытые задачи."
    : "Review the task board with the team and confirm owners for open work.";
}

export function emptyStandup(locale: AiLocale): string {
  if (locale === "ru") {
    return "Команда готова, но проектов пока нет. Сегодня можно создать первый проект и начальный бэклог. После появления задач сводка покажет работу в процессе и выполненное.";
  }
  return "The team workspace is set up but does not have projects yet. Today's focus can be creating the first project and defining the initial backlog. Once tasks exist, this summary will reflect in-progress and completed work.";
}
