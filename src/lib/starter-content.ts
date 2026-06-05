import type { Lang } from "@/lib/i18n";

const STARTER_TASK_TITLES: Record<string, Record<Lang, string>> = {
  "Invite your first teammate": {
    en: "Invite your first teammate",
    ru: "Пригласите первого участника",
  },
  "Create your first project": {
    en: "Create your first project",
    ru: "Создайте первый проект",
  },
  "Review the Kanban workflow": {
    en: "Review the Kanban workflow",
    ru: "Изучите канбан-процесс",
  },
  "Customize workspace settings": {
    en: "Customize workspace settings",
    ru: "Настройте рабочее пространство",
  },
};

const STARTER_PROJECT_NAMES: Record<string, Record<Lang, string>> = {
  "Getting Started": {
    en: "Getting Started",
    ru: "Первые шаги",
  },
};

const STARTER_PROJECT_DESCRIPTIONS: Record<string, Record<Lang, string>> = {
  "A starter project to help you explore TeamFlow AI.": {
    en: "A starter project to help you explore TeamFlow AI.",
    ru: "Стартовый проект, который поможет познакомиться с TeamFlow AI.",
  },
};

const STARTER_TASK_DESCRIPTIONS: Record<string, Record<Lang, string>> = {
  "Set up a project that reflects how your team plans and ships work.": {
    en: "Set up a project that reflects how your team plans and ships work.",
    ru: "Создайте проект, который отражает то, как ваша команда планирует и выполняет работу.",
  },
  "Move tasks across columns and confirm statuses update as expected.": {
    en: "Move tasks across columns and confirm statuses update as expected.",
    ru: "Перемещайте задачи между колонками и убедитесь, что статусы обновляются корректно.",
  },
  "Add a colleague so you can collaborate on tasks in this workspace.": {
    en: "Add a colleague so you can collaborate on tasks in this workspace.",
    ru: "Добавьте коллегу, чтобы работать над задачами вместе.",
  },
  "Update your workspace name and preferences to match your team.": {
    en: "Update your workspace name and preferences to match your team.",
    ru: "Обновите название пространства и настройки под вашу команду.",
  },
};

function lookupLocalized(
  table: Record<string, Record<Lang, string>>,
  value: string,
  locale: Lang,
): string {
  return table[value]?.[locale] ?? value;
}

export function displayTaskTitle(title: string, locale: Lang): string {
  return lookupLocalized(STARTER_TASK_TITLES, title, locale);
}

export function displayProjectName(name: string, locale: Lang): string {
  return lookupLocalized(STARTER_PROJECT_NAMES, name, locale);
}

export function displayProjectDescription(description: string, locale: Lang): string {
  return lookupLocalized(STARTER_PROJECT_DESCRIPTIONS, description, locale);
}

export function displayTaskDescription(description: string, locale: Lang): string {
  return lookupLocalized(STARTER_TASK_DESCRIPTIONS, description, locale);
}

/** @deprecated Use displayTaskTitle */
export const translateStarterTitle = displayTaskTitle;

/** @deprecated Use displayProjectName */
export const translateStarterProjectName = displayProjectName;
