import { useEffect, useId, useRef, type ReactNode } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ApiError,
  clearActiveWorkspaceId,
  preserveWorkspaceSelectionForUser,
} from "@/lib/api/client";
import {
  acceptWorkspaceInvitation,
  fetchInvitationPreview,
  type InvitationPreview,
} from "@/lib/api/workspace-invitations";
import { AUTH_ME_QUERY_KEY, resetWorkspaceValidationSession } from "@/lib/auth/auth-cache";
import { getAuthToken, clearAuthToken } from "@/lib/auth/token";
import { useCurrentUser, workspaceRoleLabel } from "@/lib/auth/use-current-user";
import { useI18n, type TKey } from "@/lib/i18n";
import { activateWorkspace } from "@/lib/workspace-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invitation — TeamFlow AI" }] }),
  component: AcceptInvitePage,
});

type InviteViewState =
  | { kind: "loading" }
  | { kind: "temporary-error"; error: unknown }
  | { kind: "not-found" }
  | { kind: "expired"; preview: InvitationPreview }
  | { kind: "revoked"; preview: InvitationPreview }
  | { kind: "already-accepted"; preview: InvitationPreview }
  | { kind: "unavailable"; preview: InvitationPreview }
  | { kind: "unsigned"; preview: InvitationPreview }
  | { kind: "wrong-email"; preview: InvitationPreview }
  | { kind: "ready"; preview: InvitationPreview }
  | { kind: "accept-error"; preview: InvitationPreview; messageKey: TKey; retryable: boolean };

