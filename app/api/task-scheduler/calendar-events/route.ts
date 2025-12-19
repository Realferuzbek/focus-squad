export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_CALENDAR_EVENT_COLUMNS,
  TASK_ITEM_COLUMNS,
  fetchDefaultCalendarId,
  serializeCalendarEvent,
  serializeTask,
  syncTaskCalendarEvent,
  type TaskCalendarEventRow,
  type TaskItemRow,
} from "@/lib/taskSchedulerServer";
import { DEFAULT_EVENT_COLOR } from "@/lib/taskSchedulerTypes";
import {
  normalizeOptionalString,
  normalizeBoolean,
  validateScheduleInput,
  normalizeRecurrenceInput,
} from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

function hasProp(body: any, key: string) {
  return body && Object.prototype.hasOwnProperty.call(body, key);
}

async function ensureCalendarAccess(
  sb: ReturnType<typeof supabaseAdmin>,
  userId: string,
  calendarId: string,
) {
  const { data, error } = await sb
    .from("task_calendars")
    .select("id")
    .eq("user_id", userId)
    .eq("id", calendarId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, message: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, message: "Calendar not found" };
  }
  return { ok: true } as const;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ events: [] }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_calendar_events")
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .eq("user_id", userId)
    .order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as TaskCalendarEventRow[];
  return NextResponse.json({ events: rows.map(serializeCalendarEvent) });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const hasIsAllDay = hasProp(body, "isAllDay");
  let isAllDayValue: boolean | null = null;
  if (hasIsAllDay) {
    isAllDayValue = normalizeBoolean(body?.isAllDay);
    if (isAllDayValue === null) {
      return NextResponse.json(
        { error: "Invalid all-day value" },
        { status: 400 },
      );
    }
  }
  const hasRecurrence = hasProp(body, "recurrence");
  const recurrenceValue = hasRecurrence
    ? normalizeRecurrenceInput(body?.recurrence)
    : null;
  if (hasRecurrence && recurrenceValue === undefined) {
    return NextResponse.json(
      { error: "Invalid recurrence" },
      { status: 400 },
    );
  }
  const schedule = validateScheduleInput(body?.start, body?.end);
  if (!schedule.start || !schedule.end) {
    if (schedule.error === "invalidRange") {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Start and end time are required" },
      { status: 400 },
    );
  }

  const taskId = typeof body?.taskId === "string" ? body.taskId : null;
  const sb = supabaseAdmin();
  const calendarIdInput = normalizeOptionalString(body?.calendarId);
  const hasDescription = hasProp(body, "description");
  const description = hasDescription
    ? normalizeOptionalString(body?.description)
    : null;

  if (taskId) {
    if (calendarIdInput) {
      const calendarCheck = await ensureCalendarAccess(
        sb,
        userId,
        calendarIdInput,
      );
      if (!calendarCheck.ok) {
        return NextResponse.json(
          { error: calendarCheck.message },
          { status: calendarCheck.status },
        );
      }
    }

    const { data, error } = await sb
      .from("task_items")
      .update({
        scheduled_start: schedule.start,
        scheduled_end: schedule.end,
      })
      .eq("user_id", userId)
      .eq("id", taskId)
      .select(TASK_ITEM_COLUMNS)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updatedTask = serializeTask(data as TaskItemRow);
    const syncOptions: Parameters<typeof syncTaskCalendarEvent>[1] = {
      userId,
      taskId,
      title: updatedTask.title,
      category: updatedTask.category,
      scheduledStart: schedule.start,
      scheduledEnd: schedule.end,
    };
    if (calendarIdInput) {
      syncOptions.calendarId = calendarIdInput;
    }
    if (hasDescription) {
      syncOptions.description = description;
    }
    if (hasIsAllDay) {
      syncOptions.isAllDay = isAllDayValue ?? false;
    }
    if (hasRecurrence) {
      syncOptions.recurrence = recurrenceValue ?? null;
    }

    const event = await syncTaskCalendarEvent(sb, syncOptions);

    return NextResponse.json({ event, task: updatedTask });
  }

  let calendarId = calendarIdInput;
  if (!calendarId) {
    calendarId = await fetchDefaultCalendarId(sb, userId);
  }
  if (calendarId) {
    const calendarCheck = await ensureCalendarAccess(sb, userId, calendarId);
    if (!calendarCheck.ok) {
      return NextResponse.json(
        { error: calendarCheck.message },
        { status: calendarCheck.status },
      );
    }
  }

  const title = normalizeOptionalString(body?.title) ?? "Untitled block";
  const color = normalizeOptionalString(body?.color) ?? DEFAULT_EVENT_COLOR;
  const isAllDay = isAllDayValue ?? false;

  const { data, error } = await sb
    .from("task_calendar_events")
    .insert({
      user_id: userId,
      task_id: null,
      calendar_id: calendarId,
      title,
      description,
      start_at: schedule.start,
      end_at: schedule.end,
      is_all_day: isAllDay,
      color,
      recurrence: recurrenceValue ?? null,
    })
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to create event" },
      { status: 500 },
    );
  }

  return NextResponse.json({ event: serializeCalendarEvent(data as TaskCalendarEventRow) });
}
