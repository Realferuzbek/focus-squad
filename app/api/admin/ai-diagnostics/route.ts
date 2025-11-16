import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { env } from "@/lib/rag/env";
import { isAiChatEnabled } from "@/lib/featureFlags";

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message =
      guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  // Safe, non-secret diagnostics
  const diagnostics = {
    openai: {
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
      genModel: env.OPENAI_GEN_MODEL,
      embedModel: env.OPENAI_EMBED_MODEL,
      useMockAi:
        process.env.USE_MOCK_AI === "1" ||
        process.env.USE_MOCK_AI === "true" ||
        (env.OPENAI_API_KEY && env.OPENAI_API_KEY.toLowerCase() === "mock"),
    },
    upstash: {
      urlPresent: Boolean(process.env.UPSTASH_VECTOR_REST_URL),
      tokenPresent: Boolean(process.env.UPSTASH_VECTOR_REST_TOKEN),
      indexName: env.UPSTASH_INDEX_NAME,
      vectorDim: env.UPSTASH_VECTOR_DIM,
    },
    featureFlags: {
      aiChatEnabled: await isAiChatEnabled(true, { cache: false }),
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({ diagnostics });
}
