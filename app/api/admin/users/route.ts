// app/api/admin/users/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message =
      guard.message === "unauthorized" ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const form = await req.formData();
  const email = (form.get("email") as string)?.toLowerCase();
  const action = form.get("action");

  if (!email || !action)
    return NextResponse.redirect(new URL("/admin", req.url));

  const sb = supabaseAdmin();
  await sb
    .from("users")
    .update({ is_admin: action === "promote" })
    .eq("email", email);

  return NextResponse.redirect(new URL("/admin", req.url));
}
