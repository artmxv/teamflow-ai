import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { Pricing } from "@/components/landing/Pricing";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { PublicPageShell } from "@/components/landing/PublicPageShell";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TeamFlow AI — Team. Projects. Results." },
      {
        name: "description",
        content:
          "TeamFlow AI brings projects, tasks, deadlines, team chat, and grounded workspace briefings into one calm workspace for product teams.",
      },
      { property: "og:title", content: "TeamFlow AI — Team. Projects. Results." },
      {
        property: "og:description",
        content:
          "Plan projects, manage tasks on a Kanban board, collaborate in team chat, and review briefings grounded in your workspace data.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { lang } = useI18n();

  useEffect(() => {
    document.title =
      lang === "ru"
        ? "TeamFlow AI — Команда. Проекты. Результат."
        : "TeamFlow AI — Team. Projects. Results.";
  }, [lang]);

  return (
    <PublicPageShell>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <ProductPreview />
        <Pricing />
      </main>
      <SiteFooter />
    </PublicPageShell>
  );
}
