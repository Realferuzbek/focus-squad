import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskCalendarEvent,
  TaskCalendar,
  TaskPrivateItem,
  StudentTask,
  resolveCategoryColor,
} from "@/lib/taskSchedulerTypes";

export type TaskPrivateItemRow = {
  id: string;
  user_id: string;
  title: string;
  kind: string;
  created_at: string;
  updated_at: string;
};

export type TaskItemRow = {
  id: string;
  user_id: string;
  private_item_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_minutes: number | null;
  repeat_rule: string;
  repeat_days: number[] | null;
  repeat_until: string | null;
  auto_planned: boolean;
  auto_block_duration_min: number;
  auto_daily_max_minutes: number;
  auto_start_date: string | null;
  auto_allowed_days: number[] | null;
  created_at: string;
  updated_at: string;
};

export type TaskCalendarEventRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  calendar_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  color: string | null;
  event_kind: string;
  created_at: string;
  updated_at: string;
};

export type TaskCalendarRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const TASK_PRIVATE_ITEM_COLUMNS =
  "id,user_id,title,kind,created_at,updated_at";
export const TASK_ITEM_COLUMNS =
  "id,user_id,private_item_id,title,description,status,priority,category,due_date,scheduled_start,scheduled_end,estimated_minutes,repeat_rule,repeat_days,repeat_until,auto_planned,auto_block_duration_min,auto_daily_max_minutes,auto_start_date,auto_allowed_days,created_at,updated_at";
export const TASK_CALENDAR_EVENT_COLUMNS =
  "id,user_id,task_id,calendar_id,title,description,start_at,end_at,is_all_day,color,event_kind,created_at,updated_at";
export const TASK_CALENDAR_COLUMNS =
  "id,user_id,name,color,is_default,is_visible,sort_order,created_at,updated_at";

