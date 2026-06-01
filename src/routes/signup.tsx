import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/lib/api/auth";
import { setAuthToken } from "@/lib/auth/token";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — TeamFlow AI" }] }),
  component: SignUp,
});

function SignUp() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: ({ token, user }) => {
      setAuthToken(token);
      queryClient.setQueryData(["auth", "me"], user);
      toast.success("Account created successfully");
      void router.navigate({ to: "/app/dashboard" });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not create account. Please try again.",
      );
    },
  });

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
          const name = `${firstName.trim()} ${lastName.trim()}`.trim();
          if (name.length < 2) {
            toast.error("Please enter your first and last name.");
            return;
          }
          registerMutation.mutate({
            name,
            email: email.trim(),
            password,
          });
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
            <Input
              id="first"
              placeholder="Alex"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last">Last name</Label>
            <Input
              id="last"
              placeholder="Morgan"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws">Workspace name</Label>
          <Input id="ws" placeholder="Acme Studio" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <Button
          type="submit"
          className="w-full bg-gradient-brand text-white shadow-glow hover:opacity-95"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? "Creating workspace…" : "Create workspace"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}
