export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { env } from "@/lib/rag/env";
import { isAiChatEnabled } from "@/lib/featureFlags";

export async function GET() {
  try {
    const enabled = await isAiChatEnabled(true);
    const checks = {
      openaiKey: Boolean(process.env.OPENAI_API_KEY),
      embedModel: env.OPENAI_EMBED_MODEL,
      genModel: env.OPENAI_GEN_MODEL,
      upstashUrl: Boolean(env.UPSTASH_VECTOR_REST_URL),
      upstashIndex: env.UPSTASH_INDEX_NAME,
      enabled,
    };
    return NextResponse.json({ ok: true, checks }, { headers: noCache() });
  } catch (error) {
    console.error("[api/ai/health] failure", error);
    return NextResponse.json({ ok: false }, { status: 500, headers: noCache() });
  }
}

function noCache() {
  return { "Cache-Control": "no-store" };
}