export function serializePrivateItem(row: TaskPrivateItemRow): TaskPrivateItem {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as TaskPrivateItem["kind"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeTask(row: TaskItemRow): StudentTask {
  return {
    id: row.id,
    privateItemId: row.private_item_id,
    title: row.title,
    description: row.description ?? null,
    status: row.status as StudentTask["status"],
    priority: row.priority as StudentTask["priority"],
    category: row.category as StudentTask["category"],
    dueDate: row.due_date ?? null,
    scheduledStart: row.scheduled_start ?? null,
    scheduledEnd: row.scheduled_end ?? null,
    estimatedMinutes: row.estimated_minutes ?? null,
    repeatRule: row.repeat_rule as StudentTask["repeatRule"],
    repeatDays: row.repeat_days ?? null,
    repeatUntil: row.repeat_until ?? null,
    autoPlanned: row.auto_planned,
    autoBlockDurationMin: row.auto_block_duration_min,
    autoDailyMaxMinutes: row.auto_daily_max_minutes,
    autoStartDate: row.auto_start_date ?? null,
    autoAllowedDays: row.auto_allowed_days ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeCalendarEvent(
  row: TaskCalendarEventRow,
): TaskCalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    isAllDay: row.is_all_day ?? false,
    color: row.color,
    calendarId: row.calendar_id ?? null,
    description: row.description ?? null,
    taskId: row.task_id,
    eventKind: row.event_kind as TaskCalendarEvent["eventKind"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeCalendar(row: TaskCalendarRow): TaskCalendar {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isDefault: row.is_default,
    isVisible: row.is_visible,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensurePrivateItemOwnership(
  sb: SupabaseClient,
  userId: string,
  privateItemId: string,
) {
  if (!privateItemId) return false;
  const { data } = await sb
    .from("task_private_items")
    .select("id")
    .eq("user_id", userId)
    .eq("id", privateItemId)
    .maybeSingle();
  return !!data;
}

export async function fetchTaskRow(
  sb: SupabaseClient,
  userId: string,
  taskId: string,
): Promise<TaskItemRow | null> {
  if (!taskId) return null;
  const { data } = await sb
    .from("task_items")
    .select(TASK_ITEM_COLUMNS)
    .eq("user_id", userId)
    .eq("id", taskId)
    .maybeSingle();
  return (data as TaskItemRow | null) ?? null;
}

export async function fetchEventRow(
  sb: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<TaskCalendarEventRow | null> {
  if (!eventId) return null;
  const { data } = await sb
    .from("task_calendar_events")
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .eq("user_id", userId)
    .eq("id", eventId)
    .maybeSingle();
  return (data as TaskCalendarEventRow | null) ?? null;
}

export async function fetchDefaultCalendarId(
  sb: SupabaseClient,
  userId: string,
) {
  const { data } = await sb
    .from("task_calendars")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function syncTaskCalendarEvent(
  sb: SupabaseClient,
  opts: {
    userId: string;
    taskId: string;
    title: string;
    category?: string | null;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    calendarId?: string | null;
    description?: string | null;
    isAllDay?: boolean;
  },
): Promise<TaskCalendarEvent | null> {
  const { userId, taskId } = opts;
  const scheduledStart = opts.scheduledStart ?? null;
  const scheduledEnd = opts.scheduledEnd ?? null;
  const hasCalendarId = Object.prototype.hasOwnProperty.call(opts, "calendarId");
  const hasDescription = Object.prototype.hasOwnProperty.call(opts, "description");
  const hasIsAllDay = Object.prototype.hasOwnProperty.call(opts, "isAllDay");

  if (!scheduledStart || !scheduledEnd) {
    const { data } = await sb
      .from("task_calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .eq("event_kind", "manual")
      .select(TASK_CALENDAR_EVENT_COLUMNS)
      .maybeSingle();
    return data ? serializeCalendarEvent(data as TaskCalendarEventRow) : null;
  }

  const { data: existing } = await sb
    .from("task_calendar_events")
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("event_kind", "manual")
    .maybeSingle();

  if (existing) {
    const updates: Record<string, any> = {
      title: opts.title,
      start_at: scheduledStart,
      end_at: scheduledEnd,
      color: resolveCategoryColor(opts.category),
    };
    if (hasCalendarId) {
      updates.calendar_id = opts.calendarId ?? null;
    }
    if (hasDescription) {
      updates.description = opts.description ?? null;
    }
    if (hasIsAllDay) {
      updates.is_all_day = opts.isAllDay ?? false;
    }
    const { data, error } = await sb
      .from("task_calendar_events")
      .update(updates)
      .eq("id", (existing as TaskCalendarEventRow).id)
      .select(TASK_CALENDAR_EVENT_COLUMNS)
      .maybeSingle();
    if (error) return null;
    return data ? serializeCalendarEvent(data as TaskCalendarEventRow) : null;
  }

  let calendarIdForInsert: string | null | undefined;
  if (hasCalendarId) {
    calendarIdForInsert = opts.calendarId ?? null;
  } else {
    calendarIdForInsert = await fetchDefaultCalendarId(sb, userId);
  }

  const insertPayload: Record<string, any> = {
    user_id: userId,
    task_id: taskId,
    title: opts.title,
    start_at: scheduledStart,
    end_at: scheduledEnd,
    color: resolveCategoryColor(opts.category),
    event_kind: "manual",
  };
  if (calendarIdForInsert !== undefined) {
    insertPayload.calendar_id = calendarIdForInsert;
  }
  if (hasDescription) {
    insertPayload.description = opts.description ?? null;
  }
  if (hasIsAllDay) {
    insertPayload.is_all_day = opts.isAllDay ?? false;
  }

  const { data, error } = await sb
    .from("task_calendar_events")
    .insert(insertPayload)
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .maybeSingle();
  if (error) return null;
  return data ? serializeCalendarEvent(data as TaskCalendarEventRow) : null;
}

export async function deleteCalendarEventById(
  sb: SupabaseClient,
  userId: string,
  eventId: string,
) {
  const { data } = await sb
    .from("task_calendar_events")
    .delete()
    .eq("user_id", userId)
    .eq("id", eventId)
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .maybeSingle();
  return data ? serializeCalendarEvent(data as TaskCalendarEventRow) : null;
}
