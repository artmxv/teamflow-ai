import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clearActiveWorkspaceId } from "@/lib/api/client";
import { completeAuthWithToken, resetWorkspaceValidationSession } from "@/lib/auth/auth-cache";
import { googleAuthErrorKey } from "@/lib/auth/google-auth";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { clearAuthToken } from "@/lib/auth/token";
import { useI18n } from "@/lib/i18n";

export type AuthCallbackSearch = {
  token?: string;
  redirect?: string;
  error?: string;
};

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): AuthCallbackSearch => ({
    token: typeof search.token === "string" && search.token.length > 0 ? search.token : undefined,
    redirect:
      typeof search.redirect === "string" && search.redirect.length > 0
        ? search.redirect
        : undefined,
    error: typeof search.error === "string" && search.error.length > 0 ? search.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Signing in — TeamFlow AI" }] }),
  component: AuthCallbackPage,
});

type CallbackStatus = "loading" | "missing_token" | "error";

function readTokenFromLocation(routeToken: string | undefined): string | undefined {
  if (routeToken) {
    return routeToken;
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = new URLSearchParams(window.location.search).get("token");
  return raw && raw.length > 0 ? raw : undefined;
}

function AuthCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { token: routeToken, redirect: redirectPath, error } = Route.useSearch();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const destination = getSafeRedirectPath(redirectPath);

  useEffect(() => {
    if (error) {
      toast.error(t(googleAuthErrorKey(error)));
      void router.navigate({
        to: "/signin",
        search: { error, redirect: redirectPath },
        replace: true,
      });
      return;
    }

    const token = readTokenFromLocation(routeToken);
    if (!token) {
      setStatus("missing_token");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await completeAuthWithToken(queryClient, token);
        if (cancelled) {
          return;
        }

        toast.success(t("auth.signedInWithGoogle"));
        void router.navigate({ href: destination, replace: true });
      } catch {
        if (cancelled) {
          return;
        }

        clearAuthToken();
        clearActiveWorkspaceId();
        resetWorkspaceValidationSession();
        void queryClient.removeQueries({ queryKey: ["auth"] });
        setStatus("error");
        toast.error(t("auth.googleSignInFailed"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destination, error, queryClient, redirectPath, routeToken, router, t]);

  if (status === "missing_token" || status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">{t("auth.googleSignInFailed")}</p>
          <Link
            to="/signin"
            search={redirectPath ? { redirect: redirectPath } : undefined}
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            {t("nav.signin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">{t("auth.completingSignIn")}</p>
    </div>
  );
}
