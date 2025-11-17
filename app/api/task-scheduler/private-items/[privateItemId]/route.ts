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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { privateItemId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Title cannot be empty" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_private_items")
    .update({ title })
    .eq("user_id", userId)
    .eq("id", params.privateItemId)
    .select(TASK_PRIVATE_ITEM_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Private item not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ item: serializePrivateItem(data as TaskPrivateItemRow) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { privateItemId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("task_private_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", params.privateItemId)
    .select("id")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Private item not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
