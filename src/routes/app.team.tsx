import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/lib/auth/route-guards";
import {
  canManageWorkspaceTeam,
  nameToInitials,
  useCurrentUser,
  useCurrentWorkspace,
  workspaceRoleLabel,
} from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { MemberProfileDrawer } from "@/components/app/MemberProfileDrawer";
import { Avatar } from "@/components/app/Avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useI18n, type TKey } from "@/lib/i18n";
import type { WorkspaceRole } from "@/lib/api/auth";
import {
  createWorkspaceInvitation,
  fetchWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from "@/lib/api/workspace-invitations";
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMemberItem,
} from "@/lib/api/workspace-members";
import { Info as InfoIcon, Plus, MoreHorizontal, Copy } from "lucide-react";

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
};

function formatTeamError(error: unknown, fallback: TKey, t: (k: TKey) => string): string {
  if (error instanceof Error) {
    const key = TEAM_ERROR_KEYS[error.message];
    if (key) {
      return t(key);
    }
    return error.message;
  }
  return t(fallback);
}

function TeamPage() {
  const { t } = useI18n();
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
  const workspaceName = workspace?.name ?? "your workspace";
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
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null);

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
      setLastAcceptUrl(data.acceptUrl);
      void queryClient.invalidateQueries({ queryKey: ["workspace", "invitations"] });
      toast.success(t("team.invitationSent"), {
        description: data.acceptUrl,
      });
      setInviteEmail("");
      setInviteRole("MEMBER");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("team.toast.inviteFailed"));
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: revokeWorkspaceInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace", "invitations"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("team.toast.inviteFailed"));
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

  const pendingInvitations = invitationsQuery.data ?? [];

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

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("team.previewTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("team.previewSubtitle")
              .replace("{count}", String(members.length))
              .replace("{workspace}", workspaceName)}
          </p>
        </div>
        {canManageTeam && (
          <Dialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open);
              if (!open) {
                setLastAcceptUrl(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
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
                    placeholder="teammate@company.com"
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
                {lastAcceptUrl && (
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      {t("team.invitationLink")}
                    </div>
                    <p className="break-all text-xs">{lastAcceptUrl}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => void handleCopyInviteLink(lastAcceptUrl)}
                    >
                      <Copy className="size-4" /> {t("team.copyInviteLink")}
                    </Button>
                  </div>
                )}
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
                  {createInviteMutation.isPending ? t("team.sendingInvite") : t("team.sendInvite")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canManageTeam && (
        <Alert className="mb-6 border-border bg-muted/30">
          <InfoIcon className="size-4 text-muted-foreground" />
          <AlertTitle>{t("team.roleManagementRestricted")}</AlertTitle>
          <AlertDescription>{t("team.viewOnlyNote")}</AlertDescription>
        </Alert>
      )}

      {canManageTeam && pendingInvitations.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b border-border bg-muted/50 px-5 py-3">
            <h2 className="text-sm font-semibold">{t("team.pendingInvitations")}</h2>
          </div>
          <ul className="divide-y divide-border">
            {pendingInvitations.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{invite.email}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="border-0">
                      {workspaceRoleLabel(invite.role, t)}
                    </Badge>
                    <span>
                      {t("team.inviteExpires")}: {new Date(invite.expiresAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyInviteLink(invite.acceptUrl)}
                  >
                    <Copy className="size-4" /> {t("team.copyInviteLink")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={revokeInviteMutation.isPending}
                    onClick={() => revokeInviteMutation.mutate(invite.id)}
                  >
                    {t("team.revokeInvite")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
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
            {membersQuery.isLoading && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                  …
                </td>
              </tr>
            )}
            {membersQuery.isError && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-destructive">
                  {membersQuery.error instanceof Error
                    ? membersQuery.error.message
                    : t("team.error.updateFailed")}
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
                    <div className="flex items-center gap-3">
                      <Avatar
                        id={member.id}
                        initials={member.avatar ?? nameToInitials(member.name)}
                      />
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="secondary" className={roleStyles[member.role] + " border-0"}>
                      {workspaceRoleLabel(member.role, t)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${member.name}`}
                          className="rounded-md p-1 text-muted-foreground transition outline-none hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onCloseAutoFocus={(event) => event.preventDefault()}
                      >
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
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
    </AppShell>
  );
}
