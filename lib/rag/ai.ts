import OpenAI from "openai";
import { createHash } from "crypto";
import { env } from "./env";

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

export const openai = useMockAi ? null : new OpenAI({ apiKey: env.OPENAI_API_KEY });

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
      // Log and fall back to mock embeddings to keep the app responsive.
      // Avoid logging secrets; safely extract message/stack from unknown.
      const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
      const stackFirst = err && typeof err === "object" && "stack" in err ? String((err as any).stack).split("\n")[0] : undefined;
      console.error("[rag/ai] embedding call failed:", msg, stackFirst);
      return inputs.map((text) => mockEmbed(text));
    }
  }
  return inputs.map((text) => mockEmbed(text));
}

export async function generateAnswer(prompt: string) {
  // Check if prompt has sources - if not, return early with helpful message
  const hasSources = /Source\s+\d+:/i.test(prompt);
  if (!hasSources) {
    return "I couldn't find any relevant sources to answer your question. The knowledge base might be empty or your question doesn't match any indexed content. Try reindexing the site or rephrasing your question.";
  }

  if (!useMockAi && openai) {
    const systemMessage =
      "You are a helpful assistant for the studywithferuzbek website. Answer questions accurately using ONLY the provided sources. If the sources don't contain enough information to answer confidently, clearly state that you're not sure. Be concise and helpful.";
    try {
      if (shouldUseResponsesApi(env.OPENAI_GEN_MODEL)) {
        const response = await openai.responses.create({
          model: env.OPENAI_GEN_MODEL,
          temperature: 0.2,
          input: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt },
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
            { role: "user", content: prompt },
          ],
        });
        const text = completion.choices[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
      const stackFirst = err && typeof err === "object" && "stack" in err ? String((err as any).stack).split("\n")[0] : undefined;
      console.error("[rag/ai] generation call failed:", msg, stackFirst);
      // Return a helpful error message instead of falling back to mock
      return "I encountered an error while generating a response. Please try again in a moment.";
    }
  }
  // Only use mock answer if we're in mock mode
  return mockAnswerFromPrompt(prompt);
}

function extractResponseText(response: any): string {
  if (!response) return "";
  if (Array.isArray(response.output_text) && response.output_text.length > 0) {
    return response.output_text.join("\n").trim();
  }
  if (Array.isArray(response.output)) {
    const pieces = response.output.flatMap((item: any) =>
      Array.isArray(item?.content) ? item.content : []
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

function mockAnswerFromPrompt(prompt: string): string {
  const sourceRegex =
    /Source\s+\d+:\s*([^\n]+)\nURL:\s*([^\s]+)\s*\n\n([\s\S]*?)(?=\n\n---|\n\nUser question:|$)/g;
  const matches: Array<{ title: string; url: string; chunk: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = sourceRegex.exec(prompt)) !== null) {
    matches.push({
      title: match[1]?.trim() || "Untitled",
      url: match[2]?.trim() || env.SITE_BASE_URL,
      chunk: match[3]?.trim() || "",
    });
  }

  const question = prompt.split("User question:").slice(1).join("User question:").trim();

  const summary = matches
    .slice(0, 2)
    .map((entry) => {
      const preview = entry.chunk.slice(0, 320).replace(/\s+/g, " ");
      return `${entry.title}: ${preview}`;
    })
    .join(" ");

  const sources =
    matches
      .map((entry) => entry.url)
      .filter(Boolean)
      .slice(0, 4) ?? [];

  const intro = question
    ? `Based on the indexed site content, here is what we know about \"${question}\".`
    : "Based on the indexed site content, here is what we know.";

  const body =
    summary ||
    "I could not find a confident match in the indexed snippets. Try rephrasing your question or reindexing.";

  const sourcesBlock =
    sources.length > 0
      ? sources.map((src) => `- ${src}`).join("\n")
      : `- ${env.SITE_BASE_URL}`;

  return `${intro}\n\n${body}\n\nSources:\n${sourcesBlock}`;
}

function ensureVectorDimensions(vectors: number[][]) {
  if (!vectors.length) return;
  const mismatched = vectors.find(
    (vector) => vector.length !== env.UPSTASH_VECTOR_DIM
  );
  if (mismatched) {
    throw new Error(
      `Embedding dimension mismatch: model "${env.OPENAI_EMBED_MODEL}" returned ${mismatched.length} dimensions but the Upstash index expects ${env.UPSTASH_VECTOR_DIM}. Update OPENAI_EMBED_MODEL or recreate the index with the matching dimension.`
    );
  }
}
