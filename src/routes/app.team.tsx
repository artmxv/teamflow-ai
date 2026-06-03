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
import { mockTeamRoleLabel, useI18n } from "@/lib/i18n";
import { Info as InfoIcon, Plus, MoreHorizontal } from "lucide-react";

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
    const role = inviteRole;
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("Member");
    toast.info(t("team.toast.invite"), {
      description: email
        ? t("team.toast.inviteDesc")
            .replace("{email}", email)
            .replace("{role}", mockTeamRoleLabel(role, t))
        : t("team.toast.inviteEmpty"),
    });
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
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
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
                    <SelectItem value="Member">{mockTeamRoleLabel("Member", t)}</SelectItem>
                    <SelectItem value="Admin">{mockTeamRoleLabel("Admin", t)}</SelectItem>
                    <SelectItem value="Owner">{mockTeamRoleLabel("Owner", t)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSendInvite} className="bg-gradient-brand text-white">
                {t("team.sendInvite")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert className="mb-6 border-primary/25 bg-primary/5">
        <InfoIcon className="size-4 text-primary" />
        <AlertTitle>{t("team.previewTitle")}</AlertTitle>
        <AlertDescription>{t("team.previewNote")}</AlertDescription>
      </Alert>

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
                      <DropdownMenuItem
                        onClick={() => openRoleDialog(m)}
                        disabled={m.role === "Owner"}
                      >
                        {t("team.changeRole")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setRemoveMember(m)}
                        disabled={m.role === "Owner"}
                      >
                        {t("team.removeMember")}
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
