import { UserAvatar } from "@/components/app/UserAvatar";
import type { AssigneeOption } from "@/lib/assignee-options";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AssigneeAvatarsProps = {
  assignees: AssigneeOption[];
  maxVisible?: number;
  size?: "sm" | "md";
  className?: string;
  showUnassignedLabel?: boolean;
};

export function AssigneeAvatars({
  assignees,
  maxVisible = 3,
  size = "sm",
  className,
  showUnassignedLabel = false,
}: AssigneeAvatarsProps) {
  const { t } = useI18n();

  if (assignees.length === 0) {
    if (!showUnassignedLabel) {
      return null;
    }
    return (
      <span className={cn("text-[10px] text-muted-foreground", className)}>
        {t("tasks.noAssignees")}
      </span>
    );
  }

  const visible = assignees.slice(0, maxVisible);
  const overflow = assignees.length - visible.length;
  const title = assignees.map((assignee) => assignee.name).join(", ");

  return (
    <div className={cn("flex items-center gap-1", className)} title={title}>
      <div className="flex items-center -space-x-1.5">
        {visible.map((assignee) => (
          <span key={assignee.id} className="inline-flex rounded-full ring-2 ring-card">
            <UserAvatar
              id={assignee.id}
              name={assignee.name}
              avatar={assignee.avatar}
              avatarUrl={assignee.avatarUrl}
              size={size}
            />
          </span>
        ))}
      </div>
      {overflow > 0 ? (
        <span className="text-[10px] font-medium text-muted-foreground">+{overflow}</span>
      ) : null}
    </div>
  );
}
