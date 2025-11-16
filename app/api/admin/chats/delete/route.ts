export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { deleteChatLogs } from "@/lib/ai-chat/logging";

type DeleteBody = {
  chatIds?: unknown;
  userId?: unknown;
  before?: unknown;
};

export async function POST(req: Request) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.message },
      { status: guard.status },
    );
  }

  const body = (await req.json().catch(() => ({}))) as DeleteBody;
  const chatIds = Array.isArray(body.chatIds)
    ? body.chatIds.filter((id): id is string => typeof id === "string")
    : undefined;
  const userId =
    typeof body.userId === "string" && body.userId.length ? body.userId : null;
  const before =
    typeof body.before === "string" && body.before.length
      ? body.before
      : null;

  if ((!chatIds || !chatIds.length) && !userId && !before) {
    return NextResponse.json(
      { error: "Missing filters" },
      { status: 400 },
    );
  }

  await deleteChatLogs({
    chatIds: chatIds?.length ? chatIds : undefined,
    userId: userId ?? undefined,
    before: before ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
