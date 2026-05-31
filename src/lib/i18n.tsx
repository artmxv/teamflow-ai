import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ru";

const dict = {
  en: {
    "nav.features": "Features",
    "nav.product": "Product",
    "nav.pricing": "Pricing",
    "nav.docs": "Docs",
    "nav.signin": "Sign in",
    "nav.start": "Start free",
    "side.workspace": "Workspace",
    "side.projects": "Projects",
    "side.dashboard": "Dashboard",
    "side.kanban": "Kanban",
    "side.tasks": "Tasks",
    "side.team": "Team",
    "side.assistant": "AI Assistant",
    "side.settings": "Settings",
    "side.billing": "Billing",
    "top.search": "Search tasks, projects, people…",
    "top.help": "Help",
    "top.notifications": "Notifications",
    "footer.tagline": "The AI-native project workspace for modern product teams.",
    "footer.product": "Product",
    "footer.company": "Company",
    "footer.resources": "Resources",
    "footer.legal": "Legal",
    "footer.rights": "All rights reserved",
  },
  ru: {
    "nav.features": "Возможности",
    "nav.product": "Продукт",
    "nav.pricing": "Цены",
    "nav.docs": "Документация",
    "nav.signin": "Войти",
    "nav.start": "Начать бесплатно",
    "side.workspace": "Рабочее пространство",
    "side.projects": "Проекты",
    "side.dashboard": "Обзор",
    "side.kanban": "Канбан",
    "side.tasks": "Задачи",
    "side.team": "Команда",
    "side.assistant": "AI Ассистент",
    "side.settings": "Настройки",
    "side.billing": "Оплата",
    "top.search": "Поиск задач, проектов, людей…",
    "top.help": "Помощь",
    "top.notifications": "Уведомления",
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
