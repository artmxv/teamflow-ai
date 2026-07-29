import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — TeamFlow AI" }] }),
  component: Forgot,
});

function Forgot() {
  const { t } = useI18n();

  return (
    <AuthShell
      title={t("auth.forgotTitle")}
      subtitle={t("auth.forgotSubtitle")}
      footer={
        <>
          {t("auth.forgotFooter")}{" "}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            {t("auth.backToSignIn")}
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          alert(t("auth.resetLinkSentDemo"));
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" placeholder={t("auth.emailPlaceholder")} />
        </div>
        <Button
          type="submit"
          className="w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
        >
          {t("auth.sendResetLink")}
        </Button>
      </form>
    </AuthShell>
  );
}
