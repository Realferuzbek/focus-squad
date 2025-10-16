import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { countLiveMembers, fetchLiveState } from "@/lib/live/server";

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  try {
    const [state, memberCount] = await Promise.all([
      fetchLiveState(sb),
      countLiveMembers(sb),
    ]);

    return NextResponse.json({
      isLive: state.isLive,
      memberCount,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load live state" },
      { status: 500 },
    );
  }
}
