export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_HABIT_COLUMNS,
  serializeHabit,
  type TaskHabitRow,
} from "@/lib/taskSchedulerServer";
import {
  HABIT_SCHEDULE_TYPES,
  HABIT_STATUSES,
} from "@/lib/taskSchedulerTypes";
import {
  normalizeDateInput,
  normalizeEnum,
  normalizeEstimatedMinutes,
  normalizeOptionalString,
  normalizeWeekdayArray,
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
  { params }: { params: { habitId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};

  if (hasProp(body, "name")) {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 },
      );
    }
    updates.name = name;
  }

  let scheduleType: string | null = null;
  if (hasProp(body, "scheduleType") || hasProp(body, "schedule_type")) {
    scheduleType =
      normalizeEnum(
        body?.scheduleType ?? body?.schedule_type,
        HABIT_SCHEDULE_TYPES,
      ) ?? null;
    if (!scheduleType) {
      return NextResponse.json(
        { error: "Invalid schedule" },
        { status: 400 },
      );
    }
    updates.schedule_type = scheduleType;
  }

  if (hasProp(body, "scheduleDays") || hasProp(body, "schedule_days")) {
    const days = normalizeWeekdayArray(
      body?.scheduleDays ?? body?.schedule_days,
    );
    updates.schedule_days = days;
  }

  if (hasProp(body, "status")) {
    const status = normalizeEnum(body?.status, HABIT_STATUSES);
    if (!status) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 },
      );
    }
    updates.status = status;
  }

  if (hasProp(body, "target")) {
    updates.target = normalizeEstimatedMinutes(body?.target);
  }

  if (hasProp(body, "notes")) {
    updates.notes = normalizeOptionalString(body?.notes);
  }

  if (hasProp(body, "resourceUrl") || hasProp(body, "resource_url")) {
    updates.resource_url = normalizeOptionalString(
      body?.resourceUrl ?? body?.resource_url,
    );
  }

  if (hasProp(body, "startDate") || hasProp(body, "start_date")) {
    const raw = body?.startDate ?? body?.start_date;
    if (raw === null || raw === "") {
      return NextResponse.json(
        { error: "Start date is required" },
        { status: 400 },
      );
    }
    const startDate = normalizeDateInput(raw);
    if (!startDate) {
      return NextResponse.json(
        { error: "Invalid start date" },
        { status: 400 },
      );
    }
    updates.start_date = startDate;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates provided" },
      { status: 400 },
    );
  }

  if (scheduleType && scheduleType !== "custom") {
    updates.schedule_days = null;
  } else if (scheduleType === "custom" && !updates.schedule_days) {
    return NextResponse.json(
      { error: "Select at least one day" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_habits")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", params.habitId)
    .select(TASK_HABIT_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  return NextResponse.json({ habit: serializeHabit(data as TaskHabitRow) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { habitId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("task_habits")
    .delete()
    .eq("user_id", userId)
    .eq("id", params.habitId)
    .select("id")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
