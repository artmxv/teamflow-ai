/**
 * Legacy date-only deadlines were stored via `new Date("YYYY-MM-DD").toISOString()`,
 * which is always midnight UTC. Detect that pattern without rewriting the DB.
 */
export function isLegacyDateOnlyDeadline(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

/**
 * Instant used for reminder comparisons.
 * Legacy midnight-UTC values are treated as end of that UTC calendar day.
 */
export function effectiveDueDate(value: Date): Date {
  if (!isLegacyDateOnlyDeadline(value)) {
    return value;
  }

  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999),
  );
}
