import { z } from "zod";

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_GEN_MODEL: z.string().default("gpt-4.1"),
  OPENAI_EMBED_MODEL: z.string().default("text-embedding-3-large"),

  UPSTASH_VECTOR_REST_URL: z.string().url(),
  UPSTASH_VECTOR_REST_TOKEN: z.string().min(1),
  UPSTASH_INDEX_NAME: z.string().default("study-with-feruzbek-site"),

  SITE_BASE_URL: z.string().url(),
  INDEXER_SECRET: z.string().min(16),

  CRAWL_MAX_PAGES: z.string().default("400"),
  CRAWL_MAX_DEPTH: z.string().default("3"),
  CRAWL_ALLOWED_PATHS: z.string().default("/"),
  CRAWL_BLOCKED_PATHS: z.string().default("/api,/_next,/static,/assets"),
});

export const env = EnvSchema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_GEN_MODEL: process.env.OPENAI_GEN_MODEL,
  OPENAI_EMBED_MODEL: process.env.OPENAI_EMBED_MODEL,

  UPSTASH_VECTOR_REST_URL: process.env.UPSTASH_VECTOR_REST_URL,
  UPSTASH_VECTOR_REST_TOKEN: process.env.UPSTASH_VECTOR_REST_TOKEN,
  UPSTASH_INDEX_NAME: process.env.UPSTASH_INDEX_NAME,

  SITE_BASE_URL: process.env.SITE_BASE_URL,
  INDEXER_SECRET: process.env.INDEXER_SECRET,

  CRAWL_MAX_PAGES: process.env.CRAWL_MAX_PAGES,
  CRAWL_MAX_DEPTH: process.env.CRAWL_MAX_DEPTH,
  CRAWL_ALLOWED_PATHS: process.env.CRAWL_ALLOWED_PATHS,
  CRAWL_BLOCKED_PATHS: process.env.CRAWL_BLOCKED_PATHS,
});

export const numeric = {
  MAX_PAGES: Number(env.CRAWL_MAX_PAGES ?? 400),
  MAX_DEPTH: Number(env.CRAWL_MAX_DEPTH ?? 3),
};

export const arrays = {
  ALLOWED: env.CRAWL_ALLOWED_PATHS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  BLOCKED: env.CRAWL_BLOCKED_PATHS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
