import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Features, FinalCta } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { PublicPageShell } from "@/components/landing/PublicPageShell";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TeamFlow AI — Project management workspace with AI Copilot" },
      {
        name: "description",
        content:
          "TeamFlow AI brings projects, tasks, team chat, workspace summaries, and a contextual AI Copilot into one focused workspace.",
      },
      {
        property: "og:title",
        content: "TeamFlow AI — Project management workspace with AI Copilot",
      },
      {
        property: "og:description",
        content:
          "Plan projects, coordinate tasks and team chat, and ask a contextual AI Copilot about the work you can access.",
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
        ? "TeamFlow AI — Проекты и AI в одном пространстве"
        : "TeamFlow AI — Projects and AI in one workspace";
  }, [lang]);

  return (
    <PublicPageShell>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <FinalCta />
      </main>
      <SiteFooter />
    </PublicPageShell>
  );
}
