import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getToken({ req: req as any });
  const email =
    session &&
    typeof session !== "string" &&
    typeof (session as Record<string, unknown>).email === "string"
      ? ((session as Record<string, unknown>).email as string)
      : null;
  if (!email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const code = crypto.randomBytes(8).toString("hex"); // 16 hex chars
  const sb = supabaseAdmin();

  await sb.from("link_tokens").insert({ token: code, email });

  const url = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}`;
  return NextResponse.json({ url, code });
}
