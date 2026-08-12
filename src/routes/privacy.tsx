import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "TeamFlow AI — Privacy Policy" },
      {
        name: "description",
        content: "TeamFlow AI Personal Data Processing Policy and privacy information.",
      },
    ],
  }),
  component: () => <LegalPage kind="privacy" />,
});
