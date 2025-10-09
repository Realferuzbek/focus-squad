// app/api/tasks/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

function tzNow() {
  return new Date(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: process.env.NEXT_PUBLIC_TZ || "Asia/Tashkent",
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date()).replace(/(\d{2})\/(\d{2})\/(\d{4}), /, "$3-$2-$1T")
  );
}
function dayKey(d: Date) {
  // YYYY-MM-DD in TZ
  return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.NEXT_PUBLIC_TZ || "Asia/Tashkent" }).format(d);
}
function locked(d: Date) {
  const tz = process.env.NEXT_PUBLIC_TZ || "Asia/Tashkent";
  const date = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d) + "T10:00:00");
  return d >= date;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ tasks: [] });

  const now = tzNow();
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("tasks")
    .select("id,title,done")
    .eq("user_id", (session.user as any).id)
    .eq("day", dayKey(now))
    .order("id", { ascending: true });
  return NextResponse.json({ tasks: data || [], locked: locked(now) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = tzNow();
  if (locked(now)) return NextResponse.json({ error: "Task entry closed for today" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const lines: string[] = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return NextResponse.json({ ok: true });

  const sb = supabaseAdmin();
  const rows = lines.map((title: string) => ({
    user_id: (session.user as any).id,
    day: dayKey(now),
    title,
    done: false,
  }));
  const { error } = await sb.from("tasks").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
