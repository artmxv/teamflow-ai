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
    <div className={cn("space-y-2", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border bg-muted/25 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tasks.selectedAssignees")}
            </p>
            {value.length > 0 ? (
              <span className="text-[11px] font-medium text-muted-foreground">
                {selectedCountLabel}
              </span>
            ) : null}
          </div>
          {selectedOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {emptySelectedLabel ?? t("tasks.noAssigneesAssigned")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedOptions.map((option) => (
                <span
                  key={option.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pl-0.5 pr-1.5 text-xs"
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
                      className="rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${option.name}`}
                      onClick={() => removeAssignee(option.id)}
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-2 py-2">
          <p className="mb-1.5 px-1 text-xs text-muted-foreground">{t("tasks.selectAssignees")}</p>
          <div
            className={cn(
              "app-scrollbar min-h-[9rem] max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-background/50",
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
              <ul className="divide-y divide-border p-1">
                {options.map((option) => {
                  const checked = value.includes(option.id);
                  const checkboxId = `assignee-option-${option.id}`;
                  return (
                    <li key={option.id}>
                      <label
                        htmlFor={checkboxId}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50",
                          checked && "bg-primary/5 ring-1 ring-primary/15",
                          disabled && "cursor-not-allowed opacity-50",
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
