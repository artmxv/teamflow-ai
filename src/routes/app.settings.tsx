import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import {
  displayWorkspaceName,
  isPersonalWorkspaceName,
  resolveWorkspaceNameForSave,
  workspaceSettingsDisplayName,
} from "@/lib/workspace-display";
import { removeAvatar, updateProfile, uploadAvatar } from "@/lib/api/auth";
import { assertBrowserOnline, friendlyApiErrorMessage, isBrowserOffline } from "@/lib/api-error";
import { AUTH_ME_QUERY_KEY, patchAuthMeUser } from "@/lib/auth/auth-cache";
import { invalidateWorkspaceScopedQueries } from "@/lib/workspace-queries";
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
import { FILTER_RESET_CLASSNAME } from "@/components/app/FilterBar";
import { UserAvatar } from "@/components/app/UserAvatar";
import {
  BILLING_SUMMARY_QUERY_KEY,
  fetchBillingSummary,
  type BillingPlanId,
  type BillingSummary,
} from "@/lib/api/billing";
import { updateWorkspace } from "@/lib/api/workspace";
import { canEditWorkspaceSettings, useCurrentUser } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2, Moon, Palette, Sun } from "lucide-react";
import { useTheme, type BrandTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = ["workspace", "profile", "appearance", "billing"] as const;

const APPEARANCE_THEMES: { id: BrandTheme; colors: [string, string, string] }[] = [
  { id: "default", colors: ["#7657ff", "#3b82f6", "#22d3ee"] },
  { id: "ocean", colors: ["#2563eb", "#06b6d4", "#67e8f9"] },
  { id: "emerald", colors: ["#059669", "#14b8a6", "#6ee7b7"] },
  { id: "sunset", colors: ["#f43f5e", "#f97316", "#fbbf24"] },
];

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

const TEAM_SIZE_REQUIRED_MEMBERS: Record<(typeof WORKSPACE_TEAM_SIZE_VALUES)[number], number> = {
  "0-5": 5,
  "6-10": 10,
  "11-20": 20,
  "21-50": 50,
  "51+": 51,
};

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

function teamSizeRecommendation(
  rawTeamSize: string,
  currentPlan: BillingPlanId | undefined,
  plans: BillingSummary["plans"] | undefined,
  t: (key: TKey) => string,
): string {
  const teamSize = normalizeTeamSizeValue(rawTeamSize);
  if (!isKnownTeamSizeValue(teamSize)) {
    return t("settings.teamSizeChooseHint");
  }

  if (!plans) {
    return t("settings.teamSizeRecommendationLoading");
  }

  const requiredMembers = TEAM_SIZE_REQUIRED_MEMBERS[teamSize];
  const recommendedPlan = plans.find(
    (plan) => plan.maxMembers === null || plan.maxMembers >= requiredMembers,
  )?.id;
  if (!recommendedPlan) {
    return t("settings.teamSizeRecommendationUnavailable");
  }

  const sizeOption = WORKSPACE_TEAM_SIZE_OPTIONS.find((option) => option.value === teamSize);
  const sizeLabel = sizeOption ? t(sizeOption.labelKey) : teamSize;
  const recommendedLabel = t(SETTINGS_PLAN_LABEL_KEYS[recommendedPlan]);
  const currentPlanIndex = currentPlan ? plans.findIndex((plan) => plan.id === currentPlan) : -1;
  const recommendedPlanIndex = plans.findIndex((plan) => plan.id === recommendedPlan);

  if (currentPlan && currentPlanIndex >= recommendedPlanIndex) {
    return t("settings.teamSizeCurrentPlanFits")
      .replace("{plan}", t(SETTINGS_PLAN_LABEL_KEYS[currentPlan]))
      .replace("{size}", sizeLabel);
  }

  return t("settings.teamSizeRecommendation")
    .replace("{size}", sizeLabel)
    .replace("{plan}", recommendedLabel);
}

function workspaceFormFromWorkspace(
  workspace: {
    name: string;
    slug: string;
    industry?: string | null;
    teamSize?: string | null;
  },
  lang: Lang,
): WorkspaceFormState {
  return {
    name: workspaceSettingsDisplayName(workspace.name, lang),
    slug: workspace.slug,
    industry: workspace.industry ?? "",
    teamSize: normalizeTeamSizeValue(workspace.teamSize ?? ""),
  };
}

function workspaceBaselineFromWorkspace(workspace: {
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

function workspaceFormDisplayName(name: string, lang: Lang): string {
  return isPersonalWorkspaceName(name) ? displayWorkspaceName(name, lang) : name.trim();
}

function isWorkspaceFormDirty(
  form: WorkspaceFormState | null,
  baseline: WorkspaceFormState | null,
  lang: Lang,
): boolean {
  if (!form || !baseline) {
    return false;
  }
  return (
    form.name.trim() !== workspaceFormDisplayName(baseline.name, lang) ||
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
  }
  return friendlyApiErrorMessage(error, t, fallback);
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
  const { t, lang } = useI18n();
  const { theme, setTheme, brandTheme, setBrandTheme } = useTheme();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { data: me, isPending } = useCurrentUser();
  const user = me?.user;
  const workspace = me?.workspace;
  const canEditWorkspace = canEditWorkspaceSettings(workspace?.role);
  const activeTab = tab ?? "workspace";

  const billingQuery = useQuery({
    queryKey: BILLING_SUMMARY_QUERY_KEY,
    queryFn: fetchBillingSummary,
    enabled: activeTab === "billing" || activeTab === "workspace",
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
    setWorkspaceForm(workspaceFormFromWorkspace(workspace, lang));
    setWorkspaceBaseline(workspaceBaselineFromWorkspace(workspace));
  }, [workspace, lang]);

  const profileMutation = useMutation({
    // Avoid RQ "paused" limbo offline; fail fast via assertBrowserOnline instead.
    networkMode: "always",
    mutationFn: async (input: Parameters<typeof updateProfile>[0]) => {
      assertBrowserOnline();
      return updateProfile(input);
    },
    onSuccess: async (updatedUser) => {
      const saved = profileFormFromUser(updatedUser);
      setProfileForm(saved);
      setProfileBaseline(saved);
      patchAuthMeUser(queryClient, updatedUser);
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      toast.success(t("settings.profileUpdated"));
    },
    onError: (error) => {
      toast.error(friendlyApiErrorMessage(error, t, "settings.profileSaveError"));
    },
  });

  const avatarUploadMutation = useMutation({
    networkMode: "always",
    mutationFn: async (file: File) => {
      assertBrowserOnline();
      return uploadAvatar(file);
    },
    onSuccess: async (updatedUser) => {
      patchAuthMeUser(queryClient, updatedUser);
      await invalidateWorkspaceScopedQueries(queryClient);
      toast.success(t("settings.avatarUpdated"));
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("JPG") || message.includes("PNG") || message.includes("WEBP")) {
        toast.error(t("settings.imageTypeError"));
        return;
      }
      if (message.toLowerCase().includes("large")) {
        toast.error(t("settings.imageTooLarge"));
        return;
      }
      toast.error(friendlyApiErrorMessage(error, t, "settings.avatarUploadError"));
    },
    onSettled: () => {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    },
  });

  const avatarRemoveMutation = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      assertBrowserOnline();
      return removeAvatar();
    },
    onSuccess: async (updatedUser) => {
      patchAuthMeUser(queryClient, updatedUser);
      await invalidateWorkspaceScopedQueries(queryClient);
      toast.success(t("settings.avatarRemoved"));
    },
    onError: (error) => {
      toast.error(friendlyApiErrorMessage(error, t, "settings.avatarRemoveError"));
    },
  });

  const avatarBusy = avatarUploadMutation.isPending || avatarRemoveMutation.isPending;

  const workspaceMutation = useMutation({
    networkMode: "always",
    mutationFn: async (input: Parameters<typeof updateWorkspace>[0]) => {
      assertBrowserOnline();
      return updateWorkspace(input);
    },
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      setWorkspaceForm(workspaceFormFromWorkspace(updated, lang));
      setWorkspaceBaseline(workspaceBaselineFromWorkspace(updated));
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
    if (isBrowserOffline()) {
      toast.error(t("common.offline"));
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

    if (isBrowserOffline()) {
      toast.error(t("common.offline"));
      event.target.value = "";
      return;
    }

    avatarUploadMutation.mutate(file);
  };

  const handleRemoveAvatar = () => {
    if (isBrowserOffline()) {
      toast.error(t("common.offline"));
      return;
    }
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
    if (isBrowserOffline()) {
      toast.error(t("common.offline"));
      return;
    }
    workspaceMutation.mutate({
      name: resolveWorkspaceNameForSave(workspace.name, workspaceForm.name, lang),
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

  const workspaceHasUnsavedChanges = isWorkspaceFormDirty(workspaceForm, workspaceBaseline, lang);
  const workspaceFieldsDisabled = !workspace || workspaceMutation.isPending || !canEditWorkspace;
  const workspaceSlugPreview = workspaceForm?.slug?.trim()
    ? workspaceUrlFromSlug(workspaceForm.slug.trim())
    : workspace?.slug
      ? workspaceUrlFromSlug(workspace.slug)
      : "";

  return (
    <AppShell>
      <PageHeader title={t("side.settings")} subtitle={t("settings.pageSubtitle")} />

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
          <TabsTrigger value="workspace" className="settings-tabs-trigger">
            {t("side.workspace")}
          </TabsTrigger>
          <TabsTrigger value="profile" className="settings-tabs-trigger">
            {t("settings.profileSettings")}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="settings-tabs-trigger">
            {t("settings.themeSettings")}
          </TabsTrigger>
          <TabsTrigger value="billing" className="settings-tabs-trigger">
            {t("side.billing")}
          </TabsTrigger>
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
                  placeholder={t("settings.industryPlaceholder")}
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
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {teamSizeRecommendation(
                    workspaceForm?.teamSize ?? "",
                    billingQuery.data?.currentPlan ?? workspace?.plan,
                    billingQuery.data?.plans,
                    t,
                  )}
                </p>
              </Field>
            </div>
            {canEditWorkspace ? (
              <SaveBar
                isSaving={workspaceMutation.isPending}
                onSave={handleWorkspaceSave}
                onCancel={handleWorkspaceCancel}
                saveDisabled={!workspace || !workspaceForm || !workspaceHasUnsavedChanges}
                cancelDisabled={!workspaceHasUnsavedChanges}
                cancelVariant="brandSoft"
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
                  className={cn(FILTER_RESET_CLASSNAME, "w-auto")}
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
                    variant="dangerSoft"
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
                cancelVariant="outline"
                cancelClassName={cn(FILTER_RESET_CLASSNAME, "w-auto")}
                cancelLabel={t("settings.resetChanges")}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-5">
          <Card title={t("settings.themeSettings")} description={t("settings.appearanceDesc")}>
            <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <div className="mb-3 text-sm font-medium">{t("settings.themeMode")}</div>
                <div className="grid grid-cols-2 gap-3">
                  {(["light", "dark"] as const).map((mode) => {
                    const Icon = mode === "light" ? Sun : Moon;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTheme(mode)}
                        className={`relative rounded-xl border p-4 text-left transition ${
                          theme === mode
                            ? "border-primary bg-primary/10 text-foreground shadow-soft"
                            : "border-border bg-background/45 text-muted-foreground hover:border-primary/45"
                        }`}
                      >
                        <Icon className="size-5" />
                        <div className="mt-3 text-sm font-medium">
                          {mode === "light"
                            ? t("settings.themeModeLight")
                            : t("settings.themeModeDark")}
                        </div>
                        {theme === mode ? (
                          <Check className="absolute right-3 top-3 size-4 text-primary" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Palette className="size-4 text-primary" />
                  {t("settings.colorAccent")}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {APPEARANCE_THEMES.map((option) => {
                    const titleKey = `settings.theme.${option.id}.title` as TKey;
                    const descKey = `settings.theme.${option.id}.desc` as TKey;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBrandTheme(option.id)}
                        className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                          brandTheme === option.id
                            ? "border-primary bg-primary/8 shadow-soft"
                            : "border-border bg-background/45 hover:border-primary/45"
                        }`}
                      >
                        <span className="flex shrink-0 -space-x-1">
                          {option.colors.map((color) => (
                            <span
                              key={color}
                              className="size-8 rounded-full border-2 border-card"
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{t(titleKey)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {t(descKey)}
                          </span>
                        </span>
                        {brandTheme === option.id ? (
                          <Check className="ml-auto size-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
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
              <p className="mt-4 text-xs text-muted-foreground">
                {billingQuery.data?.billingConfigured
                  ? billingQuery.data.canManageBilling
                    ? t("billing.yookassaReadyOwnerDesc")
                    : t("billing.readOnlyDesc")
                  : t("billing.yookassaUnavailableDesc")}
              </p>
              <Button variant="brand" className="mt-4" asChild>
                <Link to="/app/billing">{t("billing.viewPlans")}</Link>
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
  cancelVariant = "outline",
  cancelClassName,
  cancelLabel,
  saveLabel,
  savingLabel,
}: {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  cancelVariant?: "outline" | "brandSoft";
  cancelClassName?: string;
  cancelLabel?: string;
  saveLabel?: string;
  savingLabel?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <Button
        variant={cancelVariant}
        className={cancelClassName}
        onClick={onCancel}
        disabled={isSaving || cancelDisabled}
      >
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
    </div>
  );
}
