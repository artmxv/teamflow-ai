import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/lib/api/auth";
import { primeAuthMeAfterAuth, resetWorkspaceValidationSession } from "@/lib/auth/auth-cache";
import { authSignUpErrorKey } from "@/lib/auth/auth-errors";
import { googleAuthErrorKey, startGoogleAuth } from "@/lib/auth/google-auth";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { getAuthToken, setAuthToken } from "@/lib/auth/token";
import { useI18n } from "@/lib/i18n";
import {
  passwordErrorKey,
  validatePassword,
  type PasswordErrorCode,
} from "@/lib/validation/password";

export type SignUpSearch = {
  redirect?: string;
  error?: string;
};

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignUpSearch => ({
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
  head: () => ({ meta: [{ title: "Create account — TeamFlow AI" }] }),
  component: SignUp,
});

function SignUp() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { redirect: redirectPath, error: googleError } = Route.useSearch();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<PasswordErrorCode | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  useEffect(() => {
    if (!googleError) {
      return;
    }
    toast.error(t(googleAuthErrorKey(googleError)));
  }, [googleError, t]);

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: async ({ token, user }) => {
      resetWorkspaceValidationSession();
      setAuthToken(token);
      await primeAuthMeAfterAuth(queryClient, user);
      toast.success(t("auth.accountCreated"));
      void router.navigate({ href: getSafeRedirectPath(redirectPath) });
    },
    onError: (error) => {
      toast.error(t(authSignUpErrorKey(error)));
    },
  });

  return (
    <AuthShell
      title={t("auth.signUpTitle")}
      subtitle={t("auth.signUpSubtitle")}
      footer={
        <>
          {t("auth.alreadyHaveAccount")}{" "}
          <Link
            to="/signin"
            search={redirectPath ? { redirect: redirectPath } : undefined}
            className="font-medium text-primary hover:underline"
          >
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const name = `${firstName.trim()} ${lastName.trim()}`.trim();
          if (name.length < 2) {
            toast.error(t("auth.nameRequired"));
            return;
          }

          const passwordValidationError = validatePassword(password);
          const passwordsMatch = password === confirmPassword;
          setPasswordError(passwordValidationError);
          setConfirmPasswordError(!passwordsMatch);

          if (passwordValidationError) {
            toast.error(t(passwordErrorKey(passwordValidationError)));
            return;
          }
          if (!passwordsMatch) {
            toast.error(t("auth.password.mismatch"));
            return;
          }

          registerMutation.mutate({
            name,
            email: email.trim(),
            password,
          });
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="first">{t("auth.firstName")}</Label>
            <Input
              id="first"
              placeholder={t("auth.firstNamePlaceholder")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last">{t("auth.lastName")}</Label>
            <Input
              id="last"
              placeholder={t("auth.lastNamePlaceholder")}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws">{t("auth.workspaceName")}</Label>
          <Input id="ws" placeholder={t("auth.workspaceNamePlaceholder")} />
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
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) {
                setPasswordError(validatePassword(e.target.value));
              }
            }}
            onBlur={() => setPasswordError(validatePassword(password))}
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={passwordError ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">{t("auth.password.helper")}</p>
          {passwordError && (
            <p className="text-xs text-destructive">{t(passwordErrorKey(passwordError))}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">{t("auth.confirmPassword")}</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder={t("auth.confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmPasswordError && e.target.value === password) {
                setConfirmPasswordError(false);
              }
            }}
            onBlur={() => {
              setConfirmPasswordError(confirmPassword !== password);
            }}
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={confirmPasswordError ? true : undefined}
          />
          {confirmPasswordError && (
            <p className="text-xs text-destructive">{t("auth.password.mismatch")}</p>
          )}
        </div>
        <Button
          type="submit"
          className="w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? t("auth.creatingWorkspace") : t("auth.createWorkspace")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("auth.termsAgree")}</p>
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
