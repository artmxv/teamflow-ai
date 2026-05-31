import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, Check } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — TeamFlow AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace, profile and billing.</p>
      </div>

      <Tabs defaultValue="workspace" className="w-full">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-5">
          <Card title="Workspace details" description="Used across invites and emails.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workspace name"><Input defaultValue="Acme Studio" /></Field>
              <Field label="Workspace URL"><Input defaultValue="acme.teamflow.ai" /></Field>
              <Field label="Industry"><Input defaultValue="Product / Software" /></Field>
              <Field label="Team size"><Input defaultValue="6 - 10" /></Field>
            </div>
            <SaveBar />
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-5">
          <Card title="Your profile" description="This is how others see you in the workspace.">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-2xl bg-gradient-brand text-lg font-semibold text-white shadow-glow">AM</div>
              <Button variant="outline" size="sm">Upload new photo</Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><Input defaultValue="Alex Morgan" /></Field>
              <Field label="Display name"><Input defaultValue="Alex" /></Field>
              <Field label="Email"><Input defaultValue="alex@teamflow.ai" /></Field>
              <Field label="Time zone"><Input defaultValue="Europe/Berlin" /></Field>
            </div>
            <div className="mt-4">
              <Field label="Bio">
                <Textarea defaultValue="Product engineer, coffee enthusiast." />
              </Field>
            </div>
            <SaveBar />
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <Card title="Notification preferences" description="Choose what you want to be notified about.">
            <div className="divide-y divide-border">
              {[
                { l: "New comments on my tasks", d: "Email + in-app" },
                { l: "Mentions", d: "Email + in-app", on: true },
                { l: "Weekly AI digest", d: "Sent every Monday", on: true },
                { l: "Project status changes", d: "Daily summary" },
              ].map((n) => (
                <div key={n.l} className="flex items-center justify-between py-3.5">
                  <div>
                    <div className="text-sm font-medium">{n.l}</div>
                    <div className="text-xs text-muted-foreground">{n.d}</div>
                  </div>
                  <Switch defaultChecked={n.on} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-5">
          <Card
            title="Plan & billing"
            description="You're on the Team plan. Manage seats and invoices."
          >
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/8 to-card p-5 sm:flex-row sm:items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">Current plan</div>
                <div className="mt-1 text-xl font-semibold">Team · 6 seats</div>
                <div className="text-xs text-muted-foreground">$72 / month · Renews on Jul 14, 2026</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Change plan</Button>
                <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">Add seats</Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="size-4" /> Payment method
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Visa ending in 4242 · Exp 09/28</p>
                <Button variant="outline" size="sm" className="mt-3">Update card</Button>
              </div>
              <div className="rounded-2xl border border-border p-5">
                <div className="text-sm font-semibold">What's included</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {["Unlimited projects", "Advanced AI assistant", "Custom workflows", "SSO with Google"].map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="size-4 text-primary" /> {f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function SaveBar() {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button variant="outline">Cancel</Button>
      <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">Save changes</Button>
    </div>
  );
}
