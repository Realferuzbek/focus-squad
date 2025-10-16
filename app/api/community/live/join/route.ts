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
  const { error } = await sb
    .from("live_members")
    .upsert({ user_id: user.id as string }, { onConflict: "user_id" });

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to join live stream" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
