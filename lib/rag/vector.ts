import { Index } from "@upstash/vector";
import { env, isMockRagEnv } from "./env";

const useMockVector =
  process.env.USE_MOCK_VECTOR === "1" ||
  process.env.USE_MOCK_AI === "1" ||
  isMockRagEnv;

type VectorPayload = {
  id: string;
  vector: number[];
  metadata?: SnippetMeta;
};

type QueryOptions = {
  vector: number[];
  topK?: number;
  includeMetadata?: boolean;
};

class MemoryVector {
  private store = new Map<string, VectorPayload>();

  async upsert(payloads: VectorPayload[]) {
    for (const payload of payloads) {
      this.store.set(payload.id, payload);
    }
    return payloads.map((payload) => ({ id: payload.id, status: "success" }));
  }

  async query({ vector, topK = 8 }: QueryOptions) {
    const matches = Array.from(this.store.values()).map((entry) => ({
      id: entry.id,
      score: cosineSimilarity(vector, entry.vector),
      metadata: entry.metadata,
    }));
    matches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return { matches: matches.slice(0, topK) };
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB) || 1;
  return dot / denom;
}

function getMemoryVector() {
  const globalKey = "__focus_squad_memory_vector__";
  const globalObj = globalThis as typeof globalThis & {
    [key: string]: MemoryVector | undefined;
  };
  if (!globalObj[globalKey]) {
    globalObj[globalKey] = new MemoryVector();
  }
  return globalObj[globalKey]!;
}

export const vector = useMockVector
  ? getMemoryVector()
  : new Index({
      url: env.UPSTASH_VECTOR_REST_URL,
      token: env.UPSTASH_VECTOR_REST_TOKEN,
    });

export type SnippetMeta = {
  url: string;
  title: string;
  chunk: string;
  chunkIndex: number;
  indexedAt: string; // ISO
};
