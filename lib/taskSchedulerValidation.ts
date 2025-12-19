import type { TaskCalendarRecurrence } from "@/lib/taskSchedulerTypes";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const RECURRENCE_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;

export function normalizeDateInput(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return ISO_DATE_RE.test(trimmed) ? trimmed : null;
}

export function normalizeTimestampInput(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeCalendarName(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 48) return null;
  return trimmed;
}

export function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : null;
}

export function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

export function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback?: T[number],
) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const match = allowed.find((entry) => entry === normalized);
    if (match) return match;
  }
  return fallback ?? null;
}

export function normalizeEstimatedMinutes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 0 ? rounded : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const rounded = Math.round(parsed);
      return rounded >= 0 ? rounded : null;
    }
  }
  return null;
}

export function normalizeWeekdayArray(value: unknown) {
  if (!value) return null;
  const days = Array.isArray(value) ? value : [];
  const normalized = days
    .map((entry) => {
      if (typeof entry === "number" && Number.isInteger(entry)) {
        return entry;
      }
      if (typeof entry === "string" && entry.trim() !== "") {
        const parsed = Number(entry);
        if (!Number.isNaN(parsed)) {
          return Math.trunc(parsed);
        }
      }
      return null;
    })
    .filter((entry): entry is number => entry !== null)
    .map((entry) => Math.max(0, Math.min(6, entry)));
  if (!normalized.length) return null;
  const unique = Array.from(new Set(normalized)).sort((a, b) => a - b);
  return unique;
}

function normalizePositiveInt(value: unknown, min: number, max: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= min && rounded <= max ? rounded : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const rounded = Math.round(parsed);
      return rounded >= min && rounded <= max ? rounded : null;
    }
  }
  return null;
}

function normalizeMonthdayArray(value: unknown) {
  if (!value) return null;
  const days = Array.isArray(value) ? value : [];
  const normalized = days
    .map((entry) => {
      if (typeof entry === "number" && Number.isInteger(entry)) {
        return entry;
      }
      if (typeof entry === "string" && entry.trim() !== "") {
        const parsed = Number(entry);
        if (!Number.isNaN(parsed)) {
          return Math.trunc(parsed);
        }
      }
      return null;
    })
    .filter((entry): entry is number => entry !== null)
    .map((entry) => Math.max(1, Math.min(31, entry)));
  if (!normalized.length) return null;
  const unique = Array.from(new Set(normalized)).sort((a, b) => a - b);
  return unique;
}

function normalizeUntilInput(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  return normalizeTimestampInput(trimmed);
}

export function normalizeRecurrenceInput(
  value: unknown,
): TaskCalendarRecurrence | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;

  const input = value as Record<string, unknown>;
  const freq = normalizeEnum(input.freq, RECURRENCE_FREQS);
  if (!freq) return undefined;

  const interval = normalizePositiveInt(input.interval ?? 1, 1, 365);
  if (!interval) return undefined;

  const hasByweekday = Object.prototype.hasOwnProperty.call(
    input,
    "byweekday",
  );
  const byweekday = hasByweekday
    ? normalizeWeekdayArray(input.byweekday)
    : null;
  if (hasByweekday && !byweekday) return undefined;

  const hasMonthday = Object.prototype.hasOwnProperty.call(
    input,
    "bymonthday",
  );
  const bymonthday = hasMonthday
    ? normalizeMonthdayArray(input.bymonthday)
    : null;
  if (hasMonthday && !bymonthday) return undefined;

  const hasSetpos = Object.prototype.hasOwnProperty.call(input, "bysetpos");
  const bysetpos = hasSetpos
    ? normalizePositiveInt(input.bysetpos, 1, 5)
    : null;
  if (hasSetpos && !bysetpos) return undefined;

  const hasUntil = Object.prototype.hasOwnProperty.call(input, "until");
  const until = hasUntil ? normalizeUntilInput(input.until) : null;
  if (hasUntil && until === null) return undefined;

  const hasCount = Object.prototype.hasOwnProperty.call(input, "count");
  const count = hasCount ? normalizePositiveInt(input.count, 1, 1000) : null;
  if (hasCount && count === null) return undefined;

  const recurrence: TaskCalendarRecurrence = {
    freq,
    interval,
  };
  if (byweekday) recurrence.byweekday = byweekday;
  if (bymonthday) recurrence.bymonthday = bymonthday;
  if (bysetpos) recurrence.bysetpos = bysetpos;
  if (until) recurrence.until = until;
  if (count) recurrence.count = count;

  return recurrence;
}

export type NormalizedScheduleResult = {
  start: string | null;
  end: string | null;
  error?: "scheduledStartRequired" | "scheduledEndRequired" | "invalidRange";
};

export function validateScheduleInput(
  startValue: unknown,
  endValue: unknown,
): NormalizedScheduleResult {
  const start = normalizeTimestampInput(startValue);
  const end = normalizeTimestampInput(endValue);

  if (start && !end) {
    return { start: null, end: null, error: "scheduledEndRequired" };
  }
  if (!start && end) {
    return { start: null, end: null, error: "scheduledStartRequired" };
  }
  if (start && end) {
    if (new Date(end) <= new Date(start)) {
      return { start: null, end: null, error: "invalidRange" };
    }
    return { start, end };
  }
  return { start: null, end: null };
}

