import OpenAI from "openai";
import { createHash } from "crypto";
import type { SupportedLanguage } from "@/lib/ai-chat/language";
import { env } from "./env";
import type { SnippetMeta } from "./vector";

const useMockAi =
  process.env.USE_MOCK_AI === "1" ||
  process.env.USE_MOCK_AI === "true" ||
  env.OPENAI_API_KEY.toLowerCase() === "mock";

const mockOverride = Number(process.env.MOCK_EMBED_DIM);
const mockVectorDim =
  Number.isFinite(mockOverride) && mockOverride > 0
    ? Math.floor(mockOverride)
    : env.UPSTASH_VECTOR_DIM;

const shouldUseResponsesApi = (model: string) => {
  const normalized = model.toLowerCase();
  return (
    normalized.includes("gpt-5") ||
    normalized.includes("gpt-4.1") ||
    normalized.includes("gpt-4o") ||
    normalized.includes("o1") ||
    normalized.includes("o3")
  );
};

export const openai = useMockAi
  ? null
  : new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function embedBatch(inputs: string[]) {
  if (!inputs.length) return [];
  if (!useMockAi && openai) {
    try {
      const res = await openai.embeddings.create({
        model: env.OPENAI_EMBED_MODEL,
        input: inputs,
      });
      const embeddings = res.data.map((d) => d.embedding);
      ensureVectorDimensions(embeddings);
      return embeddings;
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as any).message
          : String(err);
      const stackFirst =
        err && typeof err === "object" && "stack" in err
          ? String((err as any).stack).split("\n")[0]
          : undefined;
      console.error("[rag/ai] embedding call failed:", msg, stackFirst);
      return inputs.map((text) => mockEmbed(text));
    }
  }
  return inputs.map((text) => mockEmbed(text));
}

export interface GenerateAnswerOptions {
  question: string;
  language: SupportedLanguage;
  contexts: SnippetMeta[];
  memory?: string[];
}

const LANGUAGE_LABELS: Record<
  SupportedLanguage,
  { label: string; fallback: string }
> = {
  en: {
    label: "English",
    fallback:
      "I couldn't find enough indexed material to answer that yet. Ask me something about the site's features or pages!",
  },
  uz: {
    label: "Uzbek",
    fallback:
      "Bu savol bo‘yicha mos ma’lumot topa olmadim. Iltimos, sayt funksiyalari yoki sahifalari haqida so‘rang!",
  },
  ru: {
    label: "Russian",
    fallback:
      "Я не нашёл подходящего контента по этому вопросу. Спроси о функциях или страницах этого сайта!",
  },
};

const SYSTEM_TONE =
  "You are the Focus Squad site assistant. Answer ONLY with information found in the provided context snippets. Never guess, never cite outside knowledge, and keep responses concise, motivating, and playful. Encourage the user to keep studying and gently remind them that you only cover this website. Do not mention internal tools or the retrieval pipeline. Avoid citations and source lists.";

export async function generateAnswer(
  options: GenerateAnswerOptions,
): Promise<string> {
  const { contexts, language } = options;
  if (!contexts.length) {
    return LANGUAGE_LABELS[language].fallback;
  }

  const systemMessage = `${SYSTEM_TONE} Always reply in ${LANGUAGE_LABELS[language].label}.`;
  const userPrompt = buildUserPrompt(options);

  if (!useMockAi && openai) {
    try {
      if (shouldUseResponsesApi(env.OPENAI_GEN_MODEL)) {
        const response = await openai.responses.create({
          model: env.OPENAI_GEN_MODEL,
          temperature: 0.2,
          input: [
            { role: "system", content: systemMessage },
            { role: "user", content: userPrompt },
          ],
        });
        const text = extractResponseText(response);
        if (text && text.trim()) return text.trim();
      } else {
        const completion = await openai.chat.completions.create({
          model: env.OPENAI_GEN_MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userPrompt },
          ],
        });
        const text = completion.choices[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as any).message
          : String(err);
      const stackFirst =
        err && typeof err === "object" && "stack" in err
          ? String((err as any).stack).split("\n")[0]
          : undefined;
      console.error("[rag/ai] generation call failed:", msg, stackFirst);
      return LANGUAGE_LABELS[language].fallback;
    }
  }

  return mockAnswerFromContext(options);
}

function buildUserPrompt({
  question,
  contexts,
  memory,
  language,
}: GenerateAnswerOptions) {
  const snippets = contexts
    .map((meta, index) => {
      const title = meta.title || "Untitled section";
      const cleanedChunk = meta.chunk.replace(/\s+/g, " ").trim();
      return `Snippet ${index + 1} (${title} | ${meta.url}): ${cleanedChunk}`;
    })
    .join("\n\n");

  const memoryBlock =
    memory && memory.length
      ? `User background notes:\n- ${memory.map((m) => m.trim()).join("\n- ")}`
      : null;

  return [
    `Language: ${LANGUAGE_LABELS[language].label}`,
    memoryBlock,
    "Use these context snippets from the site:",
    snippets,
    `Question: ${question}`,
    "Answer using only the snippets. Keep the tone motivating and playful, cheer the user on, and never add citations or URLs.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractResponseText(response: any): string {
  if (!response) return "";
  if (Array.isArray(response.output_text) && response.output_text.length > 0) {
    return response.output_text.join("\n").trim();
  }
  if (Array.isArray(response.output)) {
    const pieces = response.output.flatMap((item: any) =>
      Array.isArray(item?.content) ? item.content : [],
    );
    const text = pieces
      .map((piece: any) => {
        if (typeof piece?.text === "string") return piece.text;
        if (typeof piece?.content === "string") return piece.content;
        if (Array.isArray(piece?.content)) {
          return piece.content
            .map((inner: any) => {
              if (typeof inner === "string") return inner;
              if (typeof inner?.text === "string") return inner.text;
              return "";
            })
            .filter(Boolean)
            .join("");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}

function mockAnswerFromContext(options: GenerateAnswerOptions) {
  const { contexts, question, language, memory } = options;
  if (!contexts.length) return LANGUAGE_LABELS[language].fallback;
  const [first] = contexts;
  const preview = first.chunk.replace(/\s+/g, " ").slice(0, 280);
  const memoryBlurb =
    memory && memory.length
      ? `\n\nI also remember: ${memory.map((value) => value.trim()).join(" ")}`
      : "";
  return `Here's what the site says about "${question}": ${preview}…${memoryBlurb}`;
}

function mockEmbed(text: string): number[] {
  const cleaned =
    text
      ?.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean) ?? [];
  const vec = new Float32Array(mockVectorDim);
  if (!cleaned.length) {
    return Array.from(vec, (v) => Number(v));
  }
  for (const token of cleaned) {
    const hash = createHash("sha256").update(token).digest();
    const idx = hash.readUInt32BE(0) % mockVectorDim;
    vec[idx] += 1;
  }
  let magnitude = 0;
  for (const value of vec) {
    magnitude += value * value;
  }
  magnitude = Math.sqrt(magnitude) || 1;
  return Array.from(vec, (value) => Number(value / magnitude));
}

function ensureVectorDimensions(vectors: number[][]) {
  if (!vectors.length) return;
  const mismatched = vectors.find(
    (vector) => vector.length !== env.UPSTASH_VECTOR_DIM,
  );
  if (mismatched) {
    throw new Error(
      `Embedding dimension mismatch: model "${env.OPENAI_EMBED_MODEL}" returned ${mismatched.length} dimensions but the Upstash index expects ${env.UPSTASH_VECTOR_DIM}. Update OPENAI_EMBED_MODEL or recreate the index with the matching dimension.`,
    );
  }
}
