import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAiChatEnabled, setAiChatEnabled } from "@/lib/featureFlags";

type AdminUser = { id: string; is_admin?: boolean } | undefined;

async function requireAdmin(): Promise<AdminUser> {
  const session = await auth();
  const user = session?.user as AdminUser;
  return user?.is_admin ? user : undefined;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isAiChatEnabled(true);
  return NextResponse.json({ enabled });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;
  if (enabled === null) {
    return NextResponse.json({ error: "Missing enabled boolean" }, { status: 400 });
  }

  await setAiChatEnabled(enabled, user.id);
  return NextResponse.json({ enabled });
}
