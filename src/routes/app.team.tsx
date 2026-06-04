import { useState } from "react";
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
import { members, type Member, type Role } from "@/lib/mock-data";
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
import { mockTeamRoleLabel, useI18n } from "@/lib/i18n";
import type { WorkspaceRole } from "@/lib/api/auth";
import {
  createWorkspaceInvitation,
  fetchWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from "@/lib/api/workspace-invitations";
import { Info as InfoIcon, Plus, MoreHorizontal, Copy } from "lucide-react";

export const Route = createFileRoute("/app/team")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Team — TeamFlow AI" }] }),
  component: TeamPage,
});

const roleStyles: Record<Role, string> = {
  Owner: "bg-primary/15 text-primary",
  Admin: "bg-info/15 text-info",
  Member: "bg-secondary text-secondary-foreground",
};
const statusStyles = {
  active: "bg-success/15 text-success",
  offline: "bg-muted text-muted-foreground",
  invited: "bg-warning/20 text-warning-foreground",
} as const;

type InviteRole = Extract<WorkspaceRole, "ADMIN" | "MEMBER">;

function TeamPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: workspace } = useCurrentWorkspace();
  const workspaceName = workspace?.name ?? "your workspace";
  const canInvite = canManageWorkspaceTeam(me?.workspace?.role);
  const currentUserEmail = me?.user.email.toLowerCase() ?? "";

  const isCurrentMember = (member: Member) => member.email.toLowerCase() === currentUserEmail;

  const canManageMember = (member: Member) => {
    if (!canInvite) {
      return false;
    }
    if (member.role === "Owner") {
      return false;
    }
    if (isCurrentMember(member) && me?.workspace?.role === "OWNER") {
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
    enabled: canInvite,
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

  const [profileMember, setProfileMember] = useState<Member | null>(null);
  const [roleMember, setRoleMember] = useState<Member | null>(null);
  const [roleSelection, setRoleSelection] = useState<Role>("Member");
  const [removeMember, setRemoveMember] = useState<Member | null>(null);

  const openRoleDialog = (member: Member) => {
    setRoleMember(member);
    setRoleSelection(member.role);
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
    const name = roleMember.name;
    const role = roleMember.role;
    const selected = roleSelection;
    setRoleMember(null);
    toast.info(t("team.toast.role"), {
      description: t("team.toast.roleDesc")
        .replace("{name}", name)
        .replace("{role}", mockTeamRoleLabel(role, t))
        .replace("{selected}", mockTeamRoleLabel(selected, t)),
    });
  };

  const handleConfirmRemove = () => {
    if (!removeMember) return;
    const name = removeMember.name;
    setRemoveMember(null);
    toast.info(t("team.toast.remove"), {
      description: t("team.toast.removeDesc").replace("{name}", name),
    });
  };

  const pendingInvitations = invitationsQuery.data ?? [];

  return (
    <AppShell title={t("team.team")}>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t("team.previewTitle")}</h1>
            <Badge
              variant="outline"
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {t("common.sampleData")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("team.previewSubtitle")
              .replace("{count}", String(members.length))
              .replace("{workspace}", workspaceName)}
          </p>
        </div>
        {canInvite && (
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

      <Alert className="mb-6 border-primary/25 bg-primary/5">
        <InfoIcon className="size-4 text-primary" />
        <AlertTitle>{t("team.previewTitle")}</AlertTitle>
        <AlertDescription>{t("team.previewNote")}</AlertDescription>
      </Alert>

      {canInvite && pendingInvitations.length > 0 && (
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
              <th className="px-5 py-3 text-left">{t("team.status")}</th>
              <th className="px-5 py-3 text-left">{t("team.joined")}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.id} className="transition hover:bg-muted/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar id={m.id} initials={m.avatar} />
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge variant="secondary" className={roleStyles[m.role] + " border-0"}>
                    {mockTeamRoleLabel(m.role, t)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge
                    variant="secondary"
                    className={statusStyles[m.status] + " border-0 capitalize"}
                  >
                    {m.status}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{m.joinedAt}</td>
                <td className="px-5 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${m.name}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setProfileMember(m)}>
                        {t("team.viewProfile")}
                      </DropdownMenuItem>
                      {canManageMember(m) && (
                        <DropdownMenuItem onClick={() => openRoleDialog(m)}>
                          {t("team.changeRole")}
                        </DropdownMenuItem>
                      )}
                      {canManageMember(m) && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemoveMember(m)}
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

      <Dialog open={profileMember != null} onOpenChange={(next) => !next && setProfileMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{profileMember?.name}</DialogTitle>
            <DialogDescription>{t("team.profileDesc")}</DialogDescription>
          </DialogHeader>
          {profileMember && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Avatar id={profileMember.id} initials={profileMember.avatar} />
                <div>
                  <div className="font-medium">{profileMember.name}</div>
                  <div className="text-xs text-muted-foreground">{profileMember.email}</div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Info label={t("team.role")} value={mockTeamRoleLabel(profileMember.role, t)} />
                <Info label={t("team.status")} value={profileMember.status} />
                <Info label={t("team.joined")} value={profileMember.joinedAt} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              onValueChange={(value) => setRoleSelection(value as Role)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Member">{mockTeamRoleLabel("Member", t)}</SelectItem>
                <SelectItem value="Admin">{mockTeamRoleLabel("Admin", t)}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("team.ownerDisabled")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleMember(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveRole} className="bg-gradient-brand text-white">
              {t("team.saveRole")}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
