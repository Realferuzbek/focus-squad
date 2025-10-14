import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  fetchThreadById,
  fetchThreadByUserId,
  isDmAdmin,
  mapMessage,
} from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const bodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message too long"),
});

type RouteParams = {
  params: { id: string };
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!params?.id) {
    return NextResponse.json({ error: "Message id required" }, { status: 400 });
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
  const messageId = params.id;

  try {
    const sb = supabaseAdmin();
    const { data: messageRow, error } = await sb
      .from("dm_messages")
      .select("id,thread_id,author_id")
      .eq("id", messageId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to load message" },
        { status: 500 },
      );
    }

    if (!messageRow) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (messageRow.author_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (admin && payload.text.length === 0) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const thread = await fetchThreadById(messageRow.thread_id);
    const userThread = await fetchThreadByUserId(userId);

    if (!admin) {
      if (!thread || !userThread || thread.id !== userThread.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data: updated, error: updateError } = await sb
      .from("dm_messages")
      .update({
        text: payload.text,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .select(
        "id,thread_id,author_id,kind,text,file_url,file_mime,file_bytes,edited_at,created_at",
      )
      .single();

    if (updateError || !updated) {
      console.error(updateError);
      return NextResponse.json(
        { error: "Failed to update message" },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: mapMessage(updated) });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}

