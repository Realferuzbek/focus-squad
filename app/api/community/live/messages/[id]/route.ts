import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { isLiveMember } from "@/lib/live/server";

type RouteParams = {
  params: {
    id: string;
  };
};

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

  return NextResponse.json({ ok: true });
}
