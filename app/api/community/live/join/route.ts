import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const userId = user.id as string;

  const { data: removal, error: removalError } = await sb
    .from("live_stream_removed")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (removalError && removalError.code !== "PGRST116") {
    console.error(removalError);
    return NextResponse.json(
      { error: "Failed to verify access" },
      { status: 500 },
    );
  }

  if (removal) {
    return NextResponse.json(
      { error: "Access to live chat has been revoked" },
      { status: 403 },
    );
  }

  const { error } = await sb
    .from("live_stream_members")
    .upsert(
      {
        user_id: userId,
        joined_at: new Date().toISOString(),
        left_at: null,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to join live stream" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
