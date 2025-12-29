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
  normalizeHabitTarget,
  normalizeOptionalString,
  normalizeResource,
  normalizeTimeMinutes,
  normalizeWeekdayArray,
} from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

async function ensureHabitList(
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
  if ((data as any).list_type !== "habit_tracker") {
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
    return NextResponse.json({ habits: [] }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const listCheck = await ensureHabitList(sb, userId, params.privateItemId);
  if (!listCheck.ok) {
    return NextResponse.json(
      { error: listCheck.message },
      { status: listCheck.status },
    );
  }

  const { data, error } = await sb
    .from("task_habits")
    .select(TASK_HABIT_COLUMNS)
    .eq("user_id", userId)
    .eq("private_item_id", params.privateItemId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as TaskHabitRow[];
  return NextResponse.json({ habits: rows.map(serializeHabit) });
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
  const listCheck = await ensureHabitList(sb, userId, params.privateItemId);
  if (!listCheck.ok) {
    return NextResponse.json(
      { error: listCheck.message },
      { status: listCheck.status },
    );
  }

  const body = await req.json().catch(() => ({}));
  const nameInput = typeof body?.name === "string" ? body.name.trim() : "";
  if (!nameInput) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 },
    );
  }

  const scheduleType =
    normalizeEnum(
      body?.scheduleType ?? body?.schedule_type,
      HABIT_SCHEDULE_TYPES,
      "daily",
    ) || "daily";
  const scheduleDays =
    scheduleType === "custom"
      ? normalizeWeekdayArray(body?.scheduleDays ?? body?.schedule_days)
      : null;
  if (scheduleType === "custom" && !scheduleDays) {
    return NextResponse.json(
      { error: "Select at least one day" },
      { status: 400 },
    );
  }

  let status = "planned";
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const normalized = normalizeEnum(body?.status, HABIT_STATUSES);
    if (!normalized) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 },
      );
    }
    status = normalized;
  }

  let target: string | null = null;
  if (Object.prototype.hasOwnProperty.call(body, "target")) {
    const raw = body?.target;
    if (raw === null || raw === "") {
      target = null;
    } else {
      const normalized = normalizeHabitTarget(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: "Invalid target" },
          { status: 400 },
        );
      }
      target = normalized;
    }
  }
  const notes = normalizeOptionalString(body?.notes);
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
  const startDateRaw = body?.startDate ?? body?.start_date;
  const startDate = startDateRaw ? normalizeDateInput(startDateRaw) : null;
  if (startDateRaw && !startDate) {
    return NextResponse.json(
      { error: "Invalid start date" },
      { status: 400 },
    );
  }

  const scheduleStart = normalizeTimeMinutes(
    body?.scheduleStartTime ?? body?.schedule_start_time,
  );
  const scheduleEnd = normalizeTimeMinutes(
    body?.scheduleEndTime ?? body?.schedule_end_time,
  );
  if (
    (scheduleStart !== null && scheduleEnd === null) ||
    (scheduleStart === null && scheduleEnd !== null)
  ) {
    return NextResponse.json(
      { error: "Start and end time are required" },
      { status: 400 },
    );
  }
  if (scheduleStart !== null && scheduleEnd !== null && scheduleEnd <= scheduleStart) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
    );
  }

  const insertPayload: Record<string, any> = {
    user_id: userId,
    private_item_id: params.privateItemId,
    name: nameInput,
    schedule_type: scheduleType,
    schedule_days: scheduleDays,
    status,
    target,
    notes,
    resource_url: resourceUrl,
    schedule_start_time: scheduleStart,
    schedule_end_time: scheduleEnd,
  };
  if (startDate) {
    insertPayload.start_date = startDate;
  }

  const { data, error } = await sb
    .from("task_habits")
    .insert(insertPayload)
    .select(TASK_HABIT_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to create habit" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    habit: serializeHabit(data as TaskHabitRow),
  });
}
