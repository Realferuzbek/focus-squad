// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const session = await auth();
  const me = session?.user as any;
  if (!me?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const email = (form.get("email") as string)?.toLowerCase();
  const action = form.get("action");

  if (!email || !action) return NextResponse.redirect(new URL("/admin", req.url));

  const sb = supabaseAdmin();
  await sb.from("users").update({ is_admin: action === "promote" }).eq("email", email);

  return NextResponse.redirect(new URL("/admin", req.url));
}
