import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { getAuthToken } from "@/lib/auth/token";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

function getInitialStatus(): AuthStatus {
  if (typeof window === "undefined") {
    return "checking";
  }
  return getAuthToken() ? "authenticated" : "unauthenticated";
}

/** Client-side guard: blocks protected UI until a token exists (SSR cannot read localStorage). */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>(getInitialStatus);

  useEffect(() => {
    if (status === "checking") {
      setStatus(getAuthToken() ? "authenticated" : "unauthenticated");
      return;
    }
    if (status === "unauthenticated") {
      void router.navigate({ to: "/signin", replace: true });
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return null;
  }

  return <>{children}</>;
}
