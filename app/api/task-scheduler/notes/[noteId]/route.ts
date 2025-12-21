export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

type TaskNoteRow = {
  id: string;
  user_id: string;
  text: string;
  pinned: boolean;
  converted_task_id: string | null;
  created_at: string;
  updated_at: string;
};

const NOTE_COLUMNS =
  "id,user_id,text,pinned,converted_task_id,created_at,updated_at";

async function requireUserId() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  return typeof id === "string" ? id : null;
}

function hasProp(body: any, key: string) {
  return body && Object.prototype.hasOwnProperty.call(body, key);
}

function serializeNote(row: TaskNoteRow) {
  return {
    id: row.id,
    text: row.text,
    pinned: row.pinned ?? false,
    convertedTaskId: row.converted_task_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { noteId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};

  if (hasProp(body, "pinned")) {
    updates.pinned = Boolean(body.pinned);
  }

  if (
    hasProp(body, "convertedTaskId") ||
    hasProp(body, "converted_task_id")
  ) {
    const raw = body?.convertedTaskId ?? body?.converted_task_id;
    if (raw === null || raw === "") {
      updates.converted_task_id = null;
    } else if (typeof raw === "string") {
      updates.converted_task_id = raw;
    } else {
      return NextResponse.json(
        { error: "Invalid converted task" },
        { status: 400 },
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates provided" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_notes")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", params.noteId)
    .select(NOTE_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ note: serializeNote(data as TaskNoteRow) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { noteId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("task_notes")
    .delete()
    .eq("user_id", userId)
    .eq("id", params.noteId)
    .select("id")
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
