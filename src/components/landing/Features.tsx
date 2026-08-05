import { Bell, Bot, KanbanSquare, ListTodo, MessageSquare, ShieldCheck } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";

export function Features() {
  const { t } = useI18n();

  const items: { icon: typeof KanbanSquare; titleKey: TKey; bodyKey: TKey }[] = [
    {
      icon: ListTodo,
      titleKey: "landing.features.projectsTitle",
      bodyKey: "landing.features.projectsBody",
    },
    {
      icon: KanbanSquare,
      titleKey: "landing.features.kanbanTitle",
      bodyKey: "landing.features.kanbanBody",
    },
    {
      icon: MessageSquare,
      titleKey: "landing.features.chatTitle",
      bodyKey: "landing.features.chatBody",
    },
    {
      icon: Bot,
      titleKey: "landing.features.briefingsTitle",
      bodyKey: "landing.features.briefingsBody",
    },
    {
      icon: ShieldCheck,
      titleKey: "landing.features.rolesTitle",
      bodyKey: "landing.features.rolesBody",
    },
    {
      icon: Bell,
      titleKey: "landing.features.notificationsTitle",
      bodyKey: "landing.features.notificationsBody",
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("landing.features.eyebrow")}
        </div>
        <h2 className="public-heading mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("landing.features.title")}
        </h2>
        <p className="public-body mt-4 text-muted-foreground">{t("landing.features.subtitle")}</p>
      </div>

      <div className="mt-12 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, titleKey, bodyKey }) => (
          <div
            key={titleKey}
            className="rounded-2xl border border-border bg-card/80 p-5 shadow-soft transition hover:border-primary/30 hover:shadow-card sm:p-6"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" aria-hidden />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight leading-[1.3]">
              {t(titleKey)}
            </h3>
            <p className="public-body mt-1.5 text-sm text-muted-foreground">{t(bodyKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
