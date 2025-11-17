export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_ITEM_COLUMNS,
  serializeTask,
  ensurePrivateItemOwnership,
  syncTaskCalendarEvent,
  type TaskItemRow,
} from "@/lib/taskSchedulerServer";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_CATEGORIES,
  TASK_REPEAT_RULES,
  type TaskCalendarEvent,
} from "@/lib/taskSchedulerTypes";
import {
  normalizeDateInput,
  normalizeEnum,
  normalizeEstimatedMinutes,
  normalizeOptionalString,
  normalizeWeekdayArray,
  validateScheduleInput,
} from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { privateItemId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ tasks: [] }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_items")
    .select(TASK_ITEM_COLUMNS)
    .eq("user_id", userId)
    .eq("private_item_id", params.privateItemId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as TaskItemRow[];
  return NextResponse.json({ tasks: rows.map(serializeTask) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { privateItemId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const privateItemId = params.privateItemId;
  const hasAccess = await ensurePrivateItemOwnership(sb, userId, privateItemId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const titleInput = typeof body?.title === "string" ? body.title.trim() : "";
  if (!titleInput) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 },
    );
  }

  const description = normalizeOptionalString(body?.description);
  const status =
    normalizeEnum(body?.status, TASK_STATUSES, "not_started") ||
    "not_started";
  const priority =
    normalizeEnum(body?.priority, TASK_PRIORITIES, "medium") || "medium";
  const category =
    (normalizeEnum(body?.category, TASK_CATEGORIES, "assignment") as
      | string
      | null) ?? "assignment";
  const dueDate = normalizeDateInput(body?.dueDate ?? body?.due_date);
  const schedule = validateScheduleInput(
    body?.scheduledStart ?? body?.scheduled_start,
    body?.scheduledEnd ?? body?.scheduled_end,
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

  const estimatedMinutes = normalizeEstimatedMinutes(
    body?.estimatedMinutes ?? body?.estimated_minutes,
  );
  const repeatRule =
    normalizeEnum(
      body?.repeatRule ?? body?.repeat_rule,
      TASK_REPEAT_RULES,
      "none",
    ) ?? "none";
  const repeatDays = normalizeWeekdayArray(
    body?.repeatDays ?? body?.repeat_days,
  );
  const repeatUntil = normalizeDateInput(
    body?.repeatUntil ?? body?.repeat_until,
  );

  const insertPayload = {
    user_id: userId,
    private_item_id: privateItemId,
    title: titleInput,
    description,
    status,
    priority,
    category,
    due_date: dueDate,
    scheduled_start: schedule.start,
    scheduled_end: schedule.end,
    estimated_minutes: estimatedMinutes,
    repeat_rule: repeatRule,
    repeat_days: repeatDays,
    repeat_until: repeatUntil,
  };

  const { data, error } = await sb
    .from("task_items")
    .insert(insertPayload)
    .select(TASK_ITEM_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to create task" },
      { status: 500 },
    );
  }

  const row = data as TaskItemRow;
  const task = serializeTask(row);
  let linkedEvent: TaskCalendarEvent | null = null;
  if (task.scheduledStart && task.scheduledEnd) {
    linkedEvent = await syncTaskCalendarEvent(sb, {
      userId,
      taskId: task.id,
      title: task.title,
      category: task.category,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    });
  }

  return NextResponse.json({ task, linkedEvent });
}
