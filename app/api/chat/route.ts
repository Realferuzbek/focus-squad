export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { performance } from "perf_hooks";
import { detectLanguage } from "@/lib/ai-chat/language";
import type { SupportedLanguage } from "@/lib/ai-chat/language";
import { detectGreeting, getGreetingReply } from "@/lib/ai-chat/greetings";
import {
  getErrorResponse,
  getModerationResponse,
  getOffTopicResponse,
} from "@/lib/ai-chat/messages";
import { maybeHandleLeaderboardQuestion } from "@/lib/ai-chat/leaderboard";
import { moderateInput } from "@/lib/ai-chat/moderation";
import {
  extractMemoryEntries,
  getMemoryPreference,
  getUserMemories,
  upsertUserMemories,
} from "@/lib/ai-chat/memory";
import type { MemoryEntry } from "@/lib/ai-chat/memory";
import { saveChatLog } from "@/lib/ai-chat/logging";
import { redactForStorage } from "@/lib/ai-chat/redaction";
import type { RedactionStatus } from "@/lib/ai-chat/redaction";
import { embedBatch, generateAnswer } from "@/lib/rag/ai";
import { vector, type SnippetMeta } from "@/lib/rag/vector";
import { rateLimit } from "@/lib/rateLimit";
import { isAiChatEnabled } from "@/lib/featureFlags";

const SIMILARITY_THRESHOLD = 0.2;
const TOP_K = 5;

type ChatRequestBody = {
  input?: unknown;
  userId?: unknown;
  sessionId?: unknown;
};

