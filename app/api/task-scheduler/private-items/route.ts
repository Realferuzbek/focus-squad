export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_PRIVATE_ITEM_COLUMNS,
  serializePrivateItem,
  type TaskPrivateItemRow,
} from "@/lib/taskSchedulerServer";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_private_items")
    .select(TASK_PRIVATE_ITEM_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as TaskPrivateItemRow[];
  const items = rows.map((row) => serializePrivateItem(row));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const titleInput = typeof body?.title === "string" ? body.title : "";
  const title = titleInput.trim() || "Untitled list";
  const kind = body?.kind === "task_list" ? "task_list" : "task_list";

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_private_items")
    .insert({
      user_id: userId,
      title,
      kind,
    })
    .select(TASK_PRIVATE_ITEM_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to create private item" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    item: serializePrivateItem(data as TaskPrivateItemRow),
  });
}
