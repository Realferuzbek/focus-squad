import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  fetchThreadById,
  fetchThreadByUserId,
  isDmAdmin,
  mapThread,
} from "@/lib/adminchat/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id as string;
  const admin = isDmAdmin(user);
  const threadIdParam = req.nextUrl.searchParams.get("threadId");

  try {
    let thread = null;

    if (admin && threadIdParam) {
      thread = await fetchThreadById(threadIdParam);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
    } else {
      thread = await fetchThreadByUserId(userId);
      if (!thread) {
        return NextResponse.json({ thread: null });
      }
    }

    if (!admin && thread.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ thread: mapThread(thread) });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}

