export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_CALENDAR_EVENT_COLUMNS,
  TASK_ITEM_COLUMNS,
  fetchEventRow,
  serializeCalendarEvent,
  serializeTask,
  syncTaskCalendarEvent,
  deleteCalendarEventById,
  type TaskCalendarEventRow,
  type TaskItemRow,
} from "@/lib/taskSchedulerServer";
import { DEFAULT_EVENT_COLOR } from "@/lib/taskSchedulerTypes";
import {
  normalizeOptionalString,
  validateScheduleInput,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { eventId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const eventRow = await fetchEventRow(sb, userId, params.eventId);
  if (!eventRow) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const hasCalendarId = hasProp(body, "calendarId");
  let calendarIdValue: string | null | undefined;
  if (hasCalendarId) {
    if (body.calendarId === null || body.calendarId === "") {
      calendarIdValue = null;
    } else if (typeof body.calendarId === "string" && body.calendarId.trim()) {
      const calendarId = body.calendarId.trim();
      calendarIdValue = calendarId;
      const calendarCheck = await ensureCalendarAccess(
        sb,
        userId,
        calendarId,
      );
      if (!calendarCheck.ok) {
        return NextResponse.json(
          { error: calendarCheck.message },
          { status: calendarCheck.status },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid calendar" },
        { status: 400 },
      );
    }
  }
  const hasDescription = hasProp(body, "description");
  const descriptionValue = hasDescription
    ? normalizeOptionalString(body.description)
    : null;

  if (eventRow.task_id && eventRow.event_kind === "manual") {
    const taskUpdates: Record<string, any> = {};
    const eventUpdates: Record<string, any> = {};
    if (calendarIdValue !== undefined) {
      eventUpdates.calendar_id = calendarIdValue;
    }
    if (hasDescription) {
      eventUpdates.description = descriptionValue;
    }

    if (hasProp(body, "title")) {
      const nextTitle =
        typeof body.title === "string" ? body.title.trim() : "";
      if (!nextTitle) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 },
        );
      }
      taskUpdates.title = nextTitle;
    }

    const hasTimeChange =
      hasProp(body, "start") ||
      hasProp(body, "end");
    if (hasTimeChange) {
      const schedule = validateScheduleInput(
        hasProp(body, "start") ? body.start : eventRow.start_at,
        hasProp(body, "end") ? body.end : eventRow.end_at,
      );
      if (schedule.error === "invalidRange") {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 },
        );
      }
      if (schedule.error === "scheduledEndRequired") {
        return NextResponse.json(
          { error: "End time required when providing a start" },
          { status: 400 },
        );
      }
      if (schedule.error === "scheduledStartRequired") {
        return NextResponse.json(
          { error: "Start time required when providing an end" },
          { status: 400 },
        );
      }
      taskUpdates.scheduled_start = schedule.start;
      taskUpdates.scheduled_end = schedule.end;
    }

    if (Object.keys(taskUpdates).length === 0) {
      if (Object.keys(eventUpdates).length === 0) {
        return NextResponse.json(
          { event: serializeCalendarEvent(eventRow), task: null },
        );
      }

      const { data, error } = await sb
        .from("task_calendar_events")
        .update(eventUpdates)
        .eq("user_id", userId)
        .eq("id", eventRow.id)
        .select(TASK_CALENDAR_EVENT_COLUMNS)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to update event" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        event: serializeCalendarEvent(data as TaskCalendarEventRow),
        task: null,
      });
    }

    const { data, error } = await sb
      .from("task_items")
      .update(taskUpdates)
      .eq("user_id", userId)
      .eq("id", eventRow.task_id)
      .select(TASK_ITEM_COLUMNS)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to update task" },
        { status: 500 },
      );
    }

    const updatedTask = serializeTask(data as TaskItemRow);
    const syncOptions: Parameters<typeof syncTaskCalendarEvent>[1] = {
      userId,
      taskId: updatedTask.id,
      title: updatedTask.title,
      category: updatedTask.category,
      scheduledStart: updatedTask.scheduledStart,
      scheduledEnd: updatedTask.scheduledEnd,
    };
    if (calendarIdValue !== undefined) {
      syncOptions.calendarId = calendarIdValue;
    }
    if (hasDescription) {
      syncOptions.description = descriptionValue;
    }

    const event = await syncTaskCalendarEvent(sb, syncOptions);

    return NextResponse.json({ event, task: updatedTask });
  }

  const eventUpdates: Record<string, any> = {};
  if (calendarIdValue !== undefined) {
    eventUpdates.calendar_id = calendarIdValue;
  }
  if (hasDescription) {
    eventUpdates.description = descriptionValue;
  }

  if (hasProp(body, "title")) {
    const nextTitle =
      typeof body.title === "string" ? body.title.trim() : "";
    if (!nextTitle) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 },
      );
    }
    eventUpdates.title = nextTitle;
  }

  const hasTimeChange = hasProp(body, "start") || hasProp(body, "end");
  if (hasTimeChange) {
    const schedule = validateScheduleInput(
      hasProp(body, "start") ? body.start : eventRow.start_at,
      hasProp(body, "end") ? body.end : eventRow.end_at,
    );
    if (schedule.error === "invalidRange") {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }
    if (schedule.error === "scheduledEndRequired") {
      return NextResponse.json(
        { error: "End time required when providing a start" },
        { status: 400 },
      );
    }
    if (schedule.error === "scheduledStartRequired") {
      return NextResponse.json(
        { error: "Start time required when providing an end" },
        { status: 400 },
      );
    }
    eventUpdates.start_at = schedule.start ?? eventRow.start_at;
    eventUpdates.end_at = schedule.end ?? eventRow.end_at;
  }

  if (hasProp(body, "color")) {
    eventUpdates.color =
      normalizeOptionalString(body.color) ?? DEFAULT_EVENT_COLOR;
  }

  if (Object.keys(eventUpdates).length === 0) {
    return NextResponse.json({ event: serializeCalendarEvent(eventRow) });
  }

  const { data, error } = await sb
    .from("task_calendar_events")
    .update(eventUpdates)
    .eq("user_id", userId)
    .eq("id", params.eventId)
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to update event" },
      { status: 500 },
    );
  }

  return NextResponse.json({ event: serializeCalendarEvent(data as TaskCalendarEventRow) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { eventId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const deleted = await deleteCalendarEventById(sb, userId, params.eventId);
  if (!deleted) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let task: TaskItemRow | null = null;
  if (deleted.taskId && deleted.eventKind === "manual") {
    const { data } = await sb
      .from("task_items")
      .update({ scheduled_start: null, scheduled_end: null })
      .eq("user_id", userId)
      .eq("id", deleted.taskId)
      .select(TASK_ITEM_COLUMNS)
      .maybeSingle();
    if (data) {
      task = data as TaskItemRow;
    }
  }

  return NextResponse.json({
    deletedEventId: params.eventId,
    task: task ? serializeTask(task) : null,
  });
}
