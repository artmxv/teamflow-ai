import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — TeamFlow AI" }] }),
  component: Forgot,
});

function Forgot() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a secure link to set a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          alert("Reset link sent (demo).");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" />
        </div>
        <Button
          type="submit"
          className="w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
        >
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
