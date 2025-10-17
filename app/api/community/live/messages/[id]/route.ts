import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { appendAuditDirect } from "@/lib/live/admin";
import { isLiveMember, mapLiveMessage } from "@/lib/live/server";

const SELECT_FIELDS =
  "id,author_id,kind,text,file_path,file_mime,file_bytes,created_at,author:users!live_messages_author_id_fkey(display_name,avatar_url)";

type RouteParams = {
  params: {
    id: string;
  };
};

const updateSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message too long"),
});

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messageId = Number(params.id);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  try {
    const joined = await isLiveMember(sb, user.id as string);
    if (!joined) {
      return NextResponse.json({ error: "Join required" }, { status: 403 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to verify membership" },
      { status: 500 },
    );
  }

  const { data: existing, error: fetchError } = await sb
    .from("live_messages")
    .select("id,author_id,text")
    .eq("id", messageId)
    .maybeSingle();

  if (fetchError) {
    console.error(fetchError);
    return NextResponse.json(
      { error: "Failed to load message" },
      { status: 500 },
    );
  }

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.author_id !== (user.id as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error, count } = await sb
    .from("live_messages")
    .delete({ count: "exact" })
    .eq("id", messageId)
    .eq("author_id", user.id as string);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 },
    );
  }

  if (!count) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await appendAuditDirect(user.id as string, {
      action: "message.delete",
      targetUser: existing.author_id,
      messageId,
      fromText: existing.text ?? null,
      toText: null,
    });
  } catch (auditError) {
    console.error("message.delete audit", auditError);
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messageId = Number(params.id);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  let body: z.infer<typeof updateSchema>;
  try {
    body = updateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  try {
    const joined = await isLiveMember(sb, user.id as string);
    if (!joined) {
      return NextResponse.json({ error: "Join required" }, { status: 403 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to verify membership" },
      { status: 500 },
    );
  }

  const { data: existing, error: fetchError } = await sb
    .from("live_messages")
    .select("id,author_id,text")
    .eq("id", messageId)
    .maybeSingle();

  if (fetchError) {
    console.error(fetchError);
    return NextResponse.json(
      { error: "Failed to load message" },
      { status: 500 },
    );
  }

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.author_id !== (user.id as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const trimmed = body.text.trim();
  if ((existing.text ?? "").trim() === trimmed) {
    return NextResponse.json({ ok: true });
  }

  const { data: updated, error } = await sb
    .from("live_messages")
    .update({ text: trimmed })
    .eq("id", messageId)
    .eq("author_id", user.id as string)
    .select(SELECT_FIELDS)
    .single();

  if (error || !updated) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 },
    );
  }

  try {
    await appendAuditDirect(user.id as string, {
      action: "message.edit",
      targetUser: existing.author_id,
      messageId,
      fromText: existing.text ?? null,
      toText: trimmed,
    });
  } catch (auditError) {
    console.error("message.edit audit", auditError);
  }

  return NextResponse.json({ message: mapLiveMessage(updated) });
}
