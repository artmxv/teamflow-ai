import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
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
  head: () => ({ meta: [{ title: "Sign in — TeamFlow AI" }] }),
  component: SignIn,
});

function SignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { redirect: redirectPath, error: googleError } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
            className="font-medium text-primary hover:underline"
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
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => startGoogleAuth(redirectPath)}
        >
          <GoogleIcon /> {t("auth.continueWithGoogle")}
        </Button>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
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
        <Button
          type="submit"
          className="w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.7 14.5 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12s4.2 9.3 9.3 9.3c5.4 0 8.9-3.8 8.9-9.1 0-.6-.1-1-.1-1.5H12z"
      />
    </svg>
  );
}
