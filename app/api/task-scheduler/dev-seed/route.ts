export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_PRIVATE_ITEM_COLUMNS,
  type TaskPrivateItemRow,
} from "@/lib/taskSchedulerServer";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

function isoDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: existing } = await sb
    .from("task_private_items")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, seeded: false });
  }

  const { data: lists, error: listError } = await sb
    .from("task_private_items")
    .insert([
      {
        user_id: userId,
        title: "Planner Tasks",
        kind: "task_list",
        list_type: "planner_tasks",
        hidden_columns: [],
      },
      {
        user_id: userId,
        title: "Habit Tracker",
        kind: "task_list",
        list_type: "habit_tracker",
        hidden_columns: [],
      },
    ])
    .select(TASK_PRIVATE_ITEM_COLUMNS);

  if (listError || !lists || lists.length < 2) {
    return NextResponse.json(
      { error: listError?.message || "Failed to seed lists" },
      { status: 500 },
    );
  }

  const rows = lists as TaskPrivateItemRow[];
  const plannerList = rows.find((row) => row.list_type === "planner_tasks");
  const habitList = rows.find((row) => row.list_type === "habit_tracker");

  if (!plannerList || !habitList) {
    return NextResponse.json(
      { error: "Failed to resolve demo lists" },
      { status: 500 },
    );
  }

  const dueTomorrow = isoDateOffset(1);
  const dueNextWeek = isoDateOffset(6);

  const { error: taskError } = await sb.from("task_items").insert([
    {
      user_id: userId,
      private_item_id: plannerList.id,
      title: "Outline biology essay",
      description: "Draft intro + key sources.",
      status: "not_started",
      priority: "medium",
      category: "assignment",
      subject: "IELTS",
      due_date: dueTomorrow,
      due_at: new Date(`${dueTomorrow}T10:00:00Z`).toISOString(),
      estimated_minutes: 60,
      resource_url: "https://example.com/outline",
    },
    {
      user_id: userId,
      private_item_id: plannerList.id,
      title: "Physics mock exam",
      description: "Past paper timed session.",
      status: "in_progress",
      priority: "high",
      category: "exam",
      subject: "Physics",
      due_date: dueNextWeek,
      due_at: new Date(`${dueNextWeek}T09:30:00Z`).toISOString(),
      estimated_minutes: 90,
      resource_url: null,
    },
  ]);

  if (taskError) {
    return NextResponse.json(
      { error: taskError.message },
      { status: 500 },
    );
  }

  const { data: habits, error: habitError } = await sb
    .from("task_habits")
    .insert([
      {
        user_id: userId,
        private_item_id: habitList.id,
        name: "Morning review",
        schedule_type: "daily",
        schedule_days: null,
        status: "active",
        target: 20,
        notes: "20 min recap every morning.",
        resource_url: null,
        start_date: isoDateOffset(-10),
      },
      {
        user_id: userId,
        private_item_id: habitList.id,
        name: "Evening vocab",
        schedule_type: "weekdays",
        schedule_days: null,
        status: "active",
        target: 15,
        notes: null,
        resource_url: null,
        start_date: isoDateOffset(-14),
      },
      {
        user_id: userId,
        private_item_id: habitList.id,
        name: "Saturday mock",
        schedule_type: "custom",
        schedule_days: [6],
        status: "paused",
        target: 60,
        notes: "Paused this month.",
        resource_url: null,
        start_date: isoDateOffset(-30),
      },
    ])
    .select("id");

  if (habitError || !habits) {
    return NextResponse.json(
      { error: habitError?.message || "Failed to seed habits" },
      { status: 500 },
    );
  }

  const morningHabit = habits[0]?.id;
  if (morningHabit) {
    await sb.from("task_habit_completions").insert([
      {
        user_id: userId,
        habit_id: morningHabit,
        date_key: isoDateOffset(-2),
      },
      {
        user_id: userId,
        habit_id: morningHabit,
        date_key: isoDateOffset(-1),
      },
    ]);
  }

  await sb.from("task_notes").insert([
    {
      user_id: userId,
      text: "Remember to ask about scholarship timeline.",
      pinned: true,
    },
    {
      user_id: userId,
      text: "Review IELTS speaking cue cards.",
      pinned: false,
    },
  ]);

  return NextResponse.json({ ok: true, seeded: true });
}
