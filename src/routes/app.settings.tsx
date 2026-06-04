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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n, type TKey } from "@/lib/i18n";
import { updateProfile } from "@/lib/api/auth";
import { updateWorkspace } from "@/lib/api/workspace";
import {
  canEditWorkspaceSettings,
  nameToInitials,
  useCurrentUser,
} from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Check, Loader2 } from "lucide-react";

const SETTINGS_TABS = ["workspace", "profile", "notifications", "billing"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

type SettingsSearch = {
  tab?: SettingsTab;
};

const WORKSPACE_SLUG_PATTERN = /^[a-z0-9-]+$/;

const WORKSPACE_TEAM_SIZE_VALUES = ["0-5", "6-10", "11-20", "21-50", "51+"] as const;

const WORKSPACE_TEAM_SIZE_OPTIONS: {
  value: (typeof WORKSPACE_TEAM_SIZE_VALUES)[number];
  labelKey: TKey;
}[] = [
  { value: "0-5", labelKey: "settings.teamSize0to5" },
  { value: "6-10", labelKey: "settings.teamSize6to10" },
  { value: "11-20", labelKey: "settings.teamSize11to20" },
  { value: "21-50", labelKey: "settings.teamSize21to50" },
  { value: "51+", labelKey: "settings.teamSize51plus" },
];

const TEAM_SIZE_SELECT_EMPTY = "__none__";

function isKnownTeamSizeValue(value: string): value is (typeof WORKSPACE_TEAM_SIZE_VALUES)[number] {
  return (WORKSPACE_TEAM_SIZE_VALUES as readonly string[]).includes(value);
}

function normalizeTeamSizeValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (isKnownTeamSizeValue(trimmed)) {
    return trimmed;
  }
  const withDash = trimmed.replace(/\s*[-–—]\s*/g, "-");
  if (isKnownTeamSizeValue(withDash)) {
    return withDash;
  }
  const compact = trimmed.replace(/\s+/g, "");
  if (isKnownTeamSizeValue(compact)) {
    return compact;
  }
  if (/^51\+?$/i.test(compact)) {
    return "51+";
  }
  return trimmed;
}

function workspaceFormFromWorkspace(workspace: {
  name: string;
  slug: string;
  industry?: string | null;
  teamSize?: string | null;
}): WorkspaceFormState {
  return {
    name: workspace.name,
    slug: workspace.slug,
    industry: workspace.industry ?? "",
    teamSize: normalizeTeamSizeValue(workspace.teamSize ?? ""),
  };
}

function isWorkspaceFormDirty(
  form: WorkspaceFormState | null,
  baseline: WorkspaceFormState | null,
): boolean {
  if (!form || !baseline) {
    return false;
  }
  return (
    form.name.trim() !== baseline.name.trim() ||
    form.slug.trim() !== baseline.slug.trim() ||
    form.industry.trim() !== baseline.industry.trim() ||
    form.teamSize.trim() !== baseline.teamSize.trim()
  );
}

const WORKSPACE_ERROR_KEYS: Record<string, TKey> = {
  "Slug is already taken": "settings.error.slugTaken",
  "Slug can only contain lowercase letters, numbers, and hyphens": "settings.error.slugInvalid",
  "Only workspace owners can edit workspace settings": "settings.error.onlyOwners",
};

function parseSettingsTab(value: unknown): SettingsTab | undefined {
  if (typeof value === "string" && (SETTINGS_TABS as readonly string[]).includes(value)) {
    return value as SettingsTab;
  }
  return undefined;
}

function formatWorkspaceError(error: unknown, fallback: TKey, t: (k: TKey) => string): string {
  if (error instanceof Error) {
    const key = WORKSPACE_ERROR_KEYS[error.message];
    if (key) {
      return t(key);
    }
    return error.message;
  }
  return t(fallback);
}

function workspaceUrlFromSlug(slug: string): string {
  return `${slug}.teamflow.ai`;
}

function firstNameFromFullName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export const Route = createFileRoute("/app/settings")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: parseSettingsTab(search.tab),
  }),
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
  slug: string;
  industry: string;
  teamSize: string;
};

