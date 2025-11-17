export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_ITEM_COLUMNS,
  fetchTaskRow,
  serializeTask,
  syncTaskCalendarEvent,
  ensurePrivateItemOwnership,
  type TaskItemRow,
} from "@/lib/taskSchedulerServer";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskCalendarEvent,
} from "@/lib/taskSchedulerTypes";
import {
  normalizeDateInput,
  normalizeEnum,
  normalizeEstimatedMinutes,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = params.taskId;
  const sb = supabaseAdmin();
  const existingRow = await fetchTaskRow(sb, userId, taskId);
  if (!existingRow) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};
  let shouldSyncEvent = false;

  if (hasProp(body, "title")) {
    const nextTitle =
      typeof body.title === "string" ? body.title.trim() : "";
    if (!nextTitle) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 },
      );
    }
    updates.title = nextTitle;
    shouldSyncEvent = true;
  }

  if (hasProp(body, "description")) {
    updates.description = normalizeOptionalString(body.description);
  }

  if (hasProp(body, "status")) {
    const nextStatus = normalizeEnum(body.status, TASK_STATUSES);
    if (!nextStatus) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 },
      );
    }
    updates.status = nextStatus;
  }

  if (hasProp(body, "priority")) {
    const nextPriority = normalizeEnum(body.priority, TASK_PRIORITIES);
    if (!nextPriority) {
      return NextResponse.json(
        { error: "Invalid priority" },
        { status: 400 },
      );
    }
    updates.priority = nextPriority;
  }

  if (hasProp(body, "category")) {
    updates.category = normalizeOptionalString(body.category);
    shouldSyncEvent = true;
  }

  if (hasProp(body, "dueDate") || hasProp(body, "due_date")) {
    const raw = body?.dueDate ?? body?.due_date;
    if (raw === null || raw === "") {
      updates.due_date = null;
    } else {
      const normalized = normalizeDateInput(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: "Invalid due date" },
          { status: 400 },
        );
      }
      updates.due_date = normalized;
    }
  }

  const hasScheduleField =
    hasProp(body, "scheduledStart") ||
    hasProp(body, "scheduledEnd") ||
    hasProp(body, "scheduled_start") ||
    hasProp(body, "scheduled_end");
  if (hasScheduleField) {
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
    updates.scheduled_start = schedule.start;
    updates.scheduled_end = schedule.end;
    shouldSyncEvent = true;
  }

  if (hasProp(body, "privateItemId") || hasProp(body, "private_item_id")) {
    const nextPrivateId = body?.privateItemId ?? body?.private_item_id;
    if (typeof nextPrivateId !== "string" || !nextPrivateId.trim()) {
      return NextResponse.json(
        { error: "Invalid list" },
        { status: 400 },
      );
    }
    const hasAccess = await ensurePrivateItemOwnership(
      sb,
      userId,
      nextPrivateId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    updates.private_item_id = nextPrivateId;
  }

  if (hasProp(body, "estimatedMinutes") || hasProp(body, "estimated_minutes")) {
    const raw = body?.estimatedMinutes ?? body?.estimated_minutes;
    if (raw === null || raw === "") {
      updates.estimated_minutes = null;
    } else {
      const normalized = normalizeEstimatedMinutes(raw);
      if (normalized === null) {
        return NextResponse.json(
          { error: "Invalid estimate" },
          { status: 400 },
        );
      }
      updates.estimated_minutes = normalized;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ task: serializeTask(existingRow), linkedEvent: null });
  }

  const { data, error } = await sb
    .from("task_items")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", taskId)
    .select(TASK_ITEM_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to update task" },
      { status: 500 },
    );
  }

  const row = data as TaskItemRow;
  const task = serializeTask(row);
  let linkedEvent: TaskCalendarEvent | null = null;
  if (shouldSyncEvent) {
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("task_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", params.taskId)
    .select("id")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
