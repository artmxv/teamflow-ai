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
  reviewTasks: number;
  overdueTasks: number;
};

export function formatCount(
  _locale: AiLocale,
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
    if (metrics.totalTasks === 0) {
      const projectPart =
        metrics.activeProjects === metrics.totalProjects
          ? formatCount(locale, metrics.totalProjects, "проект", "проектов")
          : `${metrics.activeProjects} активных из ${metrics.totalProjects} проектов`;
      return `Доступно ${projectPart}, но задач пока нет. Добавьте задачи, чтобы следить за прогрессом.`;
    }
    if (metrics.overdueTasks > 0) {
      return `Сфокусируйтесь на просроченной работе: ${formatCount(locale, metrics.overdueTasks, "просроченная задача", "просроченных задач")} из ${metrics.openTasks} открытых.`;
    }
    if (metrics.urgentTasks > 0) {
      return `Сейчас важнее всего срочные пункты: ${formatCount(locale, metrics.urgentTasks, "срочная открытая задача", "срочных открытых задач")} при ${metrics.openTasks} открытых.`;
    }
    const openLabel = metrics.openTasks === 1 ? "открытая задача" : "открытых задач";
    const activeProjectsPart = formatCount(
      locale,
      metrics.activeProjects,
      "активный проект",
      "активных проектов",
    );
    return `В доступе ${activeProjectsPart} и ${metrics.openTasks} ${openLabel}; ${metrics.completedTasks} уже закрыто.`;
  }

  if (metrics.totalProjects === 0) {
    return "The workspace has no projects yet. Create a project and add tasks to start tracking delivery.";
  }
  if (metrics.totalTasks === 0) {
    const projectPart =
      metrics.activeProjects === metrics.totalProjects
        ? formatCount(locale, metrics.totalProjects, "project", "projects")
        : `${metrics.activeProjects} active of ${metrics.totalProjects} projects`;
    return `You can access ${projectPart}, but there are no tasks yet. Add tasks to monitor progress.`;
  }
  if (metrics.overdueTasks > 0) {
    return `Focus on overdue work first: ${formatCount(locale, metrics.overdueTasks, "overdue task", "overdue tasks")} out of ${metrics.openTasks} open.`;
  }
  if (metrics.urgentTasks > 0) {
    return `Urgent items need attention: ${formatCount(locale, metrics.urgentTasks, "urgent open task", "urgent open tasks")} among ${metrics.openTasks} open.`;
  }
  const openLabel = metrics.openTasks === 1 ? "open task" : "open tasks";
  const activeProjectsPart = formatCount(
    locale,
    metrics.activeProjects,
    "active project",
    "active projects",
  );
  return `You have access to ${activeProjectsPart} and ${metrics.openTasks} ${openLabel}; ${metrics.completedTasks} already done.`;
}

export function emptyWorkspaceHighlight(locale: AiLocale): string {
  return locale === "ru"
    ? "Пространство готово к первому проекту и списку задач."
    : "Workspace is ready for the first project and task backlog.";
}

export function completedHighlight(locale: AiLocale, count: number): string {
  if (locale === "ru") {
    return count === 1
      ? "1 задача выполнена в доступных проектах."
      : `${count} задач выполнено в доступных проектах.`;
  }
  return count === 1
    ? "1 task has been completed in accessible projects."
    : `${count} tasks have been completed in accessible projects.`;
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

export function urgentRisk(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    const suffix = count === 1 ? "срочная открытая задача" : "срочных открытых задач";
    return `${count} ${suffix}: ${sample}.`;
  }
  return `${count} urgent open task${count === 1 ? "" : "s"}: ${sample}.`;
}

export function staleInProgressRisk(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    const suffix = count === 1 ? "задача в работе" : "задач в работе";
    return `${count} ${suffix} без обновлений 7 дней и более: ${sample}.`;
  }
  return `${count} in-progress task${count === 1 ? "" : "s"} with no updates for 7 days or more: ${sample}.`;
}

export function unassignedRisk(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    const suffix =
      count === 1 ? "открытая задача без исполнителя" : "открытых задач без исполнителя";
    return `${count} ${suffix}: ${sample}.`;
  }
  return `${count} unassigned open task${count === 1 ? "" : "s"}: ${sample}.`;
}

export function missingDueDateRisk(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    const suffix = count === 1 ? "срочная задача без срока" : "срочных задач без срока";
    return `${count} ${suffix}: ${sample}.`;
  }
  return `${count} urgent task${count === 1 ? "" : "s"} without a due date: ${sample}.`;
}

export function overdueAction(locale: AiLocale, taskRef: string): string {
  return locale === "ru"
    ? `Закройте просроченную работу: ${taskRef}.`
    : `Resolve overdue work: ${taskRef}.`;
}

export function urgentAction(
  locale: AiLocale,
  taskKey: string,
  title: string,
  projectName: string,
): string {
  return locale === "ru"
    ? `Приоритизируйте срочную задачу ${taskKey} (${title}) в ${projectName}.`
    : `Prioritize urgent task ${taskKey} (${title}) in ${projectName}.`;
}

export function staleInProgressAction(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    return count === 1
      ? `Обновите статус или проверьте застрявшую задачу: ${sample}.`
      : `Обновите статусы застрявших задач (${count}): ${sample}.`;
  }
  return count === 1
    ? `Update status or check the stalled task: ${sample}.`
    : `Update statuses on stalled tasks (${count}): ${sample}.`;
}

export function unassignedAction(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    return count === 1
      ? `Назначьте исполнителя: ${sample}.`
      : `Назначьте исполнителей (${count} задач): ${sample}.`;
  }
  return count === 1 ? `Assign an owner: ${sample}.` : `Assign owners (${count} tasks): ${sample}.`;
}

export function missingDueDateAction(locale: AiLocale, count: number, sample: string): string {
  if (locale === "ru") {
    return count === 1
      ? `Назначьте срок для приоритетной задачи: ${sample}.`
      : `Назначьте сроки для ${count} приоритетных задач: ${sample}.`;
  }
  return count === 1
    ? `Set a due date for the priority task: ${sample}.`
    : `Set due dates for ${count} priority tasks: ${sample}.`;
}

export function reviewAction(locale: AiLocale, taskKey: string): string {
  return locale === "ru"
    ? `Завершите ревью ${taskKey} и переведите в done или обратно в in progress.`
    : `Complete review for ${taskKey} and move it to done or back to in progress.`;
}

export function supportInProgressAction(
  locale: AiLocale,
  taskKey: string,
  projectName: string,
): string {
  return locale === "ru"
    ? `Поддержите задачу в работе ${taskKey} в ${projectName}.`
    : `Support in-progress delivery on ${taskKey} in ${projectName}.`;
}

export function startReadyWorkAction(locale: AiLocale, taskKey: string, title: string): string {
  return locale === "ru"
    ? `Начните или назначьте готовую работу: ${taskKey} (${title}).`
    : `Start or assign ready work: ${taskKey} (${title}).`;
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
