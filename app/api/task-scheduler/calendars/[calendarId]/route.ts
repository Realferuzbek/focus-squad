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
  normalizeBoolean,
  normalizeCalendarName,
  normalizeHexColor,
} from "@/lib/taskSchedulerValidation";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

function hasProp(body: any, key: string) {
  return body && Object.prototype.hasOwnProperty.call(body, key);
}

function normalizeSortOrder(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { calendarId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: existing, error: existingError } = await sb
    .from("task_calendars")
    .select(TASK_CALENDAR_COLUMNS)
    .eq("user_id", userId)
    .eq("id", params.calendarId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Calendar not found" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};
  let shouldClearOtherDefaults = false;

  if (hasProp(body, "name")) {
    const name = normalizeCalendarName(body.name);
    if (!name) {
      return NextResponse.json(
        { error: "Calendar name is required" },
        { status: 400 },
      );
    }
    updates.name = name;
  }

  if (hasProp(body, "color")) {
    const color = normalizeHexColor(body.color);
    if (!color) {
      return NextResponse.json(
        { error: "Color must be a hex value like #7c3aed" },
        { status: 400 },
      );
    }
    updates.color = color;
  }

  if (hasProp(body, "isDefault")) {
    const isDefault = normalizeBoolean(body.isDefault);
    if (isDefault === null) {
      return NextResponse.json(
        { error: "Invalid default flag" },
        { status: 400 },
      );
    }
    updates.is_default = isDefault;
    shouldClearOtherDefaults = isDefault;
  }

  if (hasProp(body, "isVisible")) {
    const isVisible = normalizeBoolean(body.isVisible);
    if (isVisible === null) {
      return NextResponse.json(
        { error: "Invalid visibility flag" },
        { status: 400 },
      );
    }
    updates.is_visible = isVisible;
  }

  if (hasProp(body, "sortOrder")) {
    const sortOrder = normalizeSortOrder(body.sortOrder);
    if (sortOrder === null) {
      return NextResponse.json(
        { error: "Invalid sort order" },
        { status: 400 },
      );
    }
    updates.sort_order = sortOrder;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      calendar: serializeCalendar(existing as TaskCalendarRow),
    });
  }

  const { data, error } = await sb
    .from("task_calendars")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", params.calendarId)
    .select(TASK_CALENDAR_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to update calendar" },
      { status: 500 },
    );
  }

  if (shouldClearOtherDefaults) {
    const { error: clearError } = await sb
      .from("task_calendars")
      .update({ is_default: false })
      .eq("user_id", userId)
      .neq("id", params.calendarId);

    if (clearError) {
      return NextResponse.json(
        { error: clearError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    calendar: serializeCalendar(data as TaskCalendarRow),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { calendarId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: calendar, error: calendarError } = await sb
    .from("task_calendars")
    .select("id,is_default")
    .eq("user_id", userId)
    .eq("id", params.calendarId)
    .maybeSingle();

  if (calendarError) {
    return NextResponse.json(
      { error: calendarError.message },
      { status: 500 },
    );
  }
  if (!calendar) {
    return NextResponse.json(
      { error: "Calendar not found" },
      { status: 404 },
    );
  }

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
  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      {
        error: "You can't delete your last calendar. Rename it instead.",
      },
      { status: 400 },
    );
  }

  let defaultCalendarId: string | null = null;
  const { data: defaultCalendar, error: defaultError } = await sb
    .from("task_calendars")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (defaultError) {
    return NextResponse.json(
      { error: defaultError.message },
      { status: 500 },
    );
  }

  defaultCalendarId = defaultCalendar?.id ?? null;

  if (!defaultCalendarId || defaultCalendarId === params.calendarId) {
    const { data: replacement, error: replacementError } = await sb
      .from("task_calendars")
      .select("id")
      .eq("user_id", userId)
      .neq("id", params.calendarId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (replacementError) {
      return NextResponse.json(
        { error: replacementError.message },
        { status: 500 },
      );
    }
    if (!replacement) {
      return NextResponse.json(
        { error: "Unable to find a replacement calendar" },
        { status: 500 },
      );
    }

    const { error: setDefaultError } = await sb
      .from("task_calendars")
      .update({ is_default: true })
      .eq("user_id", userId)
      .eq("id", replacement.id);

    if (setDefaultError) {
      return NextResponse.json(
        { error: setDefaultError.message },
        { status: 500 },
      );
    }

    const { error: clearDefaultsError } = await sb
      .from("task_calendars")
      .update({ is_default: false })
      .eq("user_id", userId)
      .neq("id", replacement.id);

    if (clearDefaultsError) {
      return NextResponse.json(
        { error: clearDefaultsError.message },
        { status: 500 },
      );
    }

    defaultCalendarId = replacement.id;
  }

  if (!defaultCalendarId) {
    return NextResponse.json(
      { error: "No default calendar available" },
      { status: 500 },
    );
  }

  const { error: reassignError } = await sb
    .from("task_calendar_events")
    .update({ calendar_id: defaultCalendarId })
    .eq("user_id", userId)
    .eq("calendar_id", params.calendarId);

  if (reassignError) {
    return NextResponse.json(
      { error: reassignError.message },
      { status: 500 },
    );
  }

  const { error: deleteError } = await sb
    .from("task_calendars")
    .delete()
    .eq("user_id", userId)
    .eq("id", params.calendarId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    deletedCalendarId: params.calendarId,
    reassignedCalendarId: defaultCalendarId,
  });
}
