export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { env } from "@/lib/rag/env";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const cronHeader = req.headers.get("x-vercel-cron");
  if (!cronHeader) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const target = new URL("/api/reindex", req.url).toString();
    const res = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.INDEXER_SECRET}`,
      },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(body, { status: res.status });
    }
    return NextResponse.json(body);
  } catch (error) {
    console.error("[cron/nightly-reindex] failed", error);
    return NextResponse.json(
      { error: "Reindex trigger failed" },
      { status: 500 },
    );
  }
}
