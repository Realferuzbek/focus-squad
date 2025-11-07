export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { env } from "@/lib/rag/env";
import { reindexSite } from "@/lib/rag/crawl";

export async function POST(request: Request) {
  const secret = request.headers.get("x-indexer-secret");
  if (secret !== env.INDEXER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await reindexSite();
  return NextResponse.json({ ok: true, stats });
}
