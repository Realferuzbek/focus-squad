import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureUserThread, mapThread } from "@/lib/adminchat/server";

export async function POST() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id as string;

  try {
    const thread = await ensureUserThread(userId);

    return NextResponse.json({
      ok: true,
      thread: mapThread(thread),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
