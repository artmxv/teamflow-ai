import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { KeyboardShortcutsDialog } from "@/components/app/AppTopbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { updateProfile } from "@/lib/api/auth";
import { updateWorkspace } from "@/lib/api/workspace";
import { nameToInitials, useCurrentUser } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Check, Loader2 } from "lucide-react";

function workspaceUrlFromSlug(slug: string): string {
  return `${slug}.teamflow.ai`;
}

function firstNameFromFullName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export const Route = createFileRoute("/app/settings")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Settings — TeamFlow AI" }] }),
  component: SettingsPage,
});

type ProfileFormState = {
  name: string;
  displayName: string;
  timezone: string;
  bio: string;
};

type WorkspaceFormState = {
  name: string;
  industry: string;
  teamSize: string;
};

function SettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: me, isPending } = useCurrentUser();
  const user = me?.user;
  const workspace = me?.workspace;
  const userInitials = user ? nameToInitials(user.name) : "…";
  const [seatsOpen, setSeatsOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setProfileForm({
      name: user.name,
      displayName: user.displayName ?? firstNameFromFullName(user.name),
      timezone: user.timezone ?? "",
      bio: user.bio ?? "",
    });
  }, [user]);

  useEffect(() => {
    if (!workspace) {
      setWorkspaceForm(null);
      return;
    }
    setWorkspaceForm({
      name: workspace.name,
      industry: workspace.industry ?? "",
      teamSize: workspace.teamSize ?? "",
    });
  }, [workspace]);

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Profile saved");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not save profile. Please try again.",
      );
    },
  });

  const workspaceMutation = useMutation({
    mutationFn: updateWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Workspace saved");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not save workspace. Please try again.",
      );
    },
  });

  const handleProfileSave = () => {
    if (!profileForm) {
      return;
    }
    profileMutation.mutate({
      name: profileForm.name.trim(),
      displayName: profileForm.displayName.trim(),
      timezone: profileForm.timezone.trim(),
      bio: profileForm.bio.trim(),
    });
  };

  const handleProfileCancel = () => {
    if (!user) {
      return;
    }
    setProfileForm({
      name: user.name,
      displayName: user.displayName ?? firstNameFromFullName(user.name),
      timezone: user.timezone ?? "",
      bio: user.bio ?? "",
    });
  };

  const handleWorkspaceSave = () => {
    if (!workspaceForm) {
      return;
    }
    if (!workspace) {
      toast.error("No workspace found");
      return;
    }
    workspaceMutation.mutate({
      name: workspaceForm.name.trim(),
      industry: workspaceForm.industry.trim(),
      teamSize: workspaceForm.teamSize.trim(),
    });
  };

  const handleWorkspaceCancel = () => {
    if (!workspace) {
      return;
    }
    setWorkspaceForm({
      name: workspace.name,
      industry: workspace.industry ?? "",
      teamSize: workspace.teamSize ?? "",
    });
  };

  return (
    <AppShell title={t("side.settings")}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("side.settings")}</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace, profile and billing.</p>
      </div>

      <Tabs defaultValue="workspace" className="w-full">
        <TabsList>
          <TabsTrigger value="workspace">{t("side.workspace")}</TabsTrigger>
          <TabsTrigger value="profile">{t("settings.profileSettings")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("settings.notificationSettings")}</TabsTrigger>
          <TabsTrigger value="billing">{t("side.billing")}</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-5">
          <Card title="Workspace details" description="Used across invites and emails.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workspace name">
                {isPending ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Input
                    value={workspaceForm?.name ?? ""}
                    onChange={(event) =>
                      setWorkspaceForm((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                    disabled={!workspace || workspaceMutation.isPending}
                  />
                )}
              </Field>
              <Field label="Workspace URL">
                {isPending ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Input
                    key={workspace?.slug ?? "workspace-url"}
                    value={workspace?.slug ? workspaceUrlFromSlug(workspace.slug) : ""}
                    readOnly
                    className="bg-muted/40"
                  />
                )}
              </Field>
              <Field label="Industry">
                <Input
                  value={workspaceForm?.industry ?? ""}
                  onChange={(event) =>
                    setWorkspaceForm((current) =>
                      current ? { ...current, industry: event.target.value } : current,
                    )
                  }
                  disabled={!workspace || workspaceMutation.isPending}
                  placeholder="e.g. Product / Software"
                />
              </Field>
              <Field label="Team size">
                <Input
                  value={workspaceForm?.teamSize ?? ""}
                  onChange={(event) =>
                    setWorkspaceForm((current) =>
                      current ? { ...current, teamSize: event.target.value } : current,
                    )
                  }
                  disabled={!workspace || workspaceMutation.isPending}
                  placeholder="e.g. 6 - 10"
                />
              </Field>
            </div>
            <SaveBar
              isSaving={workspaceMutation.isPending}
              onSave={handleWorkspaceSave}
              onCancel={handleWorkspaceCancel}
              saveDisabled={!workspace || !workspaceForm}
            />
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-5">
          <Card title="Your profile" description="This is how others see you in the workspace.">
            <div className="flex items-center gap-4">
              {isPending ? (
                <Skeleton className="size-16 rounded-2xl" />
              ) : (
                <div className="grid size-16 place-items-center rounded-2xl bg-gradient-brand text-lg font-semibold text-white shadow-glow">
                  {userInitials}
                </div>
              )}
              <Button variant="outline" size="sm" disabled>
                {t("common.uploadNewPhoto")}
              </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                {isPending ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Input
                    value={profileForm?.name ?? ""}
                    onChange={(event) =>
                      setProfileForm((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                    disabled={profileMutation.isPending}
                  />
                )}
              </Field>
              <Field label="Display name">
                {isPending ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Input
                    value={profileForm?.displayName ?? ""}
                    onChange={(event) =>
                      setProfileForm((current) =>
                        current ? { ...current, displayName: event.target.value } : current,
                      )
                    }
                    disabled={profileMutation.isPending}
                  />
                )}
              </Field>
              <Field label="Email">
                {isPending ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Input
                    key={user?.id ?? "user-email"}
                    value={user?.email ?? ""}
                    readOnly
                    type="email"
                    className="bg-muted/40"
                  />
                )}
              </Field>
              <Field label="Time zone">
                <Input
                  value={profileForm?.timezone ?? ""}
                  onChange={(event) =>
                    setProfileForm((current) =>
                      current ? { ...current, timezone: event.target.value } : current,
                    )
                  }
                  disabled={profileMutation.isPending}
                  placeholder="e.g. Europe/Berlin"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Bio">
                <Textarea
                  value={profileForm?.bio ?? ""}
                  onChange={(event) =>
                    setProfileForm((current) =>
                      current ? { ...current, bio: event.target.value } : current,
                    )
                  }
                  disabled={profileMutation.isPending}
                  rows={3}
                />
              </Field>
            </div>
            <SaveBar
              isSaving={profileMutation.isPending}
              onSave={handleProfileSave}
              onCancel={handleProfileCancel}
              saveDisabled={!profileForm}
            />
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <Card
            title="Notification preferences"
            description="Choose what you want to be notified about."
          >
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
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {t("billing.currentPlan")}
                </div>
                <div className="mt-1 text-xl font-semibold">Team · 6 seats</div>
                <div className="text-xs text-muted-foreground">
                  $72 / month · Renews on Jul 14, 2026
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link to="/app/billing">{t("common.changePlan")}</Link>
                </Button>
                <Button
                  onClick={() => setSeatsOpen(true)}
                  className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
                >
                  {t("common.addSeats")}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="size-4" /> Payment method
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Visa ending in 4242 · Exp 09/28
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCardOpen(true)}
                >
                  {t("common.updateCard")}
                </Button>
              </div>
              <div className="rounded-2xl border border-border p-5">
                <div className="text-sm font-semibold">What's included</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {[
                    "Unlimited projects",
                    "Advanced AI assistant",
                    "Custom workflows",
                    "SSO with Google",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="size-4 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <SeatsDialog open={seatsOpen} onOpenChange={setSeatsOpen} />
      <PaymentMethodDialog open={cardOpen} onOpenChange={setCardOpen} />
    </AppShell>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
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
function SaveBar({
  onSave,
  onCancel,
  isSaving = false,
  saveDisabled = false,
}: {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
}) {
  const { t } = useI18n();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={() => setShortcutsOpen(true)} disabled={isSaving}>
        {t("top.keyboardShortcuts")}
      </Button>
      <Button variant="outline" onClick={onCancel} disabled={isSaving || saveDisabled}>
        {t("common.cancel")}
      </Button>
      <Button
        onClick={onSave}
        disabled={isSaving || saveDisabled}
        className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
      >
        {isSaving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          t("common.saveChanges")
        )}
      </Button>
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

function SeatsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add seats</DialogTitle>
          <DialogDescription>Mock billing action. No payment is charged.</DialogDescription>
        </DialogHeader>
        <Field label="Additional seats">
          <Input type="number" min="1" defaultValue="2" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Seats added");
            }}
            className="bg-gradient-brand text-white"
          >
            Add seats
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentMethodDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update payment method</DialogTitle>
          <DialogDescription>Use mock card details for the frontend demo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Card number">
              <Input defaultValue="4242 4242 4242 4242" />
            </Field>
          </div>
          <Field label="Expiry">
            <Input defaultValue="09 / 28" />
          </Field>
          <Field label="CVC">
            <Input defaultValue="123" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Payment method updated");
            }}
            className="bg-gradient-brand text-white"
          >
            Save card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
