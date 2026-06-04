import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import { useEffect, useRef, useState } from "react";
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
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import { removeAvatar, updateProfile, uploadAvatar } from "@/lib/api/auth";
import { AUTH_ME_QUERY_KEY, patchAuthMeUser } from "@/lib/auth/auth-cache";
import {
  formatLocation,
  formatPhone,
  LOCATION_COUNTRY_OPTIONS,
  locationCountryLabel,
  parseLocation,
  parsePhone,
  PHONE_COUNTRY_OPTIONS,
  phoneCountryLabel,
  phoneCountryTriggerLabel,
  LOCATION_UNSET,
  type LocationFormCountry,
  type PhoneCountryId,
} from "@/lib/profile-contact";
import { UserAvatar } from "@/components/app/UserAvatar";
import { fetchBillingSummary, type BillingPlanId } from "@/lib/api/billing";
import { updateWorkspace } from "@/lib/api/workspace";
import { canEditWorkspaceSettings, useCurrentUser } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

const SETTINGS_TABS = ["workspace", "profile", "notifications", "billing"] as const;

const SETTINGS_PLAN_LABEL_KEYS: Record<BillingPlanId, TKey> = {
  FREE: "billing.plan.free",
  TEAM: "billing.plan.team",
  BUSINESS: "billing.plan.business",
  ENTERPRISE: "billing.plan.enterprise",
};
type SettingsTab = (typeof SETTINGS_TABS)[number];

type SettingsSearch = {
  tab?: SettingsTab;
};

const WORKSPACE_SLUG_PATTERN = /^[a-z0-9-]+$/;

const AVATAR_ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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
  bio: string;
  phoneCountryId: PhoneCountryId;
  phoneLocal: string;
  position: string;
  locationCountry: LocationFormCountry;
  locationOther: string;
};

function profileFormFromUser(user: {
  name: string;
  displayName?: string | null;
  bio?: string | null;
  phone?: string | null;
  position?: string | null;
  location?: string | null;
}): ProfileFormState {
  const phone = parsePhone(user.phone ?? "");
  const location = parseLocation(user.location ?? "");
  return {
    name: user.name,
    displayName: user.displayName ?? firstNameFromFullName(user.name),
    bio: user.bio ?? "",
    phoneCountryId: phone.countryId,
    phoneLocal: phone.local,
    position: user.position ?? "",
    locationCountry: location.country,
    locationOther: location.other,
  };
}

