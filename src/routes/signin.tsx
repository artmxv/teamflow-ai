import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/auth";
import { primeAuthMeAfterAuth, resetWorkspaceValidationSession } from "@/lib/auth/auth-cache";
import { authSignInErrorKey } from "@/lib/auth/auth-errors";
import { googleAuthErrorKey, startGoogleAuth } from "@/lib/auth/google-auth";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { getAuthToken, setAuthToken } from "@/lib/auth/token";
import { useI18n } from "@/lib/i18n";

export type SignInSearch = {
  redirect?: string;
  error?: string;
};

export const Route = createFileRoute("/signin")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.length > 0
        ? search.redirect
        : undefined,
    error: typeof search.error === "string" && search.error.length > 0 ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (typeof window === "undefined") {
      return;
    }
    if (getAuthToken()) {
      throw redirect({ href: getSafeRedirectPath(search.redirect) });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — TeamFlow AI" },
      {
        name: "description",
        content:
          "Sign in to TeamFlow AI to manage projects, tasks, team chat, and workspace briefings.",
      },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, lang } = useI18n();
  const { redirect: redirectPath, error: googleError } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    document.title = `${t("auth.signIn")} — TeamFlow AI`;
  }, [lang, t]);

  useEffect(() => {
    if (!googleError) {
      return;
    }
    toast.error(t(googleAuthErrorKey(googleError)));
  }, [googleError, t]);

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async ({ token, user }) => {
      resetWorkspaceValidationSession();
      setAuthToken(token);
      await primeAuthMeAfterAuth(queryClient, user);
      toast.success(t("auth.signedIn"));
      void router.navigate({ href: getSafeRedirectPath(redirectPath) });
    },
    onError: (error) => {
      toast.error(t(authSignInErrorKey(error)));
    },
  });

  return (
    <AuthShell
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInSubtitle")}
      footer={
        <>
          {t("auth.newToTeamFlow")}{" "}
          <Link
            to="/signup"
            search={redirectPath ? { redirect: redirectPath } : undefined}
            className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {t("auth.createAccount")}
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          loginMutation.mutate({ email: email.trim(), password });
        }}
      >
        <GoogleAuthButton
          label={t("auth.continueWithGoogle")}
          onClick={() => startGoogleAuth(redirectPath)}
          disabled={loginMutation.isPending}
        />
        <div className="relative my-2 text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-background px-2">{t("auth.orWithEmail")}</span>
          <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" variant="brand" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>
    </AuthShell>
  );
}
