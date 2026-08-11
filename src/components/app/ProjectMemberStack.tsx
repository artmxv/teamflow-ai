import { useQuery } from "@tanstack/react-query";

import { UserAvatar } from "@/components/app/UserAvatar";
import { fetchProjectMembers } from "@/lib/api/project-members";
import { cn } from "@/lib/utils";

export function ProjectMemberStack({
  projectId,
  max = 4,
  className,
}: {
  projectId: string;
  max?: number;
  className?: string;
}) {
  const { data: members = [] } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    staleTime: 60_000,
  });
  const visible = members.slice(0, max);
  const extra = members.length - visible.length;

  if (members.length === 0) return null;

  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      {visible.map((member, index) => (
        <UserAvatar
          key={member.id}
          id={member.user.id}
          name={member.user.name}
          avatar={member.user.avatar}
          avatarUrl={member.user.avatarUrl}
          size="sm"
          className={cn("border border-card", index > 0 && "-ml-2")}
        />
      ))}
      {extra > 0 ? (
        <span className="-ml-2 inline-grid size-6 shrink-0 place-items-center rounded-full border border-card bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
