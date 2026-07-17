import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Clock } from "lucide-react";

import {
  deadlineFieldTriggerClassName,
  deadlineSelectedItemClassName,
} from "@/components/app/deadline-field-styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseTime(value: string): { hour: string; minute: string } {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: "", minute: "" };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: "", minute: "" };
  }
  return { hour: match[1], minute: match[2] };
}

function formatTime(hour: string, minute: string): string {
  if (!hour || !minute) return "";
  return `${hour}:${minute}`;
}

function scrollSelectedIntoView(list: HTMLDivElement | null, value: string) {
  if (!list || !value) return;
  const el = list.querySelector<HTMLElement>(`[data-value="${value}"]`);
  if (!el) return;
  const top = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
  list.scrollTop = Math.max(0, top);
}

type DeadlineTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

export function DeadlineTimePicker({
  value,
  onChange,
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DeadlineTimePickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const hoursListId = `${triggerId}-hours`;
  const minutesListId = `${triggerId}-minutes`;

  const parsed = parseTime(value);
  const [draftHour, setDraftHour] = useState(parsed.hour);
  const [draftMinute, setDraftMinute] = useState(parsed.minute);

  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const next = parseTime(value);
    setDraftHour(next.hour);
    setDraftMinute(next.minute);

    const frame = window.requestAnimationFrame(() => {
      scrollSelectedIntoView(hourListRef.current, next.hour);
      scrollSelectedIntoView(minuteListRef.current, next.minute);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, value]);

  function commit(nextHour: string, nextMinute: string) {
    setDraftHour(nextHour);
    setDraftMinute(nextMinute);
    const next = formatTime(nextHour, nextMinute);
    if (next) onChange(next);
  }

  function selectHour(hour: string) {
    const minute = draftMinute || "00";
    commit(hour, minute);
  }

  function selectMinute(minute: string) {
    const hour = draftHour || "00";
    commit(hour, minute);
  }

  function focusColumnItem(column: "hour" | "minute", item: string) {
    const list = column === "hour" ? hourListRef.current : minuteListRef.current;
    const nextButton = list?.querySelector<HTMLButtonElement>(`[data-value="${item}"]`);
    nextButton?.focus();
    scrollSelectedIntoView(list, item);
  }

  function onColumnKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    column: "hour" | "minute",
    current: string,
  ) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusColumnItem("hour", draftHour || "00");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusColumnItem("minute", draftMinute || "00");
      return;
    }

    const items = column === "hour" ? HOURS : MINUTES;
    const index = Math.max(0, items.indexOf(current));

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (index + delta + items.length) % items.length;
      const next = items[nextIndex]!;
      if (column === "hour") selectHour(next);
      else selectMinute(next);
      focusColumnItem(column, next);
    }

    if (event.key === "Home") {
      event.preventDefault();
      const first = items[0]!;
      if (column === "hour") selectHour(first);
      else selectMinute(first);
      focusColumnItem(column, first);
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = items[items.length - 1]!;
      if (column === "hour") selectHour(last);
      else selectMinute(last);
      focusColumnItem(column, last);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (draftHour && draftMinute) setOpen(false);
    }
  }

  const displayValue = value.trim() || "";
  const label = ariaLabel ?? t("tasks.dueTime");

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
          <Clock className="size-3.5 shrink-0 text-muted-foreground opacity-80" aria-hidden />
          <span className="min-w-0 flex-1 whitespace-nowrap tabular-nums tracking-normal">
            {displayValue || t("deadlineTime.placeholder")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const target =
            hourListRef.current?.querySelector<HTMLElement>('[data-selected="true"]') ??
            hourListRef.current?.querySelector<HTMLElement>("button");
          target?.focus();
        }}
        className={cn(
          "w-[12.5rem] border-border bg-popover p-2.5 text-popover-foreground shadow-soft",
          "max-h-[min(18rem,var(--radix-popover-content-available-height))]",
        )}
      >
        <div className="mb-2 grid grid-cols-2 gap-2 px-0.5">
          <p
            id={hoursListId}
            className="text-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
          >
            {t("deadlineTime.hours")}
          </p>
          <p
            id={minutesListId}
            className="text-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
          >
            {t("deadlineTime.minutes")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TimeColumn
            ref={hourListRef}
            labelledBy={hoursListId}
            items={HOURS}
            selected={draftHour}
            ariaLabel={t("deadlineTime.selectHour")}
            onSelect={selectHour}
            onKeyDown={(event, item) => onColumnKeyDown(event, "hour", item)}
          />
          <TimeColumn
            ref={minuteListRef}
            labelledBy={minutesListId}
            items={MINUTES}
            selected={draftMinute}
            ariaLabel={t("deadlineTime.selectMinute")}
            onSelect={selectMinute}
            onKeyDown={(event, item) => onColumnKeyDown(event, "minute", item)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

type TimeColumnProps = {
  items: string[];
  selected: string;
  labelledBy: string;
  ariaLabel: string;
  onSelect: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, item: string) => void;
  ref?: Ref<HTMLDivElement>;
};

function TimeColumn({
  items,
  selected,
  labelledBy,
  ariaLabel,
  onSelect,
  onKeyDown,
  ref,
}: TimeColumnProps) {
  return (
    <div
      ref={ref}
      role="listbox"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      className="app-scrollbar max-h-40 overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-background/30 p-0.5"
    >
      {items.map((item) => {
        const isSelected = item === selected;
        return (
          <button
            key={item}
            type="button"
            role="option"
            data-value={item}
            data-selected={isSelected ? "true" : undefined}
            aria-selected={isSelected}
            tabIndex={isSelected || (!selected && item === "00") ? 0 : -1}
            className={cn(
              "flex w-full items-center justify-center rounded-md border border-transparent px-1 py-1 text-sm tabular-nums transition-colors",
              "hover:bg-secondary/60 hover:text-foreground",
              "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
              isSelected
                ? deadlineSelectedItemClassName()
                : "text-muted-foreground",
            )}
            onClick={() => onSelect(item)}
            onKeyDown={(event) => onKeyDown(event, item)}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
