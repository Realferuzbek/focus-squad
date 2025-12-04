import type { LeaderboardScope } from "@/types/leaderboard";

function buildFormatter(options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en-US", options);
  } catch (error) {
    console.warn("leaderboard: failed to build formatter", { options, error });
    return null;
  }
}

const postedFormatter = buildFormatter({
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tashkent",
});

const periodFormatter = buildFormatter({
  month: "long",
  day: "numeric",
  year: "numeric",
});

const periodShortFormatter = buildFormatter({
  month: "short",
  day: "numeric",
});

const monthFormatter = buildFormatter({
  month: "long",
  year: "numeric",
});

const weekdayFormatter = buildFormatter({
  weekday: "short",
});

export function formatWithFallback(date: Date) {
  return postedFormatter ? postedFormatter.format(date) : date.toISOString();
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function formatPeriodForCard(
  scope: LeaderboardScope,
  periodStart: string,
  periodEnd: string,
) {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);

  if (scope === "day") {
    const weekday = weekdayFormatter?.format(start);
    const dateLabel = periodFormatter?.format(start) ?? periodStart;
    return weekday ? `${dateLabel} | ${weekday}` : dateLabel;
  }

  if (scope === "week") {
    const startLabel = periodFormatter?.format(start) ?? periodStart;
    const endLabel = periodFormatter?.format(end) ?? periodEnd;
    return `${startLabel} -> ${endLabel}`;
  }

  return monthFormatter?.format(start) ?? periodStart;
}

export function formatPostedLabel(postedAt: string | null) {
  if (!postedAt) return "Not published yet";
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) {
    return postedAt;
  }
  return `${formatWithFallback(date)} - Asia/Tashkent`;
}

export function formatSyncLabel(timestamp: string | null) {
  if (!timestamp) return "No snapshots yet";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return formatWithFallback(date);
}

export function formatHistoryPeriodLabel(
  scope: LeaderboardScope,
  periodStart: string,
  periodEnd: string,
) {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);

  if (scope === "day") {
    const weekday = weekdayFormatter?.format(start);
    const dateLabel = periodFormatter?.format(start) ?? periodStart;
    return weekday ? `${dateLabel} (${weekday})` : dateLabel;
  }

  if (scope === "week") {
    const startLabel = periodShortFormatter?.format(start) ?? periodStart;
    const endLabel = periodShortFormatter?.format(end) ?? periodEnd;
    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    if (sameYear) {
      return `${startLabel} – ${endLabel}, ${start.getUTCFullYear()}`;
    }
    return `${startLabel}, ${start.getUTCFullYear()} – ${endLabel}, ${end.getUTCFullYear()}`;
  }

  return monthFormatter?.format(start) ?? periodStart;
}

export function formatHistoryDetailLabel(
  scope: LeaderboardScope,
  periodStart: string,
  periodEnd: string,
) {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);

  if (scope === "day") {
    const weekday = weekdayFormatter?.format(start);
    const dateLabel = periodFormatter?.format(start) ?? periodStart;
    return weekday ? `${dateLabel} | ${weekday}` : dateLabel;
  }

  if (scope === "week") {
    const startLabel = periodFormatter?.format(start) ?? periodStart;
    const endLabel = periodFormatter?.format(end) ?? periodEnd;
    return `${startLabel} – ${endLabel}`;
  }

  return monthFormatter?.format(start) ?? periodStart;
}
