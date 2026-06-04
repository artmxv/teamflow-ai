import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  ListTodo,
  Mail,
  MapPin,
  Phone,
  ZoomIn,
} from "lucide-react";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchWorkspaceMemberProfile } from "@/lib/api/workspace-members";
import type { TaskApiPriority, TaskApiStatus } from "@/lib/api/tasks";
import type { ProjectApiStatus } from "@/lib/api/projects";
import {
  dashboardPriorityLabel,
  dashboardStatusLabel,
  projectApiStatusLabel,
  useI18n,
} from "@/lib/i18n";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { workspaceRoleLabel } from "@/lib/auth/use-current-user";
import { priorityMeta, projectStatusMeta, type ProjectStatus } from "@/lib/mock-data";
import { taskStatusChipClass } from "@/lib/task-status-theme";
import type { DashboardTaskPriority, DashboardTaskStatus } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";
import { displayLocationFromStored, formatJoinedDate } from "@/lib/profile-contact";
import type { Lang } from "@/lib/i18n";

const apiProjectStatusMap: Record<ProjectApiStatus, ProjectStatus> = {
  PLANNING: "planning",
  ACTIVE: "active",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
};

const apiTaskStatusChip: Record<TaskApiStatus, string> = {
  BACKLOG: taskStatusChipClass.backlog,
  TODO: taskStatusChipClass.todo,
  IN_PROGRESS: taskStatusChipClass.in_progress,
  REVIEW: taskStatusChipClass.review,
  DONE: taskStatusChipClass.done,
};

const apiPriorityChip: Record<TaskApiPriority, string> = {
  LOW: priorityMeta.low.className,
  MEDIUM: priorityMeta.medium.className,
  HIGH: priorityMeta.high.className,
  URGENT: priorityMeta.urgent.className,
};

const roleStyles = {
  OWNER: "bg-primary/15 text-primary",
  ADMIN: "bg-info/15 text-info",
  MEMBER: "bg-secondary text-secondary-foreground",
} as const;

function ProfileSkeleton() {
  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-3.5 w-52 max-w-full" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("mt-0.5 break-all", muted && "text-muted-foreground italic")}>
          {value}
        </div>
      </div>
    </div>
  );
}

export function MemberProfileDrawer({
  memberId,
  open,
  onClose,
}: {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ["workspace-member-profile", memberId],
    queryFn: () => fetchWorkspaceMemberProfile(memberId!),
    enabled: open && !!memberId,
    retry: 1,
  });

  const profile = profileQuery.data;
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const previewSrc = profile ? resolveAvatarUrl(profile.avatarUrl) : null;
  const joinedLabel = profile ? formatJoinedDate(profile.joinedAt, lang as Lang) : null;
  const locationLabel = profile?.contact.location
    ? displayLocationFromStored(profile.contact.location, lang as Lang)
    : "";

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose();
          }
        }}
      >
        <SheetContent side="right" className="app-scrollbar w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="space-y-1 border-b border-border pb-4">
            <SheetTitle>{t("team.memberProfileTitle")}</SheetTitle>
            <SheetDescription className="sr-only">
              {profile?.name ?? t("team.memberProfileTitle")}
            </SheetDescription>
          </SheetHeader>

          {profileQuery.isLoading && <ProfileSkeleton />}

          {profileQuery.isError && !profileQuery.isLoading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="size-8 text-destructive/80" />
              <p className="text-sm text-muted-foreground">{t("team.memberProfileLoadError")}</p>
            </div>
          )}

          {profile && !profileQuery.isLoading && (
            <div className="space-y-6 py-4">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <UserAvatar
                    id={profile.id}
                    name={profile.name}
                    avatar={profile.avatar}
                    avatarUrl={profile.avatarUrl}
                    size="lg"
                  />
                  {previewSrc ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full shadow-sm"
                      aria-label={t("settings.viewPhoto")}
                      onClick={() => setPhotoPreviewOpen(true)}
                    >
                      <ZoomIn className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-snug">{profile.name}</h2>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={cn(roleStyles[profile.role], "border-0")}>
                      {workspaceRoleLabel(profile.role, t)}
                    </Badge>
                    {joinedLabel ? (
                      <span className="text-xs text-muted-foreground">
                        {t("team.joined")}: {joinedLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("team.contactInformation")}
                </h3>
                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <ContactRow icon={Mail} label={t("team.memberEmail")} value={profile.email} />
                  <ContactRow
                    icon={Phone}
                    label={t("team.phone")}
                    value={profile.contact.phone ?? t("team.notAdded")}
                    muted={!profile.contact.phone}
                  />
                  <ContactRow
                    icon={Briefcase}
                    label={t("team.position")}
                    value={profile.contact.position ?? t("team.notAdded")}
                    muted={!profile.contact.position}
                  />
                  <ContactRow
                    icon={MapPin}
                    label={t("team.location")}
                    value={locationLabel || t("team.notAdded")}
                    muted={!locationLabel}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("team.memberProjects")}
                </h3>
                {profile.projects.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    {t("team.noProjectsYet")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {profile.projects.map((project) => {
                      const statusKey = apiProjectStatusMap[project.status];
                      const statusMeta = projectStatusMeta[statusKey];
                      return (
                        <li key={project.id}>
                          <button
                            type="button"
                            aria-label={`${t("team.openProject")}: ${project.name}`}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:bg-muted/40 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30 active:bg-muted/40"
                            onClick={() => {
                              void router.navigate({
                                to: "/app/projects/$projectId",
                                params: { projectId: project.id },
                              });
                            }}
                          >
                            <span className="min-w-0 truncate font-medium">{project.name}</span>
                            <Badge
                              variant="secondary"
                              className={cn(statusMeta.className, "shrink-0 border-0")}
                            >
                              {projectApiStatusLabel(project.status, t)}
                            </Badge>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("team.memberTasks")}
                </h3>
                {profile.tasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    {t("team.noAssignedTasks")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {profile.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          aria-label={`${t("team.openTask")}: ${task.title}`}
                          className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:bg-muted/40 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30 active:bg-muted/40"
                          onClick={() => {
                            void router.navigate({
                              to: "/app/tasks",
                              search: { taskId: task.id },
                            });
                          }}
                        >
                          <p className="font-medium leading-snug">
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              {task.key}
                            </span>
                            <span className="text-muted-foreground"> · </span>
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(apiTaskStatusChip[task.status], "border-0")}
                            >
                              {dashboardStatusLabel(task.status as DashboardTaskStatus, t)}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={cn(apiPriorityChip[task.priority], "border-0")}
                            >
                              {dashboardPriorityLabel(task.priority as DashboardTaskPriority, t)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <ListTodo className="size-3.5" />
                              {task.projectName}
                            </span>
                            {task.dueDate && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="size-3.5" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={photoPreviewOpen} onOpenChange={setPhotoPreviewOpen}>
        <DialogContent
          className="max-w-lg border-0 bg-transparent p-2 shadow-none sm:max-w-xl"
          closeClassName="right-2 top-2 text-white hover:bg-white/15 focus-visible:outline-white/50"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{t("settings.viewPhoto")}</DialogTitle>
          <DialogDescription className="sr-only">{profile?.name}</DialogDescription>
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={profile?.name ?? ""}
              className="max-h-[80vh] w-full rounded-xl object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