function isProfileFormDirty(
  form: ProfileFormState | null,
  baseline: ProfileFormState | null,
): boolean {
  if (!form || !baseline) {
    return false;
  }
  return (
    form.name.trim() !== baseline.name.trim() ||
    form.displayName.trim() !== baseline.displayName.trim() ||
    form.bio.trim() !== baseline.bio.trim() ||
    form.phoneCountryId !== baseline.phoneCountryId ||
    form.phoneLocal.trim() !== baseline.phoneLocal.trim() ||
    form.position.trim() !== baseline.position.trim() ||
    form.locationCountry !== baseline.locationCountry ||
    form.locationOther.trim() !== baseline.locationOther.trim()
  );
}

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

  const billingQuery = useQuery({
    queryKey: ["billing", "summary"],
    queryFn: fetchBillingSummary,
    enabled: activeTab === "billing",
  });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [profileBaseline, setProfileBaseline] = useState<ProfileFormState | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState | null>(null);
  const [workspaceBaseline, setWorkspaceBaseline] = useState<WorkspaceFormState | null>(null);

  useEffect(() => {
    if (!user) {
      setProfileForm(null);
      setProfileBaseline(null);
      return;
    }
    const saved = profileFormFromUser(user);
    setProfileForm(saved);
    setProfileBaseline(saved);
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
    onSuccess: async (updatedUser) => {
      const saved = profileFormFromUser(updatedUser);
      setProfileForm(saved);
      setProfileBaseline(saved);
      patchAuthMeUser(queryClient, updatedUser);
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      toast.success(t("settings.profileUpdated"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("settings.profileSaveError"));
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async (updatedUser) => {
      patchAuthMeUser(queryClient, updatedUser);
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      toast.success(t("settings.avatarUpdated"));
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t("settings.avatarUploadError");
      if (message.includes("JPG") || message.includes("PNG") || message.includes("WEBP")) {
        toast.error(t("settings.imageTypeError"));
        return;
      }
      if (message.toLowerCase().includes("large")) {
        toast.error(t("settings.imageTooLarge"));
        return;
      }
      toast.error(message);
    },
    onSettled: () => {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    },
  });

  const avatarRemoveMutation = useMutation({
    mutationFn: removeAvatar,
    onSuccess: async (updatedUser) => {
      patchAuthMeUser(queryClient, updatedUser);
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      toast.success(t("settings.avatarRemoved"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("settings.avatarRemoveError"));
    },
  });

  const avatarBusy = avatarUploadMutation.isPending || avatarRemoveMutation.isPending;

  const workspaceMutation = useMutation({
    mutationFn: updateWorkspace,
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
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
    if (!profileForm || !user) {
      return;
    }
    profileMutation.mutate({
      name: profileForm.name.trim(),
      displayName: profileForm.displayName.trim(),
      timezone: user.timezone ?? "",
      bio: profileForm.bio.trim(),
      phone: formatPhone(profileForm.phoneCountryId, profileForm.phoneLocal),
      position: profileForm.position.trim(),
      location: formatLocation(profileForm.locationCountry, profileForm.locationOther),
    });
  };

  const handleProfileReset = () => {
    if (!profileBaseline) {
      return;
    }
    setProfileForm({ ...profileBaseline });
  };

  const profileHasUnsavedChanges = isProfileFormDirty(profileForm, profileBaseline);

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!AVATAR_ACCEPTED_TYPES.has(file.type)) {
      toast.error(t("settings.imageTypeError"));
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t("settings.imageTooLarge"));
      event.target.value = "";
      return;
    }

    avatarUploadMutation.mutate(file);
  };

  const handleRemoveAvatar = () => {
    avatarRemoveMutation.mutate();
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
                <Skeleton className="size-16 rounded-full" />
              ) : user ? (
                <UserAvatar
                  id={user.id}
                  name={user.name}
                  avatar={user.avatar}
                  avatarUrl={user.avatarUrl}
                  size="xl"
                  className="rounded-2xl"
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={avatarBusy || isPending}
                  onChange={handleAvatarFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={avatarBusy || isPending}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarUploadMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("settings.uploadingAvatar")}
                    </>
                  ) : user?.avatarUrl ? (
                    t("settings.changeAvatar")
                  ) : (
                    t("settings.uploadAvatar")
                  )}
                </Button>
                {user?.avatarUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={avatarBusy || isPending}
                    onClick={handleRemoveAvatar}
                  >
                    {avatarRemoveMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("settings.removingAvatar")}
                      </>
                    ) : (
                      t("settings.removeAvatar")
                    )}
                  </Button>
                ) : null}
                <p className="w-full text-xs text-muted-foreground">
                  {t("settings.avatarUploadHelper")}
                </p>
              </div>
            </div>
            <div className="mt-5 max-w-3xl">
              <div className="grid gap-4 sm:grid-cols-2">
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
                <ProfilePhoneFields
                  phoneCountryId={profileForm?.phoneCountryId ?? "RU"}
                  phoneLocal={profileForm?.phoneLocal ?? ""}
                  disabled={profileMutation.isPending}
                  onChange={(phoneCountryId, phoneLocal) =>
                    setProfileForm((current) =>
                      current ? { ...current, phoneCountryId, phoneLocal } : current,
                    )
                  }
                />
                <Field label={t("settings.position")}>
                  <Input
                    value={profileForm?.position ?? ""}
                    onChange={(event) =>
                      setProfileForm((current) =>
                        current ? { ...current, position: event.target.value } : current,
                      )
                    }
                    disabled={profileMutation.isPending}
                  />
                </Field>
                <ProfileLocationField
                  country={profileForm?.locationCountry ?? LOCATION_UNSET}
                  other={profileForm?.locationOther ?? ""}
                  disabled={profileMutation.isPending}
                  onChange={(locationCountry, locationOther) =>
                    setProfileForm((current) =>
                      current ? { ...current, locationCountry, locationOther } : current,
                    )
                  }
                />
                <div className="sm:col-span-2">
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
                      className="max-h-32 min-h-22 resize-y"
                    />
                  </Field>
                </div>
              </div>
              <SaveBar
                isSaving={profileMutation.isPending}
                onSave={handleProfileSave}
                onCancel={handleProfileReset}
                saveDisabled={!profileForm || !profileHasUnsavedChanges}
                cancelDisabled={!profileHasUnsavedChanges}
                cancelLabel={t("settings.resetChanges")}
              />
            </div>
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
            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/8 to-card p-5 shadow-soft">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t("billing.currentPlan")}
              </div>
              {billingQuery.isLoading ? (
                <Skeleton className="mt-2 h-8 w-48" />
              ) : billingQuery.data ? (
                <>
                  <div className="mt-1 text-xl font-semibold">
                    {t(SETTINGS_PLAN_LABEL_KEYS[billingQuery.data.currentPlan])}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{t("billing.activeMembers")}</span>
                      <span className="font-medium tabular-nums">
                        {billingQuery.data.usage.members}
                        {billingQuery.data.limits.maxMembers !== null
                          ? ` / ${billingQuery.data.limits.maxMembers}`
                          : ` · ${t("billing.unlimited")}`}
                      </span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{t("billing.workspacesUsed")}</span>
                      <span className="font-medium tabular-nums">
                        {billingQuery.data.usage.workspaces} /{" "}
                        {billingQuery.data.limits.maxWorkspaces === null
                          ? t("billing.unlimited")
                          : billingQuery.data.limits.maxWorkspaces}
                      </span>
                    </li>
                  </ul>
                </>
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">{t("board.errorTitle")}</div>
              )}
              <p className="mt-4 text-xs text-muted-foreground">{t("billing.paymentsLaterNote")}</p>
              <Button variant="brand" className="mt-4" asChild>
                <Link to="/app/billing">{t("billing.manageBilling")}</Link>
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
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

