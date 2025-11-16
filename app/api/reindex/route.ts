export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { env } from "@/lib/rag/env";
import { reindexSite } from "@/lib/rag/crawl";

export async function POST(request: Request) {
  const token = resolveToken(request);
  if (token !== env.INDEXER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await reindexSite();
  return NextResponse.json({ ok: true, stats });
}

function resolveToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return request.headers.get("x-indexer-secret");
}
