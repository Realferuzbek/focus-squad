export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { embedBatch, generateAnswer } from "@/lib/rag/ai";
import { vector } from "@/lib/rag/vector";
import { isAiChatEnabled } from "@/lib/featureFlags";

export async function POST(req: Request) {
  try {
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
    if (!qvec) {
      return NextResponse.json(
        { error: "Failed to embed query" },
        { status: 500 }
      );
    }

    const search = await vector.query({
      vector: qvec,
      topK: 8,
      includeMetadata: true,
    });

    const contexts =
      (search as any).matches
        ?.map((m: any, i: number) => {
          const md = m?.metadata ?? {};
          return `Source ${i + 1}: ${md.title || "Untitled"}\nURL: ${
            md.url
          }\n\n${md.chunk}`;
        })
        .join("\n\n---\n\n") || "";

    const prompt = `Use ONLY the sources below to answer. If unsure, say so.\n\n${contexts}\n\nUser question: ${query}`;

    const rawAnswer = await generateAnswer(prompt);
    const answer =
      rawAnswer?.trim() ||
      "I couldn’t find a confident answer yet. Try rephrasing or reindexing.";

    const sources =
      (search as any).matches
        ?.map((m: any) => m?.metadata?.url)
        .filter(Boolean) ?? [];

    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error("[api/chat] failure", error);
    return NextResponse.json(
      { error: "AI assistant is temporarily unavailable." },
      { status: 500 }
    );
  }
}
