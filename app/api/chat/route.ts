export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { embedBatch, generateAnswer } from "@/lib/rag/ai";
import { vector } from "@/lib/rag/vector";
import { isAiChatEnabled } from "@/lib/featureFlags";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const throttle = rateLimit(`ai-chat:${user.id}`, 10, 60_000);
    if (!throttle.ok) {
      return NextResponse.json(
        { error: "Too many requests, try again soon." },
        { status: 429 },
      );
    }

    const aiEnabled = await isAiChatEnabled(true);
    if (!aiEnabled) {
      return NextResponse.json(
        { error: "AI assistant is currently disabled by admins." },
        { status: 503 }
      );
    }

    const { query } = await req.json().catch(() => ({ query: "" }));
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const [qvec] = await embedBatch([query]);
    if (!qvec || !Array.isArray(qvec) || qvec.length === 0) {
      console.error("[api/chat] Failed to embed query or got invalid embedding");
      return NextResponse.json(
        { error: "Failed to embed query" },
        { status: 500 }
      );
    }

    let search: any;
    try {
      search = await vector.query({
        vector: qvec,
        topK: 8,
        includeMetadata: true,
      });
    } catch (vectorError: any) {
      console.error("[api/chat] Vector query failed:", vectorError?.message || vectorError);
      return NextResponse.json(
        { 
          error: "Unable to search the knowledge base. Please try again later.",
          answer: "I'm having trouble accessing the knowledge base right now. Please try again in a moment."
        },
        { status: 500 }
      );
    }

    const matches = (search as any)?.matches || [];
    const validMatches = matches.filter((m: any) => 
      m?.metadata && 
      (m?.metadata?.chunk || m?.metadata?.url)
    );

    // If no valid matches found, return a helpful message
    if (validMatches.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any relevant information in the indexed content for your question. This might mean:\n\n1. The content hasn't been indexed yet - try reindexing the site\n2. Your question might need to be rephrased to match the available content\n3. The content you're asking about might not be in the knowledge base yet\n\nTry asking about features, functionality, or content that's already on the site, or rephrase your question.",
        sources: []
      });
    }

    const contexts = validMatches
      .map((m: any, i: number) => {
        const md = m?.metadata ?? {};
        return `Source ${i + 1}: ${md.title || "Untitled"}\nURL: ${
          md.url || ""
        }\n\n${md.chunk || ""}`;
      })
      .join("\n\n---\n\n");

    const prompt = `You are a helpful assistant for the studywithferuzbek website. Use ONLY the sources provided below to answer the user's question. If the sources don't contain enough information to answer confidently, say so clearly.

Sources:
${contexts}

User question: ${query}

Provide a clear, helpful answer based on the sources above. If you're not confident about the answer, say so.`;

    let rawAnswer: string | null = null;
    try {
      rawAnswer = await generateAnswer(prompt);
    } catch (genError: any) {
      console.error("[api/chat] Answer generation failed:", genError?.message || genError);
    }

    const answer =
      rawAnswer?.trim() ||
      "I couldn't generate a confident answer based on the available sources. Try rephrasing your question or asking about different content.";

    const sources = validMatches
      .map((m: any) => m?.metadata?.url)
      .filter((url: any): url is string => Boolean(url) && typeof url === "string");

    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error("[api/chat] failure", error);
    return NextResponse.json(
      { error: "AI assistant is temporarily unavailable." },
      { status: 500 }
    );
  }
}
