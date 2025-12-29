export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

type HabitCompletionRow = {
  id: string;
  habit_id: string;
  date_key: string;
  value: string;
  completed_at: string;
};

const HABIT_COMPLETION_COLUMNS = "id,habit_id,date_key,value,completed_at";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

function isDateKey(value: string | null) {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function serializeCompletion(row: HabitCompletionRow) {
  return {
    id: row.id,
    habitId: row.habit_id,
    dateKey: row.date_key,
    value: row.value,
    completedAt: row.completed_at,
  };
}

async function ensureHabitAccess(
  sb: ReturnType<typeof supabaseAdmin>,
  userId: string,
  habitId: string,
) {
  const { data: habitRow, error: habitError } = await sb
    .from("task_habits")
    .select("id")
    .eq("user_id", userId)
    .eq("id", habitId)
    .maybeSingle();
  if (habitError) {
    return { ok: false, status: 500, message: habitError.message } as const;
  }
  if (habitRow) {
    return { ok: true } as const;
  }

  const { data, error } = await sb
    .from("task_items")
    .select("id,category")
    .eq("user_id", userId)
    .eq("id", habitId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, message: error.message } as const;
  }
  if (!data) {
    return { ok: false, status: 404, message: "Habit not found" } as const;
  }
  if (data.category !== "habit") {
    return { ok: false, status: 400, message: "Task is not a habit" } as const;
  }
  return { ok: true } as const;
}

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ completions: [] }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("startDate") ?? searchParams.get("start");
  const end = searchParams.get("endDate") ?? searchParams.get("end");

  if (!isDateKey(start) || !isDateKey(end)) {
    return NextResponse.json(
      { error: "Invalid date range" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_habit_completions")
    .select(HABIT_COMPLETION_COLUMNS)
    .eq("user_id", userId)
    .gte("date_key", start)
    .lte("date_key", end)
    .order("date_key", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as HabitCompletionRow[];
  return NextResponse.json({ completions: rows.map(serializeCompletion) });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const habitId =
    typeof body?.habitId === "string" ? body.habitId.trim() : "";
  const dateKey =
    typeof body?.dateKey === "string" ? body.dateKey.trim() : "";
  const valueRaw = body?.value;
  let value = "yes";
  if (valueRaw !== undefined && valueRaw !== null) {
    const normalized = typeof valueRaw === "string" ? valueRaw.trim().toLowerCase() : "";
    if (normalized !== "yes" && normalized !== "no") {
      return NextResponse.json(
        { error: "Invalid completion value" },
        { status: 400 },
      );
    }
    value = normalized;
  }

  if (!habitId || !isDateKey(dateKey)) {
    return NextResponse.json(
      { error: "Invalid completion payload" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const habitCheck = await ensureHabitAccess(sb, userId, habitId);
  if (!habitCheck.ok) {
    return NextResponse.json(
      { error: habitCheck.message },
      { status: habitCheck.status },
    );
  }

  const { data, error } = await sb
    .from("task_habit_completions")
    .upsert(
      {
        user_id: userId,
        habit_id: habitId,
        date_key: dateKey,
        value,
      },
      { onConflict: "user_id,habit_id,date_key" },
    )
    .select(HABIT_COMPLETION_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to save completion" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    completion: serializeCompletion(data as HabitCompletionRow),
  });
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const habitId =
    typeof body?.habitId === "string" ? body.habitId.trim() : "";
  const dateKey =
    typeof body?.dateKey === "string" ? body.dateKey.trim() : "";

  if (!habitId || !isDateKey(dateKey)) {
    return NextResponse.json(
      { error: "Invalid completion payload" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_habit_completions")
    .delete()
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("date_key", dateKey)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, removed: !!data });
}
