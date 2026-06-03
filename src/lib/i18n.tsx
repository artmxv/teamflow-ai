import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ru";

const dict = {
  en: {
    "ai.askAnything": "Ask anything about your projects, tasks, or team…",
    "ai.assistant": "AI Assistant",
    "ai.generatedChecklist": "Generated checklist",
    "ai.projectContext": "Project context",
    "ai.suggestedPrompts": "Suggested prompts",
    "ai.weeklyDigest": "Weekly digest",
    "ai.regenerate": "Regenerate",
    "ai.regenerating": "Refreshing…",
    "ai.summaryRefreshed": "Workspace summary refreshed from your latest data",
    "billing.addSeats": "Add seats",
    "billing.billingHistory": "Billing history",
    "billing.changePlan": "Change plan",
    "billing.currentPlan": "Current plan",
    "billing.updateCard": "Update card",
    "billing.usage": "Usage",
    "board.addNewCard": "Add new card",
    "board.backlog": "Backlog",
    "board.done": "Done",
    "board.inProgress": "In Progress",
    "board.review": "Review",
    "board.todo": "Todo",
    "common.addSeats": "Add seats",
    "common.cancel": "Cancel",
    "common.changePlan": "Change plan",
    "common.clearFilters": "Clear filters",
    "common.createProject": "Create project",
    "common.createTask": "Create task",
    "common.newProject": "New project",
    "common.newTask": "New task",
    "common.saveChanges": "Save changes",
    "common.seeAll": "See all",
    "common.updateCard": "Update card",
    "common.uploadNewPhoto": "Upload new photo",
    "common.viewAll": "View all",
    "dashboard.activeProjects": "Active projects",
    "dashboard.aiInsights": "AI insights",
    "dashboard.completed": "Completed",
    "dashboard.goodMorning": "Good morning, Alex",
    "dashboard.openTasks": "Open tasks",
    "dashboard.projectProgress": "Project progress",
    "dashboard.recentActivity": "Recent activity",
    "dashboard.taskStatus": "Task status",
    "dashboard.teamMembers": "Team members",
    "dashboard.weeklyVelocity": "Weekly velocity",
    "nav.features": "Features",
    "nav.product": "Product",
    "nav.pricing": "Pricing",
    "nav.docs": "Docs",
    "nav.signin": "Sign in",
    "nav.start": "Start free",
    "projects.active": "Active",
    "projects.all": "All",
    "projects.allProjects": "All projects",
    "projects.completed": "Completed",
    "projects.onHold": "On hold",
    "projects.planning": "Planning",
    "projects.projects": "Projects",
    "projects.searchProjects": "Search projects…",
    "settings.languageSettings": "Language settings",
    "settings.notificationSettings": "Notification settings",
    "settings.permissions": "Permissions",
    "settings.profileSettings": "Profile settings",
    "settings.securitySettings": "Security settings",
    "settings.themeSettings": "Theme settings",
    "settings.workspaceSettings": "Workspace settings",
    "settings.avatarUploadUnavailable": "Profile photo upload is not available in this demo",
    "settings.avatarUploadHelper":
      "Avatar upload needs file storage and is not wired up yet. Your initials are shown instead.",
    "side.workspace": "Workspace",
    "side.projects": "Projects",
    "side.dashboard": "Dashboard",
    "side.kanban": "Kanban Board",
    "side.tasks": "Tasks",
    "side.team": "Team",
    "side.assistant": "AI Assistant",
    "side.settings": "Settings",
    "side.billing": "Billing",
    "side.collapseSidebar": "Collapse sidebar",
    "side.expandSidebar": "Expand sidebar",
    "tasks.allPriorities": "All priorities",
    "tasks.allStatus": "All status",
    "tasks.assignee": "Assignee",
    "tasks.done": "Done",
    "tasks.due": "Due",
    "tasks.dueDate": "Due date",
    "tasks.inProgress": "In progress",
    "tasks.priority": "Priority",
    "tasks.review": "Review",
    "tasks.searchTasks": "Search tasks…",
    "tasks.status": "Status",
    "tasks.task": "Task",
    "tasks.tasks": "Tasks",
    "tasks.todo": "Todo",
    "team.inviteMember": "Invite member",
    "team.members": "Members",
    "team.permissions": "Permissions",
    "team.role": "Role",
    "team.status": "Status",
    "team.team": "Team",
    "top.help": "Help",
    "top.keyboardShortcuts": "Keyboard shortcuts",
    "top.markAllAsRead": "Mark all as read",
    "top.allMarkedAsRead": "All notifications marked as read",
    "top.notificationsEmpty": "No notifications yet",
    "top.notificationsEmptyHint": "Comments, uploads, and task updates appear here.",
    "top.notificationsUnread": "{count} unread",
    "top.notifications": "Notifications",
    "top.search": "Search tasks, projects, people…",
    "top.workspaceSwitcher": "Workspaces",
    "validation.projectDescriptionMax": "Description must be less than 300 characters",
    "validation.projectNameMin": "Project name must be at least 2 characters",
    "validation.taskDescriptionMax": "Description must be less than 500 characters",
    "validation.taskTitleMin": "Task title must be at least 2 characters",
    "footer.tagline": "The AI-native project workspace for modern product teams.",
    "footer.product": "Product",
    "footer.company": "Company",
    "footer.resources": "Resources",
    "footer.legal": "Legal",
    "footer.rights": "All rights reserved",
  },
  ru: {
    "ai.askAnything": "Спросите о проектах, задачах или команде…",
    "ai.assistant": "AI Ассистент",
    "ai.generatedChecklist": "Сгенерированный чеклист",
    "ai.projectContext": "Контекст проекта",
    "ai.suggestedPrompts": "Подсказки",
    "ai.weeklyDigest": "Еженедельный дайджест",
    "ai.regenerate": "Обновить",
    "ai.regenerating": "Обновление…",
    "ai.summaryRefreshed": "Сводка обновлена по актуальным данным рабочего пространства",
    "billing.addSeats": "Добавить места",
    "billing.billingHistory": "История оплаты",
    "billing.changePlan": "Сменить план",
    "billing.currentPlan": "Текущий план",
    "billing.updateCard": "Обновить карту",
    "billing.usage": "Использование",
    "board.addNewCard": "Добавить карточку",
    "board.backlog": "Бэклог",
    "board.done": "Готово",
    "board.inProgress": "В работе",
    "board.review": "На проверке",
    "board.todo": "К выполнению",
    "common.addSeats": "Добавить места",
    "common.cancel": "Отмена",
    "common.changePlan": "Сменить план",
    "common.clearFilters": "Сбросить фильтры",
    "common.createProject": "Создать проект",
    "common.createTask": "Создать задачу",
    "common.newProject": "Новый проект",
    "common.newTask": "Новая задача",
    "common.saveChanges": "Сохранить изменения",
    "common.seeAll": "Смотреть все",
    "common.updateCard": "Обновить карту",
    "common.uploadNewPhoto": "Загрузить новое фото",
    "common.viewAll": "Показать все",
    "dashboard.activeProjects": "Активные проекты",
    "dashboard.aiInsights": "AI-инсайты",
    "dashboard.completed": "Завершено",
    "dashboard.goodMorning": "Доброе утро, Алекс",
    "dashboard.openTasks": "Открытые задачи",
    "dashboard.projectProgress": "Прогресс проектов",
    "dashboard.recentActivity": "Недавняя активность",
    "dashboard.taskStatus": "Статус задач",
    "dashboard.teamMembers": "Участники команды",
    "dashboard.weeklyVelocity": "Недельная скорость",
    "nav.features": "Возможности",
    "nav.product": "Продукт",
    "nav.pricing": "Цены",
    "nav.docs": "Документация",
    "nav.signin": "Войти",
    "nav.start": "Начать бесплатно",
    "projects.active": "Активные",
    "projects.all": "Все",
    "projects.allProjects": "Все проекты",
    "projects.completed": "Завершённые",
    "projects.onHold": "На паузе",
    "projects.planning": "Планирование",
    "projects.projects": "Проекты",
    "projects.searchProjects": "Поиск проектов…",
    "settings.languageSettings": "Настройки языка",
    "settings.notificationSettings": "Настройки уведомлений",
    "settings.permissions": "Права доступа",
    "settings.profileSettings": "Настройки профиля",
    "settings.securitySettings": "Настройки безопасности",
    "settings.themeSettings": "Настройки темы",
    "settings.workspaceSettings": "Настройки пространства",
    "settings.avatarUploadUnavailable": "Загрузка фото профиля недоступна в этой демо-версии",
    "settings.avatarUploadHelper":
      "Для аватара нужно хранилище файлов — пока показываются инициалы.",
    "side.workspace": "Рабочее пространство",
    "side.projects": "Проекты",
    "side.dashboard": "Обзор",
    "side.kanban": "Канбан-доска",
    "side.tasks": "Задачи",
    "side.team": "Команда",
    "side.assistant": "AI Ассистент",
    "side.settings": "Настройки",
    "side.billing": "Оплата",
    "side.collapseSidebar": "Свернуть боковую панель",
    "side.expandSidebar": "Развернуть боковую панель",
    "tasks.allPriorities": "Все приоритеты",
    "tasks.allStatus": "Все статусы",
    "tasks.assignee": "Исполнитель",
    "tasks.done": "Готово",
    "tasks.due": "Срок",
    "tasks.dueDate": "Срок",
    "tasks.inProgress": "В работе",
    "tasks.priority": "Приоритет",
    "tasks.review": "Проверка",
    "tasks.searchTasks": "Поиск задач…",
    "tasks.status": "Статус",
    "tasks.task": "Задача",
    "tasks.tasks": "Задачи",
    "tasks.todo": "К выполнению",
    "team.inviteMember": "Пригласить участника",
    "team.members": "Участники",
    "team.permissions": "Права доступа",
    "team.role": "Роль",
    "team.status": "Статус",
    "team.team": "Команда",
    "top.help": "Помощь",
    "top.keyboardShortcuts": "Горячие клавиши",
    "top.markAllAsRead": "Отметить всё прочитанным",
    "top.allMarkedAsRead": "Все уведомления отмечены прочитанными",
    "top.notificationsEmpty": "Пока нет уведомлений",
    "top.notificationsEmptyHint": "Здесь появятся комментарии, загрузки и изменения задач.",
    "top.notificationsUnread": "{count} непрочитанных",
    "top.notifications": "Уведомления",
    "top.search": "Поиск задач, проектов, людей…",
    "top.workspaceSwitcher": "Рабочие пространства",
    "validation.projectDescriptionMax": "Описание должно быть короче 300 символов",
    "validation.projectNameMin": "Название проекта должно быть минимум 2 символа",
    "validation.taskDescriptionMax": "Описание должно быть короче 500 символов",
    "validation.taskTitleMin": "Название задачи должно быть минимум 2 символа",
    "footer.tagline": "AI-рабочее пространство для современных продуктовых команд.",
    "footer.product": "Продукт",
    "footer.company": "Компания",
    "footer.resources": "Ресурсы",
    "footer.legal": "Правовая информация",
    "footer.rights": "Все права защищены",
  },
} as const;

export type TKey = keyof (typeof dict)["en"];

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("tf_lang") as Lang | null;
    if (stored === "en" || stored === "ru") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("tf_lang", l);
  };

  const t = (k: TKey) => dict[lang][k] ?? dict.en[k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div
      className={
        "inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-[11px] font-semibold " +
        className
      }
    >
      {(["en", "ru"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={
            "rounded-md px-2 py-1 uppercase transition " +
            (lang === l
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}
