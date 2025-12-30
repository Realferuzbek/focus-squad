export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { performance } from "perf_hooks";
import { detectLanguage } from "@/lib/ai-chat/language";
import type { SupportedLanguage } from "@/lib/ai-chat/language";
import { detectGreeting, getGreetingReply } from "@/lib/ai-chat/greetings";
import {
  getErrorResponse,
  getModerationResponse,
  getOffTopicResponse,
  getAdminRefusalResponse,
  getPersonalDataRefusalResponse,
} from "@/lib/ai-chat/messages";
import {
  isLeaderboardIntent,
  maybeHandleLeaderboardQuestion,
} from "@/lib/ai-chat/leaderboard";
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

const SIMILARITY_THRESHOLD = 0.35;
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

    const normalizedInput = inputRaw.toLowerCase().trim();
    const languageDetection = detectLanguage(inputRaw);
    const language = languageDetection.code;

    const aiEnabled = await isAiChatEnabled(false, { cache: false });
    if (!aiEnabled) {
      return NextResponse.json(
        { text: getPausedReply(language), usedRag: false, language },
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

    const refusal = classifyRefusal(normalizedInput);
    if (refusal) {
      const reply =
        refusal === "personal"
          ? getPersonalDataRefusalResponse(language)
          : getAdminRefusalResponse(language);
      await persistLog({
        userId: userIdRaw,
        sessionId,
        language,
        input: inputRaw,
        reply,
        usedRag: false,
        metadata: {
          reason: refusal === "personal" ? "personal_data" : "admin_request",
        },
      });
      return NextResponse.json(
        { text: reply, usedRag: false, language },
        { headers: noCache() },
      );
    }

    const leaderboardIntent = isLeaderboardIntent(normalizedInput);
    const offTopic =
      isGeneralKnowledgeIntent(normalizedInput) &&
      !leaderboardIntent &&
      !isFocusSquadIntent(normalizedInput);
    if (offTopic) {
      const reply = getOffTopicResponse(language);
      await persistLog({
        userId: userIdRaw,
        sessionId,
        language,
        input: inputRaw,
        reply,
        usedRag: false,
        metadata: { reason: "off_topic_intent" },
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

    const sortedMatches = [...validMatches].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    );
    const bestScore = sortedMatches.length
      ? (sortedMatches[0]?.score as number)
      : 0;

    const contexts = sortedMatches
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

    const preGenEnabled = await isAiChatEnabled(false, { cache: false });
    if (!preGenEnabled) {
      return NextResponse.json(
        { text: getPausedReply(language), usedRag: false, language },
        { status: 503, headers: noCache() },
      );
    }

    const generationStart = performance.now();
    const answer = await generateAnswer({
      question: inputRaw,
      language,
      contexts,
      memory: memories,
    });
    const generationMs = performance.now() - generationStart;

    const postGenEnabled = await isAiChatEnabled(false, { cache: false });
    if (!postGenEnabled) {
      return NextResponse.json(
        { text: getPausedReply(language), usedRag: false, language },
        { status: 503, headers: noCache() },
      );
    }

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

type RefusalKind = "personal" | "admin";

const PERSONAL_PATTERNS: RegExp[] = [
  /\bmy\s+(stats|statistics|tasks?|habits?|minutes?|streak|profile|account|data|activity|history|sessions?)\b/i,
  /\bmy\s+(focus|study|timer|planner|goals?)\b/i,
  /\bhow\s+many\s+(minutes?|hours?)\b.*\b(i|me|my)\b/i,
  /\b(i|me|my)\s+(spent|studied|focused|tracked)\b/i,
  /\b(my|me)\s+(email|e-mail|phone|number|address)\b/i,
  /\b(email|e-mail)\b.*\b(my|me|mine|feruzbek)\b/i,
  /(^|\s)мо[йяеи]\s+(статистик|задач|привыч|минут|сер(ия|ии)|стрик|профил|аккаунт|данн|активн|истори)/i,
  /(^|\s)сколько\s+(минут|часов).*(я|мне|мой|моя|моё|мои)/i,
  /(^|\s)mening\s+(statistika|vazif|odat|daqiq|streak|profil|hisob|ma'lumot|malumot|faoliyat|tarix)/i,
  /(^|\s)necha\s+(daqiq|soat).*(men(ing|)?)/i,
];

const ADMIN_PATTERNS: RegExp[] = [
  /\badmin\b/i,
  /\badmin\s+(panel|controls|dashboard)\b/i,
  /\badmin\b.*\btoggle\b/i,
  /\btoggle\b.*\badmin\b/i,
  /\bbackend\b/i,
  /\binternal\b/i,
  /\bconfig(uration)?\b/i,
  /\benv(ironment)?\b/i,
  /\bdiagnostic(s)?\b/i,
  /\bserver\s+logs?\b/i,
  /\blog\s+export\b/i,
  /\bapi\s*key\b/i,
  /\bsecret\s+key\b/i,
  /\bservice\s*role\b/i,
  /\b(access|service|admin)\s+token\b/i,
  /\bsupabase\b/i,
  /\bvercel\b/i,
  /\bendpoint\b/i,
  /\/api\/[a-z0-9/_-]+/i,
  /\breindex\b/i,
  /\bfeature\s+flags?\b/i,
  /(^|\s)админ/i,
  /(^|\s)внутренн/i,
  /(^|\s)(конфиг|настройк)/i,
  /(^|\s)секрет/i,
  /(^|\s)ключ(\s|$)/i,
  /(^|\s)логи?(\s|$)/i,
  /(^|\s)диагностик/i,
  /(^|\s)(эндпоинт|endpoint)/i,
  /(^|\s)ichki/i,
  /(^|\s)maxfiy/i,
  /(^|\s)kalit/i,
  /(^|\s)sozlam/i,
  /(^|\s)server/i,
  /(^|\s)log/i,
  /(^|\s)diagnostika/i,
];

const GENERAL_KNOWLEDGE_PATTERNS: RegExp[] = [
  /\bwhat\s+is\b/i,
  /\bwho\s+is\b/i,
  /\bdefine\b/i,
  /\bexplain\b/i,
  /\bhistory\s+of\b/i,
  /\bmeaning\s+of\b/i,
  /\bwhen\s+did\b/i,
  /\bwhere\s+is\b/i,
  /\bcapital\s+of\b/i,
  /\bweather\b/i,
  /\bforecast\b/i,
  /\bnews\b/i,
  /\bpolitics?\b/i,
  /\bpresident\b/i,
  /\bprime\s+minister\b/i,
  /\bwar\b/i,
  /\bquantum\b/i,
  /\bphysics\b/i,
  /\bchemistry\b/i,
  /\bbiology\b/i,
  /\bmath\b/i,
  /\balgebra\b/i,
  /\bcalculus\b/i,
  /\bgeometry\b/i,
  /\bmovie\b/i,
  /\bfilm\b/i,
  /\bmusic\b/i,
  /\bsong\b/i,
  /\bbook\b/i,
  /\bnovel\b/i,
  /\bfootball\b/i,
  /\bsoccer\b/i,
  /\bbasketball\b/i,
  /\brecipe\b/i,
  /\bcook\b/i,
  /\bfood\b/i,
  /\bdiet\b/i,
  /\bbitcoin\b/i,
  /\bcrypto\b/i,
  /\bstock\b/i,
  /\bmarket\b/i,
];

const FOCUS_SQUAD_PATTERNS: RegExp[] = [
  /\bfocus\s+squad\b/i,
  /\bstudy\s+with\s+feruzbek\b/i,
  /\bdashboard\b/i,
  /\b(timer|pomodoro|focus\s+timer|break)\b/i,
  /\bleaderboard\b/i,
  /\brankings?\b/i,
  /\bstreaks?\b/i,
  /\btasks?\b/i,
  /\bhabits?\b/i,
  /\bplanner\b/i,
  /\bcommunity\b/i,
  /\blive\s+(room|rooms|session|sessions)\b/i,
  /\bstudy\s+session\b/i,
  /\baccountability\b/i,
  /\bpremium\b/i,
  /\bsubscription\b/i,
  /\bpricing\b/i,
  /\bfeatures?\b/i,
  /\bask\s+ai\b/i,
  /\bassistant\b/i,
  /\/leaderboard\b/i,
  /\/dashboard\b/i,
  /\/community\b/i,
  /\/feature\b/i,
];

function classifyRefusal(input: string): RefusalKind | null {
  if (matchesAny(PERSONAL_PATTERNS, input)) return "personal";
  if (matchesAny(ADMIN_PATTERNS, input)) return "admin";
  return null;
}

function isGeneralKnowledgeIntent(input: string) {
  return matchesAny(GENERAL_KNOWLEDGE_PATTERNS, input);
}

function isFocusSquadIntent(input: string) {
  return matchesAny(FOCUS_SQUAD_PATTERNS, input);
}

function matchesAny(patterns: RegExp[], input: string) {
  return patterns.some((pattern) => pattern.test(input));
}

function noCache() {
  return { "Cache-Control": "no-store" };
}

function getPausedReply(language: SupportedLanguage) {
  if (language === "uz") {
    return "AI hozirda dam olmoqda — administratorlar uni yaqinda qayta ishga tushiradilar ✨";
  }
  if (language === "ru") {
    return "Ассистент временно на паузе — админы скоро вернут его в строй ✨";
  }
  return "The assistant is taking a quick break while admins make updates. Check back soon ✨";
}
