import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDmAdmin } from "@/lib/adminchat/server";
import { listAdminThreads } from "@/lib/community/admin/server";

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !isDmAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const threads = await listAdminThreads(user.id as string);
    return NextResponse.json({ threads });
  } catch (err) {
    console.error("admin inbox fetch failed", err);
    return NextResponse.json(
      { error: "Failed to load threads" },
      { status: 500 },
    );
  }
}
