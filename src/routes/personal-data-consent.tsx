import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/personal-data-consent")({
  head: () => ({
    meta: [
      { title: "TeamFlow AI — Personal Data Consent" },
      {
        name: "description",
        content: "Consent to personal data processing for TeamFlow AI users.",
      },
    ],
  }),
  component: () => <LegalPage kind="consent" />,
});
