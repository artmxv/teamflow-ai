import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { members, type Member, type Role } from "@/lib/mock-data";
import { Avatar } from "@/components/app/Avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/app/team")({
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
  const [open, setOpen] = useState(false);
  const [profileMember, setProfileMember] = useState<Member | null>(null);

  return (
    <AppShell title="Team">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team members</h1>
          <p className="text-sm text-muted-foreground">{members.length} people in Acme Studio.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-brand text-white shadow-glow hover:opacity-95">
              <Plus className="size-4" /> Invite member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a new teammate</DialogTitle>
              <DialogDescription>They'll get an email to join your workspace.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" placeholder="teammate@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select defaultValue="Member">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Member">Member</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => setOpen(false)} className="bg-gradient-brand text-white">Send invite</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Member</th>
              <th className="px-5 py-3 text-left">Role</th>
              <th className="px-5 py-3 text-left">Status</th>
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
                  <Badge variant="secondary" className={roleStyles[m.role] + " border-0"}>{m.role}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge variant="secondary" className={statusStyles[m.status] + " border-0 capitalize"}>{m.status}</Badge>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{m.joinedAt}</td>
                <td className="px-5 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setProfileMember(m)}>View profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`Role change opened for ${m.name}`)}>
                        Change role
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info(`${m.name} was not removed in this mock demo`)}>
                        Remove member
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
            <DialogDescription>{profileMember?.email}</DialogDescription>
          </DialogHeader>
          {profileMember && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Avatar id={profileMember.id} initials={profileMember.avatar} />
                <div>
                  <div className="font-medium">{profileMember.name}</div>
                  <div className="text-xs text-muted-foreground">{profileMember.role}</div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Info label="Status" value={profileMember.status} />
                <Info label="Joined" value={profileMember.joinedAt} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
