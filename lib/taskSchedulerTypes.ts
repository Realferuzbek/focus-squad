export const TASK_PRIVATE_ITEM_KINDS = ["page", "task_list"] as const;
export type TaskPrivateItemKind = (typeof TASK_PRIVATE_ITEM_KINDS)[number];

export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "done",
] as const;
export type StudentTaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type StudentTaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_CATEGORIES = [
  "assignment",
  "exam",
  "project",
  "habit",
  "other",
] as const;
export type StudentTaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_REPEAT_RULES = [
  "none",
  "daily",
  "weekdays",
  "custom_days",
] as const;
export type StudentHabitRepeatRule = (typeof TASK_REPEAT_RULES)[number];

export type TaskCalendarEventKind = "manual" | "auto_plan";

export const TASK_RECURRENCE_FREQS = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type TaskCalendarRecurrenceFrequency =
  (typeof TASK_RECURRENCE_FREQS)[number];

export type TaskCalendarRecurrence = {
  freq: TaskCalendarRecurrenceFrequency;
  interval: number;
  byweekday?: number[];
  bymonthday?: number[];
  bysetpos?: number;
  until?: string | null;
  count?: number | null;
};

export type TaskPrivateItem = {
  id: string;
  title: string;
  kind: TaskPrivateItemKind;
  createdAt: string;
  updatedAt: string;
};

export type StudentTask = {
  id: string;
  privateItemId: string;
  title: string;
  description: string | null;
  status: StudentTaskStatus;
  priority: StudentTaskPriority;
  category: StudentTaskCategory;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimatedMinutes: number | null;
  repeatRule: StudentHabitRepeatRule;
  repeatDays: number[] | null;
  repeatUntil: string | null;
  autoPlanned: boolean;
  autoBlockDurationMin: number;
  autoDailyMaxMinutes: number;
  autoStartDate: string | null;
  autoAllowedDays: number[] | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  color: string | null;
  calendarId?: string | null;
  description?: string | null;
  taskId: string | null;
  eventKind: TaskCalendarEventKind;
  recurrence?: TaskCalendarRecurrence | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskCalendar = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const CATEGORY_COLOR_MAP: Record<StudentTaskCategory, string> = {
  assignment: "#60a5fa",
  exam: "#f87171",
  project: "#a78bfa",
  habit: "#4ade80",
  other: "#9ca3af",
};

export const DEFAULT_EVENT_COLOR = "#8b5cf6";

export function resolveCategoryColor(
  category?: StudentTaskCategory | string | null,
) {
  if (!category) return DEFAULT_EVENT_COLOR;
  const normalized = category.trim().toLowerCase() as StudentTaskCategory;
  return CATEGORY_COLOR_MAP[normalized] ?? DEFAULT_EVENT_COLOR;
}
