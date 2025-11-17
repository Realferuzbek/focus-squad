export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  TASK_ITEM_COLUMNS,
  serializeTask,
  type TaskItemRow,
} from "@/lib/taskSchedulerServer";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ tasks: [] }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const privateItemId = searchParams.get("privateItemId");
  const status = searchParams.get("status");

  const sb = supabaseAdmin();
  let query = sb
    .from("task_items")
    .select(TASK_ITEM_COLUMNS)
    .eq("user_id", userId);

  if (privateItemId) {
    query = query.eq("private_item_id", privateItemId);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as TaskItemRow[];
  return NextResponse.json({ tasks: rows.map(serializeTask) });
}
