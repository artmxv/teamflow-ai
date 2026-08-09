import { ProjectStatusIndicator } from "@/components/app/ProjectStatusIndicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ["planning", "active", "on_hold", "completed"];

type ProjectStatusSelectProps = {
  value: ProjectStatus;
  onValueChange: (value: ProjectStatus) => void;
  getLabel: (status: ProjectStatus) => string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  triggerClassName?: string;
};

/**
 * Shared project status select for Create/Edit dialogs:
 * [dot] full label [chevron], with the trigger width controlled by its grid column.
 */
export function ProjectStatusSelect({
  value,
  onValueChange,
  getLabel,
  placeholder,
  disabled,
  id,
  triggerClassName,
}: ProjectStatusSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as ProjectStatus)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full min-w-0", triggerClassName)}>
        <SelectValue placeholder={placeholder}>
          <ProjectStatusIndicator status={value}>{getLabel(value)}</ProjectStatusIndicator>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" collisionPadding={8}>
        {PROJECT_STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            <ProjectStatusIndicator status={status}>{getLabel(status)}</ProjectStatusIndicator>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
