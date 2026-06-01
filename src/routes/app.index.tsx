import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";

export const Route = createFileRoute("/app/")({
  beforeLoad: () => {
    requireAuth();
    throw redirect({ to: "/app/dashboard" });
  },
});