export async function POST(req: Request) {
  const startedAt = performance.now();
  try {
    const body = (await req.json().catch(() => ({}))) as ChatRequestBody;
    const inputRaw =
      typeof body.input === "string" ? body.input.trim() : undefined;
    if (!inputRaw) {
      return NextResponse.json(
        { error: "Missing input" },
        { status: 400, headers: noCache() },
      );
    }

    const sessionIdRaw =
      typeof body.sessionId === "string" ? body.sessionId : null;
    const sessionId = sessionIdRaw && isUuid(sessionIdRaw) ? sessionIdRaw : null;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 400, headers: noCache() },
      );
    }

    const userIdRaw =
      typeof body.userId === "string" && isUuid(body.userId)
        ? body.userId
        : null;

    const forwardedFor =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const rateKey = `ai-chat:${sessionId}:${forwardedFor ?? "anon"}`;
    const throttle = rateLimit(rateKey, 12, 60_000);
    if (!throttle.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again in a minute." },
        { status: 429, headers: noCache() },
      );
    }

    const languageDetection = detectLanguage(inputRaw);
    const language = languageDetection.code;

    const aiEnabled = await isAiChatEnabled(true, { cache: false });
    if (!aiEnabled) {
      const reply =
        language === "uz"
          ? "AI hozirda dam olmoqda — administratorlar uni yaqinda qayta ishga tushiradilar ✨"
          : language === "ru"
            ? "Ассистент временно на паузе — админы скоро вернут его в строй ✨"
            : "The assistant is taking a quick break while admins make updates. Check back soon ✨";
      return NextResponse.json(
        { text: reply, usedRag: false, language },
        { status: 503, headers: noCache() },
      );
    }

    const greetingMatch = detectGreeting(inputRaw);
    if (greetingMatch) {
      const reply = getGreetingReply(greetingMatch ?? language);
      await persistLog({
        userId: userIdRaw,
        sessionId,
        language,
        input: inputRaw,
        reply,
        usedRag: false,
        metadata: { reason: "greeting" },
      });
      return NextResponse.json(
        { text: reply, usedRag: false, language },
        { headers: noCache() },
      );
    }

    const moderation = await moderateInput(inputRaw);
    if (!moderation.ok) {
      const reply = getModerationResponse(language);
      await persistLog({
        userId: userIdRaw,
        sessionId,
        language,
        input: inputRaw,
        reply,
        usedRag: false,
        metadata: { reason: "moderation", category: moderation.category },
      });
      return NextResponse.json(
        { text: reply, usedRag: false, language },
        { headers: noCache() },
      );
    }

    const leaderboardTool = await maybeHandleLeaderboardQuestion({
      input: inputRaw,
      language,
    });
    if (leaderboardTool.handled) {
      const reply = leaderboardTool.text ?? getErrorResponse(language);
      await persistLog({
        userId: userIdRaw,
        sessionId,
        language,
        input: inputRaw,
        reply,
        usedRag: false,
        metadata: leaderboardTool.metadata ?? { reason: "leaderboard" },
      });
      return NextResponse.json(
        { text: reply, usedRag: false, language },
        { headers: noCache() },
      );
    }

    const embedStart = performance.now();
    const [embedding] = await embedBatch([inputRaw]);
    const embedMs = performance.now() - embedStart;
    if (!embedding || !embedding.length) {
      return NextResponse.json(
        { text: getErrorResponse(language), usedRag: false, language },
        { status: 500, headers: noCache() },
      );
    }

    const retrievalStart = performance.now();
    let matches: Array<{ score?: number; metadata?: SnippetMeta }> = [];
    try {
      const result: any = await vector.query({
        vector: embedding,
        topK: TOP_K,
        includeMetadata: true,
      });
      matches = Array.isArray(result?.matches) ? result.matches : [];
    } catch (error) {
      console.error("[api/chat] vector query failed", error);
      return NextResponse.json(
        { text: getErrorResponse(language), usedRag: false, language },
        { status: 500, headers: noCache() },
      );
    }
    const retrievalMs = performance.now() - retrievalStart;

    const validMatches = matches.filter(
      (match) =>
        match &&
        typeof match.score === "number" &&
        match.metadata?.chunk &&
        match.metadata?.url,
    );

    const bestScore = validMatches.length
      ? (validMatches[0]?.score as number)
      : 0;

    const contexts = validMatches
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, TOP_K)
      .map((match) => match.metadata as SnippetMeta);

    const confident = contexts.length > 0 && bestScore >= SIMILARITY_THRESHOLD;

    if (!confident) {
      const reply = getOffTopicResponse(language);
      await persistLog({
        userId: userIdRaw,
        sessionId,
        language,
        input: inputRaw,
        reply,
        usedRag: false,
        metadata: {
          reason: "off_topic",
          matches: contexts.length,
          bestScore,
          embedMs,
          retrievalMs,
        },
      });
      return NextResponse.json(
        { text: reply, usedRag: false, language },
        { headers: noCache() },
      );
    }

    const memoryState = userIdRaw
      ? await safeGetMemories(userIdRaw)
      : { list: [], enabled: false };
    const memories = memoryState.list;

    const generationStart = performance.now();
    const answer = await generateAnswer({
      question: inputRaw,
      language,
      contexts,
      memory: memories,
    });
    const generationMs = performance.now() - generationStart;

    const logEntry = await persistLog({
      userId: userIdRaw,
      sessionId,
      language,
      input: inputRaw,
      reply: answer,
      usedRag: true,
      metadata: {
        matches: contexts.length,
        bestScore,
        embedMs,
        retrievalMs,
        generationMs,
        languageConfidence: languageDetection.confidence,
        memoryUsed: memories.length,
      },
    });

    if (userIdRaw && memoryState.enabled) {
      const memoryHints = extractMemoryEntries(inputRaw);
      if (memoryHints.length) {
        safeRemember(userIdRaw, memoryHints);
      }
    }

    const totalMs = performance.now() - startedAt;
    console.info("[api/chat] timings", {
      embedMs: Number(embedMs.toFixed(1)),
      retrievalMs: Number(retrievalMs.toFixed(1)),
      generationMs: Number(generationMs.toFixed(1)),
      totalMs: Number(totalMs.toFixed(1)),
      usedRag: true,
      language,
      bestScore: Number(bestScore?.toFixed?.(3) ?? bestScore),
    });

    return NextResponse.json(
      {
        text: answer,
        usedRag: true,
        language,
        chatId: logEntry?.id ?? null,
      },
      { headers: noCache() },
    );
  } catch (error) {
    console.error("[api/chat] failure", error);
    return NextResponse.json(
      {
        text: getErrorResponse("en"),
        usedRag: false,
        language: "en",
      },
      { status: 500, headers: noCache() },
    );
  }
}

async function safeGetMemories(userId: string) {
  try {
    const enabled = await getMemoryPreference(userId);
    if (!enabled) {
      return { list: [], enabled: false };
    }
    const list = await getUserMemories(userId);
    return { list, enabled: true };
  } catch {
    return { list: [], enabled: true };
  }
}

function safeRemember(userId: string, entries: MemoryEntry[]) {
  upsertUserMemories(userId, entries).catch((error) =>
    console.warn("[ai-chat] failed to store memories", error),
  );
}

async function persistLog(params: {
  userId: string | null;
  sessionId: string;
  language: SupportedLanguage;
  input: string;
  reply: string;
  usedRag: boolean;
  metadata?: Record<string, unknown>;
}) {
  const redactedInput = redactForStorage(params.input);
  const redactedReply = redactForStorage(params.reply);
  const status: RedactionStatus =
    redactedInput.status === "failed" || redactedReply.status === "failed"
      ? "failed"
      : redactedInput.status === "redacted" || redactedReply.status === "redacted"
        ? "redacted"
        : "skipped";
  return saveChatLog({
    userId: params.userId,
    sessionId: params.sessionId,
    language: params.language,
    input: redactedInput.value,
    reply: redactedReply.value,
    usedRag: params.usedRag,
    metadata: params.metadata,
    redactionStatus: status,
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function noCache() {
  return { "Cache-Control": "no-store" };
}
