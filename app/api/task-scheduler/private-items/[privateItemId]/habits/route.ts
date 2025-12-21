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
    normalizeEnum(body?.scheduleType ?? body?.schedule_type, HABIT_SCHEDULE_TYPES, "daily") ||
    "daily";
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

  const status =
    normalizeEnum(body?.status, HABIT_STATUSES, "active") || "active";
  const target = normalizeEstimatedMinutes(body?.target);
  const notes = normalizeOptionalString(body?.notes);
  const resourceUrl = normalizeOptionalString(
    body?.resourceUrl ?? body?.resource_url,
  );
  const startDateRaw = body?.startDate ?? body?.start_date;
  const startDate = startDateRaw ? normalizeDateInput(startDateRaw) : null;
  if (startDateRaw && !startDate) {
    return NextResponse.json(
      { error: "Invalid start date" },
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
