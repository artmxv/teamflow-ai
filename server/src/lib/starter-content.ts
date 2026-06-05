import type { AiLocale } from "../services/ai-copy.js";

const STARTER_TASK_TITLES: Record<string, Record<AiLocale, string>> = {
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

const STARTER_PROJECT_NAMES: Record<string, Record<AiLocale, string>> = {
  "Getting Started": {
    en: "Getting Started",
    ru: "Первые шаги",
  },
};

function lookupLocalized(
  table: Record<string, Record<AiLocale, string>>,
  value: string,
  locale: AiLocale,
): string {
  return table[value]?.[locale] ?? value;
}

export function displayTaskTitle(title: string, locale: AiLocale): string {
  return lookupLocalized(STARTER_TASK_TITLES, title, locale);
}

export function displayProjectName(name: string, locale: AiLocale): string {
  return lookupLocalized(STARTER_PROJECT_NAMES, name, locale);
}
