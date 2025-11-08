import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { isAiChatEnabled, setAiChatEnabled } from "@/lib/featureFlags";

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const enabled = await isAiChatEnabled(true);
  return NextResponse.json({ enabled });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const body = await req.json().catch(() => null);
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;
  if (enabled === null) {
    return NextResponse.json({ error: "Missing enabled boolean" }, { status: 400 });
  }

  const userId = typeof guard.user.id === "string" ? guard.user.id : null;
  await setAiChatEnabled(enabled, userId);
  return NextResponse.json({ enabled });
}
