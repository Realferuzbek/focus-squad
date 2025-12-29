import type { TaskCalendarRecurrence } from "@/lib/taskSchedulerTypes";
import {
  HABIT_TARGETS,
  TASK_ESTIMATE_MINUTES,
  TASK_RESOURCES,
  TASK_SUBJECTS,
} from "@/lib/taskSchedulerTypes";

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
): T[number] | null {
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

export function normalizeEstimateOption(
  value: unknown,
  allowed: readonly number[] = TASK_ESTIMATE_MINUTES,
) {
  const normalized = normalizeEstimatedMinutes(value);
  if (normalized === null) return null;
  return allowed.includes(normalized) ? normalized : null;
}

export function normalizeTaskSubject(value: unknown) {
  return normalizeEnum(value, TASK_SUBJECTS);
}

export function normalizeResource(value: unknown) {
  return normalizeEnum(value, TASK_RESOURCES);
}

export function normalizeHabitTarget(value: unknown) {
  return normalizeEnum(value, HABIT_TARGETS);
}

export function normalizeTimeMinutes(
  value: unknown,
  stepMinutes = 30,
) {
  if (value === null || value === undefined || value === "") return null;
  let parsed: number | null = null;
  if (typeof value === "number" && Number.isFinite(value)) {
    parsed = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      parsed = asNumber;
    }
  }
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  if (rounded < 0 || rounded > 1439) return null;
  if (stepMinutes > 1 && rounded % stepMinutes !== 0) return null;
  return rounded;
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

  const hasByWeekday = Object.prototype.hasOwnProperty.call(
    input,
    "byWeekday",
  );
  const byWeekday = hasByWeekday
    ? normalizeWeekdayArray(input.byWeekday)
    : null;
  if (hasByWeekday && !byWeekday) return undefined;

  if (byWeekday && freq !== "weekly" && freq !== "monthly") {
    return undefined;
  }

  const hasEnds = Object.prototype.hasOwnProperty.call(input, "ends");
  if (!hasEnds || !input.ends || typeof input.ends !== "object") {
    return undefined;
  }
  const endsInput = input.ends as Record<string, unknown>;
  const endsType = normalizeEnum(endsInput.type, ["never", "on", "after"]);
  if (!endsType) return undefined;

  let ends: TaskCalendarRecurrence["ends"];
  if (endsType === "never") {
    ends = { type: "never" };
  } else if (endsType === "on") {
    const until = normalizeDateInput(endsInput.until);
    if (!until) return undefined;
    ends = { type: "on", until };
  } else {
    const count = normalizePositiveInt(endsInput.count, 1, 1000);
    if (!count) return undefined;
    ends = { type: "after", count };
  }

  const recurrence: TaskCalendarRecurrence = {
    freq,
    interval,
    ends,
  };
  if (byWeekday) recurrence.byWeekday = byWeekday;

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

