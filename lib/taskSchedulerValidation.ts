const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
