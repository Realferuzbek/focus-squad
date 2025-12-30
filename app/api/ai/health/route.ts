export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ ok: true }, { headers: noCache() });
  } catch (error) {
    console.error("[api/ai/health] failure", error);
    return NextResponse.json({ ok: false }, { status: 500, headers: noCache() });
  }
}

function noCache() {
  return { "Cache-Control": "no-store" };
}
