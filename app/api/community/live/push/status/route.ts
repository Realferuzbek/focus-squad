import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

const TOPIC = "live_stream_chat";

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("push_subscriptions")
    .select("meta")
    .eq("user_id", user.id as string);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load status" },
      { status: 500 },
    );
  }

  const active = (data ?? []).some((row) => {
    const topics = (row.meta as any)?.topics;
    if (!topics || typeof topics !== "object") return false;
    return !!topics[TOPIC];
  });

  return NextResponse.json({ active });
}
