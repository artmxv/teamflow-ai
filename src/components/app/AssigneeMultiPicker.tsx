import { X } from "lucide-react";

import { UserAvatar } from "@/components/app/UserAvatar";
import { Checkbox } from "@/components/ui/checkbox";
import { type AssigneeOption } from "@/lib/assignee-options";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AssigneeMultiPickerProps = {
  options: AssigneeOption[];
  value: string[];
  onChange: (assigneeIds: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  emptyLabel?: string;
  emptySelectedLabel?: string;
  compact?: boolean;
  className?: string;
  listClassName?: string;
};

export function AssigneeMultiPicker({
  options,
  value,
  onChange,
  disabled = false,
  isLoading = false,
  emptyLabel,
  emptySelectedLabel,
  compact = false,
  className,
  listClassName,
}: AssigneeMultiPickerProps) {
  const { t } = useI18n();

  const optionsById = new Map(options.map((option) => [option.id, option]));
  const selectedOptions = value
    .map((id) => optionsById.get(id))
    .filter((option): option is AssigneeOption => Boolean(option));

  const selectedCountLabel =
    value.length === 1
      ? t("tasks.assigneesCountOne")
      : t("tasks.assigneesCount").replace("{count}", String(value.length));

  function toggleAssignee(userId: string, checked: boolean) {
    onChange(checked ? [...value, userId] : value.filter((id) => id !== userId));
  }

  function removeAssignee(userId: string) {
    onChange(value.filter((id) => id !== userId));
  }

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2", className)}>
      <div className="overflow-hidden rounded-xl border border-control-border bg-control shadow-soft">
        <div className={cn("border-b border-border bg-muted/20 px-3", compact ? "py-2.5" : "py-3")}>
          {selectedOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {emptySelectedLabel ?? t("tasks.nobodyAssigned")}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-end">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {selectedCountLabel}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedOptions.map((option) => (
                  <span
                    key={option.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-control-border bg-background py-0.5 pl-0.5 pr-1.5 text-xs"
                  >
                    <UserAvatar
                      id={option.id}
                      name={option.name}
                      avatar={option.avatar}
                      avatarUrl={option.avatarUrl}
                      size="sm"
                    />
                    <span className="max-w-[8rem] truncate font-medium">{option.name}</span>
                    {!disabled ? (
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        aria-label={`Remove ${option.name}`}
                        onClick={() => removeAssignee(option.id)}
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={cn("px-3", compact ? "py-2" : "py-2.5")}>
          <p className={cn("text-xs text-muted-foreground", compact ? "mb-1.5" : "mb-2")}>
            {t("tasks.selectAssignees")}
          </p>
          <div
            className={cn(
              "app-scrollbar overflow-y-auto overscroll-contain rounded-lg border border-control-border bg-background/60",
              compact ? "max-h-32" : "min-h-[9rem] max-h-56",
              listClassName,
            )}
          >
            {isLoading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : options.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {emptyLabel ?? t("tasks.noAssignees")}
              </p>
            ) : (
              <ul className="divide-y divide-border p-1.5">
                {options.map((option) => {
                  const checked = value.includes(option.id);
                  const checkboxId = `assignee-option-${option.id}`;
                  return (
                    <li key={option.id}>
                      <label
                        htmlFor={checkboxId}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 transition-colors hover:bg-control-hover",
                          compact ? "py-2" : "py-2.5",
                          checked && "bg-primary/5 ring-1 ring-primary/15",
                          disabled && "cursor-not-allowed opacity-45",
                        )}
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(next) => toggleAssignee(option.id, next === true)}
                        />
                        <UserAvatar
                          id={option.id}
                          name={option.name}
                          avatar={option.avatar}
                          avatarUrl={option.avatarUrl}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{option.name}</span>
                          {option.email ? (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {option.email}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
