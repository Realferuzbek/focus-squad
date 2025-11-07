import OpenAI from "openai";
import { createHash } from "crypto";
import { env } from "./env";

const useMockAi =
  process.env.USE_MOCK_AI === "1" ||
  process.env.USE_MOCK_AI === "true" ||
  env.OPENAI_API_KEY.toLowerCase() === "mock";

const mockVectorDim = Math.max(
  16,
  Number(process.env.MOCK_EMBED_DIM || process.env.UPSTASH_VECTOR_DIM || 1536)
);

export const openai = useMockAi ? null : new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function embedBatch(inputs: string[]) {
  if (!inputs.length) return [];
  if (!useMockAi && openai) {
    const res = await openai.embeddings.create({
      model: env.OPENAI_EMBED_MODEL,
      input: inputs,
    });
    return res.data.map((d) => d.embedding);
  }
  return inputs.map((text) => mockEmbed(text));
}

export async function generateAnswer(prompt: string) {
  if (!useMockAi && openai) {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_GEN_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are an expert website assistant for study_with_feruzbek. Answer accurately using the provided context. If you aren’t sure, say you’re not sure. Always include a short 'Sources' list of URLs you used.",
        },
        { role: "user", content: prompt },
      ],
    });
    return completion.choices[0]?.message?.content ?? "";
  }
  return mockAnswerFromPrompt(prompt);
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
