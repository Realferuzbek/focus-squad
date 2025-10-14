import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  ensureParticipant,
  fetchThreadById,
  fetchThreadByUserId,
  isDmAdmin,
  mapMessage,
} from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const bodySchema = z.object({
  threadId: z.string().uuid().optional(),
  text: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message too long"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    payload = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userId = user.id as string;
  const admin = isDmAdmin(user);

  try {
    let threadId: string | null = null;
    if (admin && payload.threadId) {
      const thread = await fetchThreadById(payload.threadId);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
      threadId = thread.id;
    } else {
      const thread = await fetchThreadByUserId(userId);
      if (!thread) {
        return NextResponse.json(
          { error: "Thread not started" },
          { status: 400 },
        );
      }
      if (!admin && thread.user_id !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      threadId = thread.id;
    }

    const sb = supabaseAdmin();

    await ensureParticipant(threadId, userId, admin ? "dm_admin" : "member");

    const { data, error } = await sb
      .from("dm_messages")
      .insert({
        thread_id: threadId,
        author_id: userId,
        kind: "text",
        text: payload.text.trim(),
      })
      .select(
        "id,thread_id,author_id,kind,text,file_url,file_mime,file_bytes,edited_at,created_at",
      )
      .single();

    if (error || !data) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 },
      );
    }

    const nowIso = new Date().toISOString();
    await sb
      .from("dm_threads")
      .update({ last_message_at: nowIso })
      .eq("id", threadId);

    await sb
      .from("dm_receipts")
      .upsert({ thread_id: threadId, user_id: userId, last_read_at: nowIso, typing: false });

    return NextResponse.json({ message: mapMessage(data) });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}

