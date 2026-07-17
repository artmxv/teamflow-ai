import { useId, useMemo, useState } from "react";
import { enUS, ru } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

import { deadlineFieldTriggerClassName } from "@/components/app/deadline-field-styles";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Parse `YYYY-MM-DD` as a local calendar date. */
function parseLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** Format local date as `YYYY-MM-DD` for form/API value. */
function toValueDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Format local date as `DD.MM.YYYY` for display. */
function toDisplayDate(date: Date): string {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

type DeadlineDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

export function DeadlineDatePicker({
  value,
  onChange,
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DeadlineDatePickerProps) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const triggerId = id ?? generatedId;

  const selected = useMemo(() => parseLocalDate(value), [value]);
  const displayValue = selected ? toDisplayDate(selected) : "";
  const label = ariaLabel ?? t("tasks.dueDate");

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={triggerId}
          disabled={disabled}
          aria-label={label}
          aria-invalid={ariaInvalid}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={deadlineFieldTriggerClassName({
            empty: !displayValue,
            className,
          })}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground opacity-80" aria-hidden />
          <span className="min-w-0 flex-1 whitespace-nowrap tabular-nums tracking-normal">
            {displayValue || t("deadlineDate.placeholder")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions
        className={cn(
          "w-auto border-border bg-popover p-2 text-popover-foreground shadow-soft",
          "max-h-[min(22rem,var(--radix-popover-content-available-height))] overflow-y-auto",
        )}
      >
        <Calendar
          mode="single"
          selected={selected}
          locale={lang === "ru" ? ru : enUS}
          onSelect={(date) => {
            if (!date) {
              onChange("");
              return;
            }
            onChange(toValueDate(date));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