function SettingsPage() {
  const { t } = useI18n();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { data: me, isPending } = useCurrentUser();
  const user = me?.user;
  const workspace = me?.workspace;
  const canEditWorkspace = canEditWorkspaceSettings(workspace?.role);
  const activeTab = tab ?? "workspace";
  const userInitials = user ? nameToInitials(user.name) : "…";
  const [seatsOpen, setSeatsOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState | null>(null);
  const [workspaceBaseline, setWorkspaceBaseline] = useState<WorkspaceFormState | null>(null);

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
      setWorkspaceBaseline(null);
      return;
    }
    const saved = workspaceFormFromWorkspace(workspace);
    setWorkspaceForm(saved);
    setWorkspaceBaseline(saved);
  }, [workspace]);

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success(t("settings.profileSaved"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("settings.profileSaveError"));
    },
  });

  const workspaceMutation = useMutation({
    mutationFn: updateWorkspace,
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      const saved = workspaceFormFromWorkspace(updated);
      setWorkspaceForm(saved);
      setWorkspaceBaseline(saved);
      toast.success(t("settings.workspaceUpdated"));
    },
    onError: (error) => {
      toast.error(formatWorkspaceError(error, "settings.workspaceSaveError", t));
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
      toast.error(t("settings.noWorkspace"));
      return;
    }
    const slug = workspaceForm.slug.trim();
    if (!WORKSPACE_SLUG_PATTERN.test(slug)) {
      toast.error(t("settings.error.slugInvalid"));
      return;
    }
    workspaceMutation.mutate({
      name: workspaceForm.name.trim(),
      slug,
      industry: workspaceForm.industry.trim(),
      teamSize: workspaceForm.teamSize.trim(),
    });
  };

  const handleWorkspaceCancel = () => {
    if (!workspaceBaseline) {
      return;
    }
    setWorkspaceForm({ ...workspaceBaseline });
  };

  const workspaceHasUnsavedChanges = isWorkspaceFormDirty(workspaceForm, workspaceBaseline);
  const workspaceFieldsDisabled = !workspace || workspaceMutation.isPending || !canEditWorkspace;
  const workspaceSlugPreview = workspaceForm?.slug?.trim()
    ? workspaceUrlFromSlug(workspaceForm.slug.trim())
    : workspace?.slug
      ? workspaceUrlFromSlug(workspace.slug)
      : "";

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("side.settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.pageSubtitle")}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          void navigate({
            to: "/app/settings",
            search: { tab: value as SettingsTab },
          });
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="workspace">{t("side.workspace")}</TabsTrigger>
          <TabsTrigger value="profile">{t("settings.profileSettings")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("settings.notificationSettings")}</TabsTrigger>
          <TabsTrigger value="billing">{t("side.billing")}</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-5">
          <Card
            title={t("settings.workspaceDetailsTitle")}
            description={t("settings.workspaceDetailsDesc")}
          >
            {!canEditWorkspace && workspace ? (
              <p className="mb-4 text-sm text-muted-foreground">{t("settings.viewOnlyRole")}</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("settings.workspaceName")}>
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
                    disabled={workspaceFieldsDisabled}
                  />
                )}
              </Field>
              <Field label={t("settings.workspaceSlug")}>
                {isPending ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Input
                    value={workspaceForm?.slug ?? ""}
                    onChange={(event) =>
                      setWorkspaceForm((current) =>
                        current ? { ...current, slug: event.target.value } : current,
                      )
                    }
                    disabled={workspaceFieldsDisabled}
                    autoComplete="off"
                    spellCheck={false}
                  />
                )}
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("settings.workspaceUrl")}>
                  {isPending ? (
                    <Skeleton className="h-10 w-full rounded-md" />
                  ) : (
                    <>
                      <Input value={workspaceSlugPreview} readOnly className="bg-muted/40" />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {t("settings.workspaceUrlPreview")} {workspaceSlugPreview || "—"}
                      </p>
                    </>
                  )}
                </Field>
              </div>
              <Field label={t("settings.industry")}>
                <Input
                  value={workspaceForm?.industry ?? ""}
                  onChange={(event) =>
                    setWorkspaceForm((current) =>
                      current ? { ...current, industry: event.target.value } : current,
                    )
                  }
                  disabled={workspaceFieldsDisabled}
                  placeholder="e.g. Product / Software"
                />
              </Field>
              <Field label={t("settings.teamSize")}>
                <WorkspaceTeamSizeSelect
                  value={workspaceForm?.teamSize ?? ""}
                  onChange={(teamSize) =>
                    setWorkspaceForm((current) => (current ? { ...current, teamSize } : current))
                  }
                  disabled={workspaceFieldsDisabled}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{t("settings.teamSizeHint")}</p>
              </Field>
            </div>
            {canEditWorkspace ? (
              <SaveBar
                isSaving={workspaceMutation.isPending}
                onSave={handleWorkspaceSave}
                onCancel={handleWorkspaceCancel}
                saveDisabled={!workspace || !workspaceForm || !workspaceHasUnsavedChanges}
                cancelDisabled={!workspaceHasUnsavedChanges}
                cancelLabel={t("settings.resetChanges")}
                saveLabel={t("settings.saveWorkspace")}
                savingLabel={t("settings.savingWorkspace")}
              />
            ) : null}
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-5">
          <Card title={t("settings.yourProfileTitle")} description={t("settings.yourProfileDesc")}>
            <div className="flex items-center gap-4">
              {isPending ? (
                <Skeleton className="size-16 rounded-2xl" />
              ) : (
                <div className="grid size-16 place-items-center rounded-2xl bg-gradient-brand text-lg font-semibold text-white shadow-glow">
                  {userInitials}
                </div>
              )}
              <div className="space-y-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => toast.message(t("settings.avatarUploadUnavailable"))}
                >
                  {t("common.uploadNewPhoto")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("settings.avatarUploadHelper")}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label={t("settings.fullName")}>
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
              <Field label={t("settings.displayName")}>
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
              <Field label={t("settings.email")}>
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
              <Field label={t("settings.timeZone")}>
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
              <Field label={t("settings.bio")}>
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
            title={t("settings.notificationSettings")}
            description={t("settings.notificationDesc")}
          >
            <div className="divide-y divide-border">
              {[
                { l: t("settings.notifyComments"), d: t("settings.notifyEmailInApp") },
                {
                  l: t("settings.notifyMentions"),
                  d: t("settings.notifyEmailInApp"),
                  on: true,
                },
                {
                  l: t("settings.notifyWeeklyDigest"),
                  d: t("settings.notifyWeeklyDigestSchedule"),
                  on: true,
                },
                {
                  l: t("settings.notifyProjectStatus"),
                  d: t("settings.notifyDailySummary"),
                },
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
          <Card title={t("settings.planBillingTitle")} description={t("settings.planBillingDesc")}>
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
                  <CreditCard className="size-4" /> {t("billing.paymentMethod")}
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
                <div className="text-sm font-semibold">{t("billing.whatsIncluded")}</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {[
                    t("billing.featureUnlimitedProjects"),
                    t("billing.featureAiStandups"),
                    t("billing.featureAdvancedRoles"),
                    t("billing.featurePrioritySupport"),
                    t("billing.featureAuditLog"),
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
function WorkspaceTeamSizeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (teamSize: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const trimmed = value.trim();
  const normalized = normalizeTeamSizeValue(trimmed);
  const selectValue = trimmed
    ? isKnownTeamSizeValue(normalized)
      ? normalized
      : trimmed
    : TEAM_SIZE_SELECT_EMPTY;
  const showLegacyOption = Boolean(trimmed && !isKnownTeamSizeValue(normalized));

  return (
    <Select
      value={selectValue}
      onValueChange={(next) => onChange(next === TEAM_SIZE_SELECT_EMPTY ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={t("settings.teamSize")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TEAM_SIZE_SELECT_EMPTY}>—</SelectItem>
        {showLegacyOption ? <SelectItem value={trimmed}>{trimmed}</SelectItem> : null}
        {WORKSPACE_TEAM_SIZE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  cancelDisabled = false,
  cancelLabel,
  saveLabel,
  savingLabel,
}: {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  cancelLabel?: string;
  saveLabel?: string;
  savingLabel?: string;
}) {
  const { t } = useI18n();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={() => setShortcutsOpen(true)} disabled={isSaving}>
        {t("top.keyboardShortcuts")}
      </Button>
      <Button variant="outline" onClick={onCancel} disabled={isSaving || cancelDisabled}>
        {cancelLabel ?? t("common.cancel")}
      </Button>
      <Button
        onClick={onSave}
        disabled={isSaving || saveDisabled}
        className="bg-gradient-brand text-white shadow-glow hover:opacity-95"
      >
        {isSaving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {savingLabel ?? t("settings.saving")}
          </>
        ) : (
          (saveLabel ?? t("common.saveChanges"))
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
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("billing.addSeats")}</DialogTitle>
          <DialogDescription>{t("settings.seatsDialogDesc")}</DialogDescription>
        </DialogHeader>
        <Field label={t("settings.additionalSeats")}>
          <Input type="number" min="1" defaultValue="2" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success(t("settings.toast.seatsAdded"));
            }}
            className="bg-gradient-brand text-white"
          >
            {t("billing.addSeats")}
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
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.updatePaymentTitle")}</DialogTitle>
          <DialogDescription>{t("settings.updatePaymentDesc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("settings.cardNumber")}>
              <Input defaultValue="4242 4242 4242 4242" />
            </Field>
          </div>
          <Field label={t("settings.cardExpiry")}>
            <Input defaultValue="09 / 28" />
          </Field>
          <Field label={t("settings.cardCvc")}>
            <Input defaultValue="123" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success(t("settings.toast.paymentMethodUpdated"));
            }}
            className="bg-gradient-brand text-white"
          >
            {t("settings.saveCard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
