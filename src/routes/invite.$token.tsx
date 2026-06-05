import { useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ApiError,
  clearActiveWorkspaceId,
  preserveWorkspaceSelectionForUser,
  setSelectedWorkspaceId,
} from "@/lib/api/client";
import { acceptWorkspaceInvitation, fetchInvitationPreview } from "@/lib/api/workspace-invitations";
import { resetWorkspaceValidationSession } from "@/lib/auth/auth-cache";
import { getAuthToken, clearAuthToken } from "@/lib/auth/token";
import { useCurrentUser, workspaceRoleLabel } from "@/lib/auth/use-current-user";
import { useI18n, type TKey } from "@/lib/i18n";
import { invalidateWorkspaceScopedQueries } from "@/lib/workspace-queries";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invitation — TeamFlow AI" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = Route.useParams();
  const returnPath = `/invite/${token}`;
  const hasToken = !!getAuthToken();
  const { data: me, isLoading: meLoading } = useCurrentUser();

  const previewQuery = useQuery({
    queryKey: ["invitations", "preview", token],
    queryFn: () => fetchInvitationPreview(token),
    retry: false,
  });

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    if (previewQuery.isError) {
      const error = previewQuery.error;
      console.warn("[invite] preview failed", {
        token,
        status: error instanceof ApiError ? error.status : undefined,
        code: error instanceof ApiError ? error.code : undefined,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }, [previewQuery.isError, previewQuery.error, token]);

  const acceptMutation = useMutation({
    mutationFn: () => acceptWorkspaceInvitation(token),
    onSuccess: async (result) => {
      setSelectedWorkspaceId(result.workspaceId);
      await invalidateWorkspaceScopedQueries(queryClient);
      toast.success(t("invite.accepted"));
      void router.navigate({ to: "/app/dashboard" });
    },
    onError: (error) => {
      if (import.meta.env.DEV) {
        console.warn("[invite] accept failed", {
          token,
          status: error instanceof ApiError ? error.status : undefined,
          code: error instanceof ApiError ? error.code : undefined,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
      toast.error(mapInviteError(error, t, "invite.acceptFailed"));
    },
  });

  const handleSwitchAccount = () => {
    if (me?.user) {
      preserveWorkspaceSelectionForUser(me.user.id, me.user.email);
    }
    clearAuthToken();
    clearActiveWorkspaceId();
    resetWorkspaceValidationSession();
    void queryClient.removeQueries({ queryKey: ["auth"] });
    void router.navigate({ to: "/signin", search: { redirect: returnPath } });
  };

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
      <AuthShell
        title={t("invite.acceptInvitation")}
        subtitle={mapInviteError(previewQuery.error, t, "invite.noLongerAvailable")}
      >
        <Button asChild variant="outline" className="w-full">
          <Link to="/signin" search={{ redirect: returnPath }}>
            {t("nav.signin")}
          </Link>
        </Button>
      </AuthShell>
    );
  }

  if (!preview.canAccept || preview.isExpired) {
    return (
      <AuthShell title={t("invite.acceptInvitation")} subtitle={t("invite.noLongerAvailable")}>
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
              <Link to="/signin" search={{ redirect: returnPath }}>
                {t("nav.signin")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/signup" search={{ redirect: returnPath }}>
                {t("invite.createAccount")}
              </Link>
            </Button>
          </div>
        )}

        {wrongEmail && (
          <div className="space-y-2">
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {t("invite.wrongEmail")}
            </p>
            <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
              {t("invite.switchAccount")}
            </Button>
          </div>
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

const INVITE_ERROR_KEYS: Record<string, TKey> = {
  "Sign in with the email address this invitation was sent to.": "invite.wrongEmail",
  "This invitation is no longer available.": "invite.noLongerAvailable",
  "Sign in with the invited email address to accept this invitation": "invite.wrongEmail",
  "This invitation is invalid or expired": "invite.noLongerAvailable",
};

function mapInviteError(error: unknown, t: (key: TKey) => string, fallback: TKey): string {
  if (error instanceof ApiError) {
    if (error.code === "INVITATION_EMAIL_MISMATCH") {
      return t("invite.wrongEmail");
    }
    if (error.code === "INVITATION_NO_LONGER_AVAILABLE") {
      return t("invite.noLongerAvailable");
    }
    const key = INVITE_ERROR_KEYS[error.message];
    if (key) {
      return t(key);
    }
  }
  if (error instanceof Error) {
    const key = INVITE_ERROR_KEYS[error.message];
    if (key) {
      return t(key);
    }
  }
  return t(fallback);
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
