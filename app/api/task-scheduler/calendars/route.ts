export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_CALENDAR_COLUMNS,
  serializeCalendar,
  type TaskCalendarRow,
} from "@/lib/taskSchedulerServer";
import {
  normalizeCalendarName,
  normalizeHexColor,
} from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ calendars: [] }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_calendars")
    .select(TASK_CALENDAR_COLUMNS)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as TaskCalendarRow[];
  return NextResponse.json({ calendars: rows.map(serializeCalendar) });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = normalizeCalendarName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: "Calendar name is required" },
      { status: 400 },
    );
  }

  const color = normalizeHexColor(body?.color);
  if (!color) {
    return NextResponse.json(
      { error: "Color must be a hex value like #7c3aed" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { count, error: countError } = await sb
    .from("task_calendars")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId);

  if (countError) {
    return NextResponse.json(
      { error: countError.message },
      { status: 500 },
    );
  }

  const existingCount = count ?? 0;
  const isFirst = existingCount === 0;
  const sortOrder = existingCount;

  const { data, error } = await sb
    .from("task_calendars")
    .insert({
      user_id: userId,
      name,
      color,
      is_default: isFirst,
      is_visible: true,
      sort_order: sortOrder,
    })
    .select(TASK_CALENDAR_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to create calendar" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    calendar: serializeCalendar(data as TaskCalendarRow),
  });
}
