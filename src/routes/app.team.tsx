import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth/route-guards";
import { useCurrentWorkspace } from "@/lib/auth/use-current-user";
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
import { useI18n } from "@/lib/i18n";
import { Info as InfoIcon, Plus, MoreHorizontal } from "lucide-react";

const DEMO_TEAM_NOTE =
  "Team management is a portfolio demo preview. The member list below is sample data. Invitations, role changes, and removals are not sent to a server and do not affect real accounts.";

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

function TeamPage() {
  const { t } = useI18n();
  const { data: workspace } = useCurrentWorkspace();
  const workspaceName = workspace?.name ?? "your workspace";

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Member");

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
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("Member");
    toast.info("Demo only: no invitation was sent.", {
      description: email
        ? `Preview invite for ${email} (${inviteRole}) was not delivered.`
        : "Enter an email to preview the invite flow.",
    });
  };

  const handleSaveRole = () => {
    if (!roleMember) return;
    const name = roleMember.name;
    setRoleMember(null);
    toast.info("Demo only: role was not changed.", {
      description: `Preview: ${name} would stay ${roleMember.role} in this sample roster (selected ${roleSelection}).`,
    });
  };

  const handleConfirmRemove = () => {
    if (!removeMember) return;
    const name = removeMember.name;
    setRemoveMember(null);
    toast.info("Demo only: member was not removed.", {
      description: `${name} remains in the sample roster for this preview.`,
    });
  };

  return (
    <AppShell title={t("team.team")}>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t("team.members")}</h1>
            <Badge
              variant="outline"
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Sample data
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {members.length} people in {workspaceName}. Roster shown for UI preview only.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
              <Plus className="size-4" /> {t("team.inviteMember")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a new teammate</DialogTitle>
              <DialogDescription>
                Preview the invite form for this demo workspace. No email is sent and no account is
                created.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("team.role")}</Label>
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Member">Member</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSendInvite} className="bg-gradient-brand text-white">
                Send invite (demo)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert className="mb-6 border-primary/25 bg-primary/5">
        <InfoIcon className="size-4 text-primary" />
        <AlertTitle>Demo team preview</AlertTitle>
        <AlertDescription>{DEMO_TEAM_NOTE}</AlertDescription>
      </Alert>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">{t("team.members")}</th>
              <th className="px-5 py-3 text-left">{t("team.role")}</th>
              <th className="px-5 py-3 text-left">{t("team.status")}</th>
              <th className="px-5 py-3 text-left">Joined</th>
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
                    {m.role}
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
                        View profile (demo)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openRoleDialog(m)}
                        disabled={m.role === "Owner"}
                      >
                        Change role (demo)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setRemoveMember(m)}
                        disabled={m.role === "Owner"}
                      >
                        Remove member (demo)
                      </DropdownMenuItem>
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
            <DialogDescription>
              Sample member profile for this demo workspace. Details are not loaded from your
              account directory.
            </DialogDescription>
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
                <Info label={t("team.role")} value={profileMember.role} />
                <Info label={t("team.status")} value={profileMember.status} />
                <Info label="Joined" value={profileMember.joinedAt} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={roleMember != null} onOpenChange={(next) => !next && setRoleMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role (demo)</DialogTitle>
            <DialogDescription>
              Preview how role updates would look. Nothing is saved for{" "}
              {roleMember?.name ?? "this member"}.
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
                <SelectItem value="Member">Member</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Owner transfers are disabled in this portfolio preview.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleMember(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveRole} className="bg-gradient-brand text-white">
              Save role (demo)
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
            <AlertDialogTitle>Remove member (demo)</AlertDialogTitle>
            <AlertDialogDescription>
              This confirms the remove flow for {removeMember?.name ?? "this member"}. They will
              stay in the sample roster; no API call is made.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmRemove}
            >
              Remove (demo)
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
