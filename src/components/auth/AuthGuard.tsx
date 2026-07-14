import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { AppBootScreen } from "@/components/app/AppBootScreen";
import { getAuthToken } from "@/lib/auth/token";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

function getInitialStatus(): AuthStatus {
  // Keep SSR and the *first* client render consistent.
  // We resolve localStorage-based auth only after mount.
  return "checking";
}

/** Client-side guard: blocks protected UI until a token exists (SSR cannot read localStorage). */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>(getInitialStatus);

  useEffect(() => {
    const hasToken = !!getAuthToken();
    setStatus(hasToken ? "authenticated" : "unauthenticated");
    if (!hasToken) {
      void router.navigate({ to: "/signin", replace: true });
    }
  }, [router]);

  if (status !== "authenticated") {
    return <AppBootScreen variant="minimal" />;
  }

  return <>{children}</>;
}