function ProfilePhoneFields({
  phoneCountryId,
  phoneLocal,
  disabled,
  onChange,
}: {
  phoneCountryId: PhoneCountryId;
  phoneLocal: string;
  disabled?: boolean;
  onChange: (countryId: PhoneCountryId, local: string) => void;
}) {
  const { t, lang } = useI18n();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="profile-phone-local">{t("settings.phoneNumber")}</Label>
      <div className="flex gap-2">
        <Select
          value={phoneCountryId}
          onValueChange={(value) => onChange(value as PhoneCountryId, phoneLocal)}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-10 w-22 shrink-0 justify-center gap-1 px-2 [&>span]:line-clamp-1"
            aria-label={t("settings.countryCode")}
          >
            <SelectValue>{phoneCountryTriggerLabel(phoneCountryId, lang as Lang)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PHONE_COUNTRY_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {phoneCountryLabel(option.id, lang as Lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id="profile-phone-local"
          value={phoneLocal}
          onChange={(event) => onChange(phoneCountryId, event.target.value)}
          disabled={disabled}
          type="tel"
          autoComplete="tel-national"
          className="min-w-0 flex-1"
          placeholder={phoneCountryId === "OTHER" ? "+48 123456789" : "123456789"}
        />
      </div>
    </div>
  );
}

function ProfileLocationField({
  country,
  other,
  disabled,
  onChange,
}: {
  country: LocationFormCountry;
  other: string;
  disabled?: boolean;
  onChange: (country: LocationFormCountry, other: string) => void;
}) {
  const { t, lang } = useI18n();

  return (
    <Field label={t("settings.country")}>
      <Select
        value={country}
        onValueChange={(value) => onChange(value as LocationFormCountry, other)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={t("settings.country")}>
            {country !== LOCATION_UNSET ? locationCountryLabel(country, lang as Lang) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={LOCATION_UNSET}>—</SelectItem>
          {LOCATION_COUNTRY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {locationCountryLabel(option.value, lang as Lang)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {country === "OTHER" ? (
        <Input
          className="mt-2"
          value={other}
          onChange={(event) => onChange(country, event.target.value)}
          disabled={disabled}
          placeholder={t("settings.other")}
        />
      ) : null}
    </Field>
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
      <Button variant="brand" onClick={onSave} disabled={isSaving || saveDisabled}>
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
