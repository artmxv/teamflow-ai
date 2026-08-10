import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clearActiveWorkspaceId } from "@/lib/api/client";
import { completeAuthWithToken, resetWorkspaceValidationSession } from "@/lib/auth/auth-cache";
import { googleAuthErrorKey } from "@/lib/auth/google-auth";
import {
  consumeGoogleOAuthCallbackFragment,
  type GoogleOAuthCallbackFragment,
} from "@/lib/auth/oauth-callback";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { clearAuthToken } from "@/lib/auth/token";
import { useI18n } from "@/lib/i18n";

export type AuthCallbackSearch = {
  redirect?: string;
  error?: string;
};

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): AuthCallbackSearch => ({
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

function AuthCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { redirect: searchRedirectPath, error } = Route.useSearch();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [redirectPath, setRedirectPath] = useState(searchRedirectPath);
  const fragmentRef = useRef<GoogleOAuthCallbackFragment | null>(null);

  useEffect(() => {
    if (!fragmentRef.current) {
      fragmentRef.current = consumeGoogleOAuthCallbackFragment();
    }
    const fragment = fragmentRef.current;
    const callbackRedirectPath = fragment.redirect ?? searchRedirectPath;
    const destination = getSafeRedirectPath(callbackRedirectPath);
    setRedirectPath(callbackRedirectPath);

    if (error) {
      toast.error(t(googleAuthErrorKey(error)));
      void router.navigate({
        to: "/signin",
        search: { error, redirect: callbackRedirectPath },
        replace: true,
      });
      return;
    }

    const token = fragment.token;
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
  }, [error, queryClient, router, searchRedirectPath, t]);

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
