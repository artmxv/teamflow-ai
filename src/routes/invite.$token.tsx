import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { acceptWorkspaceInvitation, fetchInvitationPreview } from "@/lib/api/workspace-invitations";
import { getAuthToken } from "@/lib/auth/token";
import { useCurrentUser, workspaceRoleLabel } from "@/lib/auth/use-current-user";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invitation — TeamFlow AI" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = Route.useParams();
  const hasToken = !!getAuthToken();
  const { data: me, isLoading: meLoading } = useCurrentUser();

  const previewQuery = useQuery({
    queryKey: ["invitations", "preview", token],
    queryFn: () => fetchInvitationPreview(token),
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptWorkspaceInvitation(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success(t("invite.accepted"));
      void router.navigate({ to: "/app/dashboard" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("invite.invalidOrExpired"));
    },
  });

  const preview = previewQuery.data;

  if (previewQuery.isLoading || (hasToken && meLoading)) {
    return (
      <AuthShell title={t("invite.acceptInvitation")} subtitle={t("team.sendingInvite")}>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </AuthShell>
    );
  }

  if (previewQuery.isError || !preview) {
    return (
      <AuthShell title={t("invite.acceptInvitation")} subtitle={t("invite.invalidOrExpired")}>
        <Button asChild variant="outline" className="w-full">
          <Link to="/signin">{t("nav.signin")}</Link>
        </Button>
      </AuthShell>
    );
  }

  if (!preview.canAccept || preview.isExpired) {
    return (
      <AuthShell title={t("invite.acceptInvitation")} subtitle={t("invite.invalidOrExpired")}>
        <InviteSummary preview={preview} t={t} />
      </AuthShell>
    );
  }

  const signedIn = hasToken && !!me;
  const emailMatches = preview.emailMatchesCurrentUser === true;
  const wrongEmail = signedIn && preview.emailMatchesCurrentUser === false;

  return (
    <AuthShell
      title={t("invite.acceptInvitation")}
      subtitle={t("invite.invitedToJoin").replace("{workspace}", preview.workspaceName)}
    >
      <div className="space-y-4">
        <InviteSummary preview={preview} t={t} />

        {!signedIn && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("invite.signInToAccept")}</p>
            <Button asChild className="w-full bg-gradient-brand text-white">
              <Link to="/signin">{t("nav.signin")}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/signup">{t("invite.createAccount")}</Link>
            </Button>
          </div>
        )}

        {wrongEmail && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("invite.wrongEmail").replace("{email}", preview.email)}
          </p>
        )}

        {signedIn && emailMatches && (
          <Button
            className="w-full bg-gradient-brand text-white"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
          >
            {acceptMutation.isPending ? t("team.sendingInvite") : t("invite.acceptInvitation")}
          </Button>
        )}
      </div>
    </AuthShell>
  );
}

function InviteSummary({
  preview,
  t,
}: {
  preview: {
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    expiresAt: string;
    workspaceName: string;
  };
  t: (key: import("@/lib/i18n").TKey) => string;
}) {
  const expiresLabel = new Date(preview.expiresAt).toLocaleString();

  return (
    <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
      <div>
        <div className="text-xs text-muted-foreground">{t("team.memberEmail")}</div>
        <div className="font-medium">{preview.email}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{t("team.role")}</div>
        <Badge variant="secondary" className="mt-1 border-0">
          {workspaceRoleLabel(preview.role, t)}
        </Badge>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{t("team.inviteExpires")}</div>
        <div className="font-medium">{expiresLabel}</div>
      </div>
    </div>
  );
}
