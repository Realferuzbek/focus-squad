export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_CALENDAR_EVENT_COLUMNS,
  TASK_ITEM_COLUMNS,
  serializeCalendarEvent,
  serializeTask,
  syncTaskCalendarEvent,
  type TaskCalendarEventRow,
  type TaskItemRow,
} from "@/lib/taskSchedulerServer";
import {
  DEFAULT_EVENT_COLOR,
  type TaskCalendarEvent,
} from "@/lib/taskSchedulerTypes";
import {
  normalizeOptionalString,
  validateScheduleInput,
} from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
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

  if (taskId) {
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
    const event = await syncTaskCalendarEvent(sb, {
      userId,
      taskId,
      title: updatedTask.title,
      category: updatedTask.category,
      scheduledStart: schedule.start,
      scheduledEnd: schedule.end,
    });

    return NextResponse.json({ event, task: updatedTask });
  }

  const title = normalizeOptionalString(body?.title) ?? "Untitled block";
  const color = normalizeOptionalString(body?.color) ?? DEFAULT_EVENT_COLOR;

  const { data, error } = await sb
    .from("task_calendar_events")
    .insert({
      user_id: userId,
      task_id: null,
      title,
      start_at: schedule.start,
      end_at: schedule.end,
      color,
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
