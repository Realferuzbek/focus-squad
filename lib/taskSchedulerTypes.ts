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
  category: string | null;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
};

const CATEGORY_COLOR_MAP: Record<string, string> = {
  learning: "#9b7bff",
  uni: "#34d399",
  startup: "#f472b6",
  habit: "#22d3ee",
  content: "#facc15",
};

export const DEFAULT_EVENT_COLOR = "#8b5cf6";

export function resolveCategoryColor(category?: string | null) {
  if (!category) return DEFAULT_EVENT_COLOR;
  const normalized = category.trim().toLowerCase();
  return CATEGORY_COLOR_MAP[normalized] ?? DEFAULT_EVENT_COLOR;
}
