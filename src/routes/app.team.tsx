import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import {
  canManageWorkspaceTeam,
  useCurrentUser,
  useCurrentWorkspace,
  workspaceRoleLabel,
} from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { ApiErrorState } from "@/components/app/ApiErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { MemberProfileDrawer } from "@/components/app/MemberProfileDrawer";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import { displayWorkspaceName } from "@/lib/workspace-display";
import { formatJoinedDate } from "@/lib/profile-contact";
import type { WorkspaceRole } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { friendlyApiErrorMessage } from "@/lib/api-error";
import {
  createWorkspaceInvitation,
  fetchWorkspaceInvitations,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  type WorkspaceInvitationItem,
} from "@/lib/api/workspace-invitations";
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMemberItem,
} from "@/lib/api/workspace-members";
import { Info as InfoIcon, Plus, MoreHorizontal, Copy, Mail } from "lucide-react";

export type TeamSearch = {
  memberId?: string;
};

export const Route = createFileRoute("/app/team")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): TeamSearch => ({
    memberId:
      typeof search.memberId === "string" && search.memberId.length > 0
        ? search.memberId
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Team — TeamFlow AI" }] }),
  component: TeamPage,
});

const roleStyles: Record<WorkspaceRole, string> = {
  OWNER: "bg-primary/15 text-primary",
  ADMIN: "bg-info/15 text-info",
  MEMBER: "bg-secondary text-secondary-foreground",
};

type InviteRole = Extract<WorkspaceRole, "ADMIN" | "MEMBER">;
type ManageableRole = InviteRole;

const TEAM_ERROR_KEYS: Record<string, TKey> = {
  "Only workspace owners can manage members": "team.error.onlyOwners",
  "You cannot change your own role": "team.error.cannotChangeOwnRole",
  "You cannot remove yourself": "team.error.cannotRemoveSelf",
  "Cannot remove the last owner": "team.error.cannotRemoveLastOwner",
  "Cannot demote the last owner": "team.error.cannotDemoteLastOwner",
  "Owner role cannot be assigned here": "team.error.ownerRoleNotAssignable",
  "Member limit reached for the current plan": "billing.memberLimitReached",
};

function isMemberLimitInviteError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.code === "MEMBER_LIMIT_REACHED") {
      return true;
    }
    const lower = error.message.toLowerCase();
    return lower.includes("member limit");
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    return lower.includes("member limit");
  }
  return false;
}

function formatInviteError(error: unknown, t: (k: TKey) => string): string {
  if (error instanceof ApiError && error.code === "INVITATION_RESEND_TOO_SOON") {
    return t("team.error.resendTooSoon");
  }
  if (isMemberLimitInviteError(error)) {
    return t("billing.memberLimitReached");
  }
  return formatTeamError(error, "team.toast.inviteFailed", t);
}

function formatTeamError(error: unknown, fallback: TKey, t: (k: TKey) => string): string {
  if (error instanceof Error) {
    const key = TEAM_ERROR_KEYS[error.message];
    if (key) {
      return t(key);
    }
  }
  return friendlyApiErrorMessage(error, t, fallback);
}

