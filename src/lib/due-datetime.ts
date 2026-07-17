/** Pad a number to two digits for date/time input values. */
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Legacy date-only deadlines were stored via `new Date("YYYY-MM-DD").toISOString()`,
 * which is always midnight UTC. Detect that pattern without rewriting the DB.
 */
export function isLegacyDateOnlyDeadline(value: string | Date): boolean {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/**
 * Instant used for comparisons and display of effective deadline.
 * Legacy midnight-UTC values are treated as end of that UTC calendar day.
 */
export function effectiveDueDate(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(value) : new Date(value.getTime());
  if (Number.isNaN(date.getTime())) return date;
  if (!isLegacyDateOnlyDeadline(date)) return date;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

/** Combine local calendar date + time into an ISO/UTC string. */
export function combineLocalDateAndTime(date: string, time: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!dateMatch || !timeMatch) {
    throw new Error("Invalid local date or time");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

/**
 * Split an ISO deadline into local `YYYY-MM-DD` + `HH:mm` for native inputs.
 * Legacy date-only values use the UTC calendar date and default time 23:59.
 */
export function splitLocalDateTime(value: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!value) return { date: "", time: "" };

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };

  if (isLegacyDateOnlyDeadline(parsed)) {
    return {
      date: `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`,
      time: "23:59",
    };
  }

  return {
    date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
    time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
  };
}

/** Build ISO from optional form date/time, or null when both empty. */
export function dueDateTimeToIso(
  date: string | null | undefined,
  time: string | null | undefined,
): string | null {
  const trimmedDate = date?.trim() ?? "";
  const trimmedTime = time?.trim() ?? "";
  if (!trimmedDate && !trimmedTime) return null;
  if (!trimmedDate || !trimmedTime) {
    throw new Error("Date and time are both required");
  }
  return combineLocalDateAndTime(trimmedDate, trimmedTime);
}

/** Format deadline for UI (date + short time). Uses effective instant for legacy values. */
export function formatDueDateTime(
  value: string | null | undefined,
  locale?: string,
): string {
  if (!value) return "—";
  const date = effectiveDueDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Compact label for cards/lists (short date + time). */
export function formatDueDateTimeShort(
  value: string | null | undefined,
  locale?: string,
): string {
  if (!value) return "—";
  const date = effectiveDueDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
