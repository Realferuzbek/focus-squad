import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/rag/env";
import { isAiChatEnabled } from "@/lib/featureFlags";

async function requireAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; is_admin?: boolean } | undefined;
  return user?.is_admin ? user : undefined;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Safe, non-secret diagnostics
  const diagnostics = {
    openai: {
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
      genModel: env.OPENAI_GEN_MODEL,
      embedModel: env.OPENAI_EMBED_MODEL,
      useMockAi: process.env.USE_MOCK_AI === "1" || process.env.USE_MOCK_AI === "true" || (env.OPENAI_API_KEY && env.OPENAI_API_KEY.toLowerCase() === "mock"),
    },
    upstash: {
      urlPresent: Boolean(process.env.UPSTASH_VECTOR_REST_URL),
      tokenPresent: Boolean(process.env.UPSTASH_VECTOR_REST_TOKEN),
      indexName: env.UPSTASH_INDEX_NAME,
      vectorDim: env.UPSTASH_VECTOR_DIM,
    },
    featureFlags: {
      aiChatEnabled: await isAiChatEnabled(true),
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({ diagnostics });
}