function TeamPage() {
  const { t, lang } = useI18n();
  const { memberId: memberIdFromUrl } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(() => !!memberIdFromUrl);

  useEffect(() => {
    if (memberIdFromUrl) {
      setMemberDrawerOpen(true);
    }
  }, [memberIdFromUrl]);

  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: workspace } = useCurrentWorkspace();
  const workspaceName = workspace?.name
    ? displayWorkspaceName(workspace.name, lang)
    : t("team.workspaceFallback");
  const canManageTeam = canManageWorkspaceTeam(me?.workspace?.role);
  const currentUserId = me?.user.id ?? "";

  const membersQuery = useQuery({
    queryKey: ["workspace-members"],
    queryFn: fetchWorkspaceMembers,
  });

  const members = membersQuery.data ?? [];

  const isCurrentMember = (member: WorkspaceMemberItem) => member.id === currentUserId;

  const canManageMember = (member: WorkspaceMemberItem) => {
    if (!canManageTeam) {
      return false;
    }
    if (member.role === "OWNER") {
      return false;
    }
    if (isCurrentMember(member)) {
      return false;
    }
    return true;
  };

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("MEMBER");
  const [revokeInvite, setRevokeInvite] = useState<WorkspaceInvitationItem | null>(null);

  const invitationsQuery = useQuery({
    queryKey: ["workspace", "invitations"],
    queryFn: fetchWorkspaceInvitations,
    enabled: canManageTeam,
  });

  const createInviteMutation = useMutation({
    mutationFn: () =>
      createWorkspaceInvitation({
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", "invitations"] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("MEMBER");

      if (data.reused) {
        toast.warning(t("team.invitationReused"));
        return;
      }

      const emailFailed = data.emailSent === false || Boolean(data.emailWarning);
      if (emailFailed) {
        toast.warning(t("team.invitationEmailFailed"));
        return;
      }

      toast.success(t("team.invitationSent"));
    },
    onError: (error) => {
      toast.error(formatInviteError(error, t));
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: revokeWorkspaceInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", "invitations"] });
      setRevokeInvite(null);
      toast.success(t("team.toast.inviteRevoked"));
    },
    onError: (error) => {
      toast.error(formatTeamError(error, "team.error.revokeFailed", t));
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: resendWorkspaceInvitation,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", "invitations"] });
      const emailFailed = data.emailSent === false || Boolean(data.emailWarning);
      if (emailFailed) {
        toast.warning(t("team.invitationResendEmailFailed"), {
          description: data.acceptUrl,
        });
      } else {
        toast.success(t("team.invitationResent"), {
          description: data.acceptUrl,
        });
      }
    },
    onError: (error) => {
      toast.error(formatInviteError(error, t));
    },
  });

  const [roleMember, setRoleMember] = useState<WorkspaceMemberItem | null>(null);
  const [roleSelection, setRoleSelection] = useState<ManageableRole>("MEMBER");
  const [removeMember, setRemoveMember] = useState<WorkspaceMemberItem | null>(null);

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ManageableRole }) =>
      updateWorkspaceMemberRole(memberId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      setRoleMember(null);
      toast.success(t("team.toast.roleUpdated"));
    },
    onError: (error) => {
      toast.error(formatTeamError(error, "team.error.updateFailed", t));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeWorkspaceMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      setRemoveMember(null);
      toast.success(t("team.toast.memberRemoved"));
    },
    onError: (error) => {
      toast.error(formatTeamError(error, "team.error.removeFailed", t));
    },
  });

  const openRoleDialog = (member: WorkspaceMemberItem) => {
    setRoleMember(member);
    setRoleSelection(member.role === "ADMIN" ? "ADMIN" : "MEMBER");
  };

  const handleSendInvite = () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast.error(t("team.toast.inviteEmpty"));
      return;
    }
    createInviteMutation.mutate();
  };

  const handleCopyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("team.invitationLinkCopied"));
    } catch {
      toast.error(t("team.toast.inviteFailed"));
    }
  };

  const handleSaveRole = () => {
    if (!roleMember) return;
    updateRoleMutation.mutate({
      memberId: roleMember.id,
      role: roleSelection,
    });
  };

  const handleConfirmRemove = () => {
    if (!removeMember) return;
    removeMemberMutation.mutate(removeMember.id);
  };

  const handleConfirmRevoke = () => {
    if (!revokeInvite) return;
    revokeInviteMutation.mutate(revokeInvite.id);
  };

  const pendingInvitations = invitationsQuery.data ?? [];
  const isRevokingInvite = (inviteId: string) =>
    revokeInviteMutation.isPending && revokeInviteMutation.variables === inviteId;

  function updateUrlSearch(patch: Partial<TeamSearch>) {
    void navigate({
      search: {
        memberId: "memberId" in patch ? patch.memberId : memberIdFromUrl,
      },
      replace: true,
    });
  }

  function openMemberDrawer(memberId: string) {
    updateUrlSearch({ memberId });
  }

  function handleProfileDrawerClose() {
    setMemberDrawerOpen(false);
    if (memberIdFromUrl) {
      updateUrlSearch({ memberId: undefined });
    }
  }

  const memberActions = (member: WorkspaceMemberItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("team.memberActionsAria").replace("{name}", member.name)}
          className="rounded-md p-1 text-muted-foreground transition outline-none hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuItem onClick={() => openMemberDrawer(member.id)}>
          {t("team.viewProfile")}
        </DropdownMenuItem>
        {canManageMember(member) && (
          <DropdownMenuItem onClick={() => openRoleDialog(member)}>
            {t("team.changeRole")}
          </DropdownMenuItem>
        )}
        {canManageMember(member) && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setRemoveMember(member)}
          >
            {t("team.removeMember")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppShell>
      <PageHeader
        title={t("team.previewTitle")}
        subtitle={t("team.previewSubtitle")
          .replace("{count}", String(members.length))
          .replace("{workspace}", workspaceName)}
        actions={
          canManageTeam ? (
            <Dialog
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open);
                if (!open && !createInviteMutation.isPending) {
                  setInviteEmail("");
                  setInviteRole("MEMBER");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="size-4" /> {t("team.inviteMember")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("team.inviteTitle")}</DialogTitle>
                  <DialogDescription>{t("team.inviteDesc")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">{t("team.memberEmail")}</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder={t("team.inviteEmailPlaceholder")}
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("team.role")}</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as InviteRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">{workspaceRoleLabel("MEMBER", t)}</SelectItem>
                        <SelectItem value="ADMIN">{workspaceRoleLabel("ADMIN", t)}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleSendInvite}
                    className="bg-gradient-brand text-white"
                    disabled={createInviteMutation.isPending}
                  >
                    {createInviteMutation.isPending
                      ? t("team.sendingInvite")
                      : t("team.sendInvite")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {!canManageTeam && (
        <Alert className="mb-6 border-border bg-muted/30">
          <InfoIcon className="size-4 text-muted-foreground" />
          <AlertTitle>{t("team.roleManagementRestricted")}</AlertTitle>
          <AlertDescription>{t("team.viewOnlyNote")}</AlertDescription>
        </Alert>
      )}

      {canManageTeam && (
        <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border bg-muted/50 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">{t("team.pendingInvitations")}</h2>
          </div>
          {invitationsQuery.isLoading && <PendingInvitationsSkeleton />}
          {invitationsQuery.isError && (
            <div className="px-4 py-4 sm:px-5">
              <ApiErrorState
                compact
                className="border-0 bg-transparent shadow-none"
                title={t("team.pendingLoadErrorTitle")}
                error={invitationsQuery.error}
                onRetry={() => void invitationsQuery.refetch()}
                isRetrying={invitationsQuery.isFetching}
              />
            </div>
          )}
          {!invitationsQuery.isLoading &&
            !invitationsQuery.isError &&
            pendingInvitations.length === 0 && (
              <EmptyState
                compact
                className="border-0 bg-transparent shadow-none"
                icon={Mail}
                title={t("team.noPendingInvitationsTitle")}
                description={t("team.noPendingInvitationsHint")}
              />
            )}
          {!invitationsQuery.isLoading &&
            !invitationsQuery.isError &&
            pendingInvitations.length > 0 && (
              <ul className="divide-y divide-border">
                {pendingInvitations.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="break-all font-medium sm:truncate sm:break-normal">
                        {invite.email}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="border-0">
                          {workspaceRoleLabel(invite.role, t)}
                        </Badge>
                        <span>
                          {t("team.inviteExpires")}: {new Date(invite.expiresAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        onClick={() => void handleCopyInviteLink(invite.acceptUrl)}
                      >
                        <Copy className="size-4" /> {t("team.copyInviteLink")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        disabled={
                          resendInviteMutation.isPending &&
                          resendInviteMutation.variables === invite.id
                        }
                        onClick={() => resendInviteMutation.mutate(invite.id)}
                      >
                        {resendInviteMutation.isPending &&
                        resendInviteMutation.variables === invite.id
                          ? t("team.resendingInvite")
                          : t("team.resendInvite")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full justify-center sm:w-auto"
                        disabled={isRevokingInvite(invite.id)}
                        onClick={() => setRevokeInvite(invite)}
                      >
                        {t("team.revokeInvite")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {/* Desktop / tablet table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">{t("team.members")}</th>
                <th className="px-5 py-3 text-left">{t("team.role")}</th>
                <th className="px-5 py-3 text-left">{t("team.joined")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {membersQuery.isLoading && <MembersTableSkeleton />}
              {membersQuery.isError && (
                <tr>
                  <td colSpan={4} className="px-5 py-6">
                    <ApiErrorState
                      compact
                      className="border-0 bg-transparent shadow-none"
                      title={t("team.loadErrorTitle")}
                      error={membersQuery.error}
                      onRetry={() => void membersQuery.refetch()}
                    />
                  </td>
                </tr>
              )}
              {!membersQuery.isLoading &&
                !membersQuery.isError &&
                members.map((member) => (
                  <tr
                    key={member.id}
                    className="cursor-pointer transition hover:bg-muted/40"
                    onClick={() => openMemberDrawer(member.id)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          id={member.id}
                          name={member.name}
                          avatar={member.avatar}
                          avatarUrl={member.avatarUrl}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{member.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="secondary" className={roleStyles[member.role] + " border-0"}>
                        {workspaceRoleLabel(member.role, t)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatJoinedDate(member.joinedAt, lang as Lang) ?? "—"}
                    </td>
                    <td
                      className="px-5 py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {memberActions(member)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {membersQuery.isLoading && <MembersCardsSkeleton />}
          {membersQuery.isError && (
            <div className="px-4 py-6">
              <ApiErrorState
                compact
                className="border-0 bg-transparent shadow-none"
                title={t("team.loadErrorTitle")}
                error={membersQuery.error}
                onRetry={() => void membersQuery.refetch()}
              />
            </div>
          )}
          {!membersQuery.isLoading && !membersQuery.isError && (
            <ul className="divide-y divide-border">
              {members.map((member) => (
                <li key={member.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-md text-left transition hover:bg-muted/40 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30"
                      onClick={() => openMemberDrawer(member.id)}
                    >
                      <div className="flex items-start gap-3">
                        <UserAvatar
                          id={member.id}
                          name={member.name}
                          avatar={member.avatar}
                          avatarUrl={member.avatarUrl}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{member.name}</div>
                          <div className="break-all text-xs text-muted-foreground">
                            {member.email}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge
                              variant="secondary"
                              className={roleStyles[member.role] + " border-0"}
                            >
                              {workspaceRoleLabel(member.role, t)}
                            </Badge>
                            <span>
                              {t("team.joined")}:{" "}
                              {formatJoinedDate(member.joinedAt, lang as Lang) ?? "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="shrink-0 pt-0.5">{memberActions(member)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <MemberProfileDrawer
        memberId={memberIdFromUrl ?? null}
        open={memberDrawerOpen}
        onClose={handleProfileDrawerClose}
      />

      <Dialog open={roleMember != null} onOpenChange={(next) => !next && setRoleMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("team.changeRoleTitle")}</DialogTitle>
            <DialogDescription>
              {t("team.changeRoleDesc").replace("{name}", roleMember?.name ?? "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("team.role")}</Label>
            <Select
              value={roleSelection}
              onValueChange={(value) => setRoleSelection(value as ManageableRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">{workspaceRoleLabel("MEMBER", t)}</SelectItem>
                <SelectItem value="ADMIN">{workspaceRoleLabel("ADMIN", t)}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("team.ownerDisabled")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleMember(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveRole}
              className="bg-gradient-brand text-white"
              disabled={updateRoleMutation.isPending}
            >
              {t("team.updateRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeMember != null}
        onOpenChange={(next) => !next && setRemoveMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("team.removeDesc").replace("{name}", removeMember?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMemberMutation.isPending}
              onClick={handleConfirmRemove}
            >
              {t("team.removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={revokeInvite != null}
        onOpenChange={(next) => {
          if (!next && !revokeInviteMutation.isPending) {
            setRevokeInvite(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("team.revokeDesc").replace("{email}", revokeInvite?.email ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeInviteMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeInviteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmRevoke();
              }}
            >
              {revokeInviteMutation.isPending ? t("team.revokingInvite") : t("team.revokeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function PendingInvitationsSkeleton() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <li
          key={index}
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Skeleton className="h-8 w-full sm:w-28" />
            <Skeleton className="h-8 w-full sm:w-24" />
            <Skeleton className="h-8 w-full sm:w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MembersTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index}>
          <td className="px-5 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </td>
          <td className="px-5 py-3">
            <Skeleton className="h-5 w-16 rounded-full" />
          </td>
          <td className="px-5 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-5 py-3">
            <Skeleton className="ml-auto h-8 w-8 rounded-md" />
          </td>
        </tr>
      ))}
    </>
  );
}

function MembersCardsSkeleton() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="px-4 py-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="size-8 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}
