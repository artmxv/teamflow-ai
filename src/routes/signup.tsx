import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — TeamFlow AI" }] }),
  component: SignUp,
});

function SignUp() {
  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Free for up to 5 teammates. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = "/app/dashboard";
        }}
      >
        <Button type="button" variant="outline" className="w-full">Continue with Google</Button>
        <div className="relative my-2 text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-background px-2">or with email</span>
          <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="first">First name</Label>
            <Input id="first" placeholder="Alex" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last">Last name</Label>
            <Input id="last" placeholder="Morgan" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws">Workspace name</Label>
          <Input id="ws" placeholder="Acme Studio" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="At least 8 characters" />
        </div>
        <Button type="submit" className="w-full bg-gradient-brand text-white shadow-glow hover:opacity-95">
          Create workspace
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}
