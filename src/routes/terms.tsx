import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "TeamFlow AI — Terms of Use" },
      {
        name: "description",
        content: "Terms governing access to and use of TeamFlow AI.",
      },
    ],
  }),
  component: () => <LegalPage kind="terms" />,
});
