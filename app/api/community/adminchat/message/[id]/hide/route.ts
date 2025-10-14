import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchThreadById, fetchThreadByUserId, isDmAdmin } from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

type RouteParams = {
  params: { id: string };
};

function buildMessagePreview(kind: string, text: string | null) {
  const trimmed = text?.trim();
  if (trimmed) {
    return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
  }
  switch (kind) {
    case "image":
      return "[image]";
    case "video":
      return "[video]";
    case "audio":
      return "[audio]";
    case "file":
      return "[file]";
    default:
      return "Message hidden";
  }
}

export async function POST(_: Request, { params }: RouteParams) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!params?.id) {
    return NextResponse.json({ error: "Message id required" }, { status: 400 });
  }

  const userId = user.id as string;
  const admin = isDmAdmin(user);
  const messageId = params.id;

  try {
    const sb = supabaseAdmin();
    const { data: messageRow, error } = await sb
      .from("dm_messages")
      .select("id,thread_id,kind,text")
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

    const thread = await fetchThreadById(messageRow.thread_id);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (!admin) {
      const userThread = await fetchThreadByUserId(userId);
      if (!userThread || userThread.id !== thread.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { error: upsertError } = await sb
      .from("dm_message_visibility")
      .upsert(
        {
          message_id: messageId,
          user_id: userId,
          hidden: true,
        },
        { onConflict: "message_id,user_id" },
      );

    if (upsertError) {
      console.error(upsertError);
      return NextResponse.json(
        { error: "Failed to update visibility" },
        { status: 500 },
      );
    }

    const preview = buildMessagePreview(messageRow.kind, messageRow.text ?? null);
    const { error: auditError } = await sb.from("dm_audit").insert({
      thread_id: messageRow.thread_id,
      actor_id: userId,
      action: "message_delete_soft",
      target_id: messageId,
      meta: { kind: messageRow.kind, preview, scope: "self" },
    });
    if (auditError) {
      console.error(auditError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}