function AcceptInvitePage() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = Route.useParams();
  const returnPath = `/invite/${token}`;
  const hasToken = !!getAuthToken();
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const signedIn = hasToken && Boolean(me);
  const statusRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const descriptionId = useId();

  const previewQuery = useQuery({
    queryKey: ["invitations", "preview", token],
    queryFn: () => fetchInvitationPreview(token),
    retry: false,
  });

  useEffect(() => {
    document.title = `${t("invite.acceptInvitation")} — TeamFlow AI`;
  }, [t]);

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
    mutationKey: ["invitations", "accept", token],
    mutationFn: () => acceptWorkspaceInvitation(token),
    onSuccess: async (result) => {
      await activateWorkspace(queryClient, result.workspaceId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["workspace-members"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace", "invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
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

  const viewState = resolveInviteViewState({
    previewQuery,
    hasToken,
    meLoading,
    signedIn,
    acceptError: acceptMutation.error,
    acceptFailed: acceptMutation.isError && !acceptMutation.isPending,
  });

  useEffect(() => {
    const node = statusRef.current;
    if (!node) {
      return;
    }
    if (viewState.kind === "loading") {
      return;
    }
    node.focus();
  }, [viewState.kind]);

  const shell = getShellCopy(viewState, t);
  const preview = "preview" in viewState ? viewState.preview : null;
  const isAccepting = acceptMutation.isPending;

  return (
    <AuthShell
      title={shell.title}
      subtitle={shell.subtitle}
      footer={
        <Link to="/" className="font-medium text-primary hover:underline">
          TeamFlow AI
        </Link>
      }
    >
      <div
        ref={statusRef}
        tabIndex={-1}
        className="min-h-88 outline-none"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <span id={headingId} className="sr-only">
          {shell.title}
        </span>
        <span id={descriptionId} className="sr-only">
          {shell.subtitle}
        </span>

        {viewState.kind === "loading" && (
          <InviteStatus
            live
            className="text-muted-foreground"
            icon={<Loader2 className="size-5 animate-spin" aria-hidden />}
            message={t("invite.loadingPreview")}
          />
        )}

        {viewState.kind === "temporary-error" && (
          <div className="space-y-4" role="alert">
            <p className="text-sm text-destructive">{t("invite.temporaryError")}</p>
            <Button
              variant="outline"
              className="w-full"
              aria-label={t("invite.retryAria")}
              disabled={previewQuery.isFetching}
              onClick={() => void previewQuery.refetch()}
            >
              {previewQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {t("common.retry")}
            </Button>
          </div>
        )}

        {viewState.kind === "not-found" && (
          <div className="space-y-4" role="alert">
            <p className="text-sm text-destructive">{t("invite.notFound")}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/signin">{t("nav.signin")}</Link>
            </Button>
          </div>
        )}

        {(viewState.kind === "expired" ||
          viewState.kind === "revoked" ||
          viewState.kind === "already-accepted" ||
          viewState.kind === "unavailable") &&
          preview && (
            <div className="space-y-4" role="alert">
              <InviteSummary preview={preview} t={t} />
              <p className="text-sm text-muted-foreground">{shell.body}</p>
              {signedIn ? (
                <Button asChild className="w-full bg-gradient-brand text-white">
                  <Link to="/app/dashboard">{t("invite.goToDashboard")}</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/signin">{t("nav.signin")}</Link>
                </Button>
              )}
            </div>
          )}

        {viewState.kind === "unsigned" && preview && (
          <div className="space-y-4">
            <InviteSummary preview={preview} t={t} />
            <p className="text-sm text-muted-foreground">{t("invite.signInToAccept")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full min-w-0 bg-gradient-brand text-white sm:flex-1">
                <Link to="/signin" search={{ redirect: returnPath }}>
                  {t("nav.signin")}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full min-w-0 sm:flex-1">
                <Link to="/signup" search={{ redirect: returnPath }}>
                  {t("invite.createAccount")}
                </Link>
              </Button>
            </div>
          </div>
        )}

        {viewState.kind === "wrong-email" && preview && (
          <div className="space-y-4" role="alert">
            <InviteSummary preview={preview} t={t} />
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {t("invite.wrongEmailDetail").replace("{email}", preview.email)}
            </p>
            <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
              {t("invite.switchAccount")}
            </Button>
          </div>
        )}

        {(viewState.kind === "ready" || viewState.kind === "accept-error") && preview && (
          <div className="space-y-4">
            <InviteSummary preview={preview} t={t} />

            {viewState.kind === "accept-error" && (
              <div className="space-y-3" role="alert">
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {viewState.messageKey === "invite.wrongEmail"
                    ? t("invite.wrongEmailDetail").replace("{email}", preview.email)
                    : t(viewState.messageKey)}
                </p>
                {viewState.messageKey === "invite.wrongEmail" ? (
                  <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
                    {t("invite.switchAccount")}
                  </Button>
                ) : null}
                {viewState.messageKey === "invite.alreadyMember" ||
                viewState.messageKey === "invite.seatLimit" ||
                viewState.messageKey === "invite.noLongerAvailable" ? (
                  <Button asChild className="w-full bg-gradient-brand text-white">
                    <Link to="/app/dashboard">{t("invite.goToDashboard")}</Link>
                  </Button>
                ) : null}
                {viewState.retryable ? (
                  <Button
                    className="w-full bg-gradient-brand text-white"
                    aria-label={t("invite.acceptAria")}
                    disabled={isAccepting}
                    onClick={() => acceptMutation.mutate()}
                  >
                    {isAccepting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        <span>{t("invite.accepting")}</span>
                      </>
                    ) : (
                      t("common.retry")
                    )}
                  </Button>
                ) : null}
              </div>
            )}

            {viewState.kind === "ready" && (
              <>
                <Button
                  className="w-full bg-gradient-brand text-white"
                  aria-label={t("invite.acceptAria")}
                  disabled={isAccepting}
                  onClick={() => acceptMutation.mutate()}
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      <span>{t("invite.accepting")}</span>
                    </>
                  ) : (
                    t("invite.acceptInvitation")
                  )}
                </Button>
                <p className="sr-only" role="status" aria-live="polite">
                  {isAccepting ? t("invite.accepting") : ""}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function resolveInviteViewState(input: {
  previewQuery: {
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    error: unknown;
    data: InvitationPreview | undefined;
  };
  hasToken: boolean;
  meLoading: boolean;
  signedIn: boolean;
  acceptError: unknown;
  acceptFailed: boolean;
}): InviteViewState {
  if (input.previewQuery.isLoading || (input.hasToken && input.meLoading)) {
    return { kind: "loading" };
  }

  if (input.previewQuery.isError || !input.previewQuery.data) {
    if (isInvitationNotFoundError(input.previewQuery.error)) {
      return { kind: "not-found" };
    }
    return { kind: "temporary-error", error: input.previewQuery.error };
  }

  const preview = input.previewQuery.data;

  if (preview.status === "REVOKED") {
    return { kind: "revoked", preview };
  }
  if (preview.status === "ACCEPTED") {
    return { kind: "already-accepted", preview };
  }
  if (preview.status === "EXPIRED" || preview.isExpired || !preview.canAccept) {
    if (preview.status === "PENDING" && preview.isExpired) {
      return { kind: "expired", preview };
    }
    if (preview.status === "EXPIRED") {
      return { kind: "expired", preview };
    }
    return { kind: "unavailable", preview };
  }

  if (!input.signedIn) {
    return { kind: "unsigned", preview };
  }

  if (preview.emailMatchesCurrentUser === false) {
    return { kind: "wrong-email", preview };
  }

  if (input.acceptFailed) {
    const mapped = mapAcceptError(input.acceptError);
    return {
      kind: "accept-error",
      preview,
      messageKey: mapped.messageKey,
      retryable: mapped.retryable,
    };
  }

  return { kind: "ready", preview };
}

function getShellCopy(
  state: InviteViewState,
  t: (key: TKey) => string,
): { title: string; subtitle: string; body?: string } {
  const title = t("invite.acceptInvitation");

  switch (state.kind) {
    case "loading":
      return { title, subtitle: t("invite.loadingPreview") };
    case "temporary-error":
      return { title, subtitle: t("invite.temporaryError") };
    case "not-found":
      return { title, subtitle: t("invite.notFound") };
    case "expired":
      return {
        title,
        subtitle: t("invite.invitedToJoin").replace("{workspace}", state.preview.workspaceName),
        body: t("invite.expired"),
      };
    case "revoked":
      return {
        title,
        subtitle: t("invite.invitedToJoin").replace("{workspace}", state.preview.workspaceName),
        body: t("invite.revoked"),
      };
    case "already-accepted":
      return {
        title,
        subtitle: t("invite.invitedToJoin").replace("{workspace}", state.preview.workspaceName),
        body: t("invite.alreadyAccepted"),
      };
    case "unavailable":
      return {
        title,
        subtitle: t("invite.invitedToJoin").replace("{workspace}", state.preview.workspaceName),
        body: t("invite.noLongerAvailable"),
      };
    case "unsigned":
    case "wrong-email":
    case "ready":
    case "accept-error":
      return {
        title,
        subtitle: t("invite.invitedToJoin").replace("{workspace}", state.preview.workspaceName),
      };
  }
}

function isInvitationNotFoundError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    (error.code === "INVITATION_NO_LONGER_AVAILABLE" || !error.code)
  );
}

function mapAcceptError(error: unknown): { messageKey: TKey; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.code === "INVITATION_EMAIL_MISMATCH") {
      return { messageKey: "invite.wrongEmail", retryable: false };
    }
    if (error.code === "MEMBER_LIMIT_REACHED") {
      return { messageKey: "invite.seatLimit", retryable: false };
    }
    if (error.code === "INVITATION_NO_LONGER_AVAILABLE" || error.status === 404) {
      return { messageKey: "invite.noLongerAvailable", retryable: false };
    }
    if (error.status === 409 || error.message === "User is already a workspace member") {
      return { messageKey: "invite.alreadyMember", retryable: false };
    }
    if (error.status >= 500) {
      return { messageKey: "invite.temporaryError", retryable: true };
    }
  }

  if (!(error instanceof ApiError)) {
    return { messageKey: "invite.temporaryError", retryable: true };
  }

  return { messageKey: "invite.acceptFailed", retryable: true };
}

function InviteStatus({
  message,
  icon,
  live = false,
  className,
}: {
  message: string;
  icon?: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-16 items-center justify-center gap-2 text-sm", className)}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      {icon}
      <span>{message}</span>
    </div>
  );
}

function InviteSummary({ preview, t }: { preview: InvitationPreview; t: (key: TKey) => string }) {
  const expiresLabel = new Date(preview.expiresAt).toLocaleString();

  return (
    <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{t("invite.workspaceLabel")}</div>
        <div className="truncate font-medium">{preview.workspaceName}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{t("team.memberEmail")}</div>
        <div className="break-all font-medium">{preview.email}</div>
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
