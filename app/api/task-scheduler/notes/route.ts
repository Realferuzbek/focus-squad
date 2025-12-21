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

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ notes: [] }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_notes")
    .select(NOTE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as TaskNoteRow[];
  return NextResponse.json({ notes: rows.map(serializeNote) });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const textInput = typeof body?.text === "string" ? body.text.trim() : "";
  if (!textInput) {
    return NextResponse.json(
      { error: "Text is required" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("task_notes")
    .insert({
      user_id: userId,
      text: textInput,
      pinned: false,
    })
    .select(NOTE_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to create note" },
      { status: 500 },
    );
  }

  return NextResponse.json({ note: serializeNote(data as TaskNoteRow) });
}
