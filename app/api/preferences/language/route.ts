export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { resolveLocale, type Locale } from "@/lib/i18n";

interface Payload {
  locale?: string;
}

export async function POST(req: NextRequest) {
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const locale = resolveLocale(payload.locale);
  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set("lang", locale, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
