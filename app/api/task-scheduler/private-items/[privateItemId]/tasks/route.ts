export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_ITEM_COLUMNS,
  serializeTask,
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
  normalizeEstimateOption,
  normalizeOptionalString,
  normalizeResource,
  normalizeTaskSubject,
  normalizeTimestampInput,
  normalizeWeekdayArray,
  validateScheduleInput,
} from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

async function ensurePlannerList(
  sb: ReturnType<typeof supabaseAdmin>,
  userId: string,
  privateItemId: string,
) {
  const { data, error } = await sb
    .from("task_private_items")
    .select("id,list_type")
    .eq("user_id", userId)
    .eq("id", privateItemId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, message: error.message } as const;
  }
  if (!data) {
    return { ok: false, status: 404, message: "List not found" } as const;
  }
  if ((data as any).list_type !== "planner_tasks") {
    return { ok: false, status: 404, message: "List not found" } as const;
  }
  return { ok: true } as const;
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
  const listCheck = await ensurePlannerList(sb, userId, params.privateItemId);
  if (!listCheck.ok) {
    return NextResponse.json(
      { error: listCheck.message },
      { status: listCheck.status },
    );
  }
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
  const listCheck = await ensurePlannerList(sb, userId, privateItemId);
  if (!listCheck.ok) {
    return NextResponse.json(
      { error: listCheck.message },
      { status: listCheck.status },
    );
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
  let status = "planned";
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const nextStatus = normalizeEnum(body?.status, TASK_STATUSES);
    if (!nextStatus) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 },
      );
    }
    status = nextStatus;
  }

  let priority = "medium";
  if (Object.prototype.hasOwnProperty.call(body, "priority")) {
    const nextPriority = normalizeEnum(body?.priority, TASK_PRIORITIES);
    if (!nextPriority) {
      return NextResponse.json(
        { error: "Invalid priority" },
        { status: 400 },
      );
    }
    priority = nextPriority;
  }
  const category =
    (normalizeEnum(body?.category, TASK_CATEGORIES, "assignment") as
      | string
      | null) ?? "assignment";
  let subject: string | null = null;
  if (Object.prototype.hasOwnProperty.call(body, "subject")) {
    const raw = body?.subject;
    if (raw === null || raw === "") {
      subject = null;
    } else {
      const normalized = normalizeTaskSubject(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: "Invalid subject" },
          { status: 400 },
        );
      }
      subject = normalized;
    }
  }

  let resourceUrl: string | null = null;
  if (
    Object.prototype.hasOwnProperty.call(body, "resourceUrl") ||
    Object.prototype.hasOwnProperty.call(body, "resource_url")
  ) {
    const raw = body?.resourceUrl ?? body?.resource_url;
    if (raw === null || raw === "") {
      resourceUrl = null;
    } else {
      const normalized = normalizeResource(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: "Invalid resource" },
          { status: 400 },
        );
      }
      resourceUrl = normalized;
    }
  }

  const dueStartRaw = body?.dueStartDate ?? body?.due_start_date;
  const dueEndRaw = body?.dueEndDate ?? body?.due_end_date;
  const dueStartDate = dueStartRaw ? normalizeDateInput(dueStartRaw) : null;
  const dueEndDate = dueEndRaw ? normalizeDateInput(dueEndRaw) : null;
  if (dueStartRaw && !dueStartDate) {
    return NextResponse.json(
      { error: "Invalid due start date" },
      { status: 400 },
    );
  }
  if (dueEndRaw && !dueEndDate) {
    return NextResponse.json(
      { error: "Invalid due end date" },
      { status: 400 },
    );
  }
  if (dueStartDate && dueEndDate && dueEndDate < dueStartDate) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 400 },
    );
  }
  const dueDateInput = normalizeDateInput(body?.dueDate ?? body?.due_date);
  const dueAtRaw = body?.dueAt ?? body?.due_at;
  let dueAt: string | null = null;
  if (dueAtRaw === null || dueAtRaw === "") {
    dueAt = null;
  } else if (typeof dueAtRaw === "string") {
    dueAt = normalizeTimestampInput(dueAtRaw);
    if (!dueAt) {
      return NextResponse.json(
        { error: "Invalid due date time" },
        { status: 400 },
      );
    }
  }
  const dueDate = dueDateInput ?? (dueAt ? dueAt.slice(0, 10) : null);
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

  let estimatedMinutes: number | null = null;
  if (
    Object.prototype.hasOwnProperty.call(body, "estimatedMinutes") ||
    Object.prototype.hasOwnProperty.call(body, "estimated_minutes")
  ) {
    const raw = body?.estimatedMinutes ?? body?.estimated_minutes;
    if (raw === null || raw === "") {
      estimatedMinutes = null;
    } else {
      const normalized = normalizeEstimateOption(raw);
      if (normalized === null) {
        return NextResponse.json(
          { error: "Invalid estimate" },
          { status: 400 },
        );
      }
      estimatedMinutes = normalized;
    }
  }
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
    subject,
    resource_url: resourceUrl,
    due_date: dueDate,
    due_at: dueAt,
    due_start_date: dueStartDate,
    due_end_date: dueEndDate,
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
