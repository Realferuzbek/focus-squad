export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_CALENDAR_EVENT_COLUMNS,
  TASK_ITEM_COLUMNS,
  fetchTaskRow,
  serializeCalendarEvent,
  serializeTask,
  type TaskCalendarEventRow,
  type TaskItemRow,
} from "@/lib/taskSchedulerServer";
import {
  TASK_DAILY_MINUTES_LIMIT,
  STUDY_BLOCK_DAY_END_MINUTES,
  STUDY_BLOCK_DAY_START_MINUTES,
  STUDY_BLOCK_GAP_MINUTES,
} from "@/lib/taskSchedulerConstants";
import { resolveCategoryColor } from "@/lib/taskSchedulerTypes";
import { normalizeDateInput, normalizeWeekdayArray } from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

function parseBlockDuration(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(240, Math.max(20, Math.round(value)));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return Math.min(240, Math.max(20, Math.round(parsed)));
    }
  }
  return fallback;
}

function parseDailyMax(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(600, Math.max(60, Math.round(value)));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return Math.min(600, Math.max(60, Math.round(parsed)));
    }
  }
  return fallback;
}

function toDateMidnight(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const taskRow = await fetchTaskRow(sb, userId, params.taskId);
  if (!taskRow) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!["exam", "project"].includes(taskRow.category)) {
    return NextResponse.json(
      { error: "Auto-planning is only available for exams or projects" },
      { status: 400 },
    );
  }
  if (!taskRow.due_date) {
    return NextResponse.json(
      { error: "Set a due date before auto-planning" },
      { status: 400 },
    );
  }
  if (!taskRow.estimated_minutes || taskRow.estimated_minutes <= 0) {
    return NextResponse.json(
      { error: "Set an estimated minutes value before auto-planning" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const blockDuration = parseBlockDuration(
    body?.blockLength ?? body?.blockLengthMin,
    taskRow.auto_block_duration_min || 50,
  );
  const maxDailyMinutes = parseDailyMax(
    body?.maxMinutesPerDay ?? body?.autoDailyMaxMinutes,
    taskRow.auto_daily_max_minutes || 240,
  );
  const allowedDays =
    normalizeWeekdayArray(body?.allowedDays ?? body?.autoAllowedDays) ??
    taskRow.auto_allowed_days ??
    [1, 2, 3, 4, 5];
  const startDateRaw =
    normalizeDateInput(body?.startDate ?? body?.autoStartDate) ??
    taskRow.auto_start_date ??
    new Date().toISOString().slice(0, 10);

  const dueDate = toDateMidnight(taskRow.due_date);
  const startDate = toDateMidnight(startDateRaw);

  if (!startDate || !dueDate) {
    return NextResponse.json(
      { error: "Invalid scheduling range" },
      { status: 400 },
    );
  }

  if (startDate.getTime() > dueDate.getTime()) {
    return NextResponse.json(
      { error: "Start date must be before the due date" },
      { status: 400 },
    );
  }

  const replaceExisting = body?.replaceExisting !== false;
  if (replaceExisting) {
    await sb
      .from("task_calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("task_id", taskRow.id)
      .eq("event_kind", "auto_plan");
  }

  const rangeEnd = new Date(dueDate);
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  const { data: existingEvents } = await sb
    .from("task_calendar_events")
    .select(TASK_CALENDAR_EVENT_COLUMNS)
    .eq("user_id", userId)
    .gte("start_at", startDate.toISOString())
    .lt("start_at", rangeEnd.toISOString());

  const dayMinutes = new Map<string, number>();
  (existingEvents ?? []).forEach((row) => {
    const event = row as TaskCalendarEventRow;
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const minutes = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    const key = formatDateKey(start);
    const previous = dayMinutes.get(key) ?? 0;
    dayMinutes.set(key, previous + minutes);
  });

  const blocksNeeded = Math.ceil(
    taskRow.estimated_minutes / Math.max(15, blockDuration),
  );
  let blocksPlaced = 0;

  const createdPayloads: Array<{
    start_at: string;
    end_at: string;
  }> = [];

  const workingDate = new Date(startDate);
  while (
    workingDate.getTime() <= dueDate.getTime() &&
    blocksPlaced < blocksNeeded
  ) {
    const weekday = workingDate.getDay();
    if (allowedDays.includes(weekday)) {
      const dateKey = formatDateKey(workingDate);
      let minutesUsed = dayMinutes.get(dateKey) ?? 0;
      let slotStart = STUDY_BLOCK_DAY_START_MINUTES;

      while (blocksPlaced < blocksNeeded) {
        if (minutesUsed + blockDuration > maxDailyMinutes) break;
        if (slotStart + blockDuration > STUDY_BLOCK_DAY_END_MINUTES) break;
        const start = new Date(workingDate);
        start.setHours(0, 0, 0, 0);
        start.setMinutes(slotStart);
        const end = new Date(start);
        end.setMinutes(start.getMinutes() + blockDuration);

        createdPayloads.push({
          start_at: start.toISOString(),
          end_at: end.toISOString(),
        });
        blocksPlaced += 1;
        minutesUsed += blockDuration;
        slotStart += blockDuration + STUDY_BLOCK_GAP_MINUTES;
      }

      dayMinutes.set(dateKey, minutesUsed);
    }
    workingDate.setDate(workingDate.getDate() + 1);
  }

  let insertedEvents: TaskCalendarEventRow[] = [];
  if (createdPayloads.length) {
    const { data } = await sb
      .from("task_calendar_events")
      .insert(
        createdPayloads.map((payload) => ({
          user_id: userId,
          task_id: taskRow.id,
          title: `${taskRow.title} study block`,
          start_at: payload.start_at,
          end_at: payload.end_at,
          color: resolveCategoryColor(taskRow.category),
          event_kind: "auto_plan",
        })),
      )
      .select(TASK_CALENDAR_EVENT_COLUMNS);
    insertedEvents = (data ?? []) as TaskCalendarEventRow[];
  }

  const { data: updatedTask } = await sb
    .from("task_items")
    .update({
      auto_planned: true,
      auto_block_duration_min: blockDuration,
      auto_daily_max_minutes: maxDailyMinutes,
      auto_start_date: formatDateKey(startDate),
      auto_allowed_days: allowedDays,
    })
    .eq("user_id", userId)
    .eq("id", taskRow.id)
    .select(TASK_ITEM_COLUMNS)
    .maybeSingle();

  const overloadedDays = Array.from(dayMinutes.entries())
    .filter(([, minutes]) => minutes > TASK_DAILY_MINUTES_LIMIT)
    .map(([date, minutes]) => ({ date, minutes }));

  return NextResponse.json({
    task: updatedTask ? serializeTask(updatedTask as TaskItemRow) : serializeTask(taskRow),
    createdEvents: insertedEvents.map((row) =>
      serializeCalendarEvent(row),
    ),
    remainingBlocks: Math.max(0, blocksNeeded - blocksPlaced),
    overloadedDays,
  });
}
