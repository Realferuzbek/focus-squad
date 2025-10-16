import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { fetchLiveState } from "@/lib/live/server";

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  try {
    const state = await fetchLiveState(sb);

    return NextResponse.json({
      isLive: state.isLive,
      memberCount: state.subscribersCount,
      groupName: state.groupName,
      groupAvatarUrl: state.groupAvatarUrl,
      groupDescription: state.groupDescription,
      wallpaperUrl: state.wallpaperUrl,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load live state" },
      { status: 500 },
    );
  }
}
