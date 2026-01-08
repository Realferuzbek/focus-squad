import { randomUUID } from "crypto";
import { z } from "zod";

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_GEN_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_EMBED_MODEL: z.string().default("text-embedding-3-small"),

  UPSTASH_VECTOR_REST_URL: z.string().url(),
  UPSTASH_VECTOR_REST_TOKEN: z.string().min(1),
  UPSTASH_INDEX_NAME: z.string().default("focus-squad-site"),
  UPSTASH_VECTOR_DIM: z.string().optional(),

  SITE_BASE_URL: z.string().url(),
  INDEXER_SECRET: z.string().min(16),

  CRAWL_MAX_PAGES: z.string().default("400"),
  CRAWL_MAX_DEPTH: z.string().default("3"),
  CRAWL_ALLOWED_PATHS: z.string().default("/"),
  CRAWL_BLOCKED_PATHS: z
    .string()
    .default("/admin,/dashboard,/signin,/api,/_next,/static,/assets,/community/admin"),
});

type EnvInput = z.input<typeof EnvSchema>;

const REQUIRED_KEYS: (keyof EnvInput)[] = [
  "OPENAI_API_KEY",
  "UPSTASH_VECTOR_REST_URL",
  "UPSTASH_VECTOR_REST_TOKEN",
  "SITE_BASE_URL",
  "INDEXER_SECRET",
];

const FALLBACK_ENV: EnvInput = {
  OPENAI_API_KEY: "mock",
  OPENAI_GEN_MODEL: "gpt-5-mini",
  OPENAI_EMBED_MODEL: "text-embedding-3-small",
  UPSTASH_VECTOR_REST_URL: "https://example.com/mock-vector",
  UPSTASH_VECTOR_REST_TOKEN: "mock-token",
  UPSTASH_INDEX_NAME: "focus-squad-site",
  SITE_BASE_URL: "https://example.com",
  INDEXER_SECRET: randomUUID(),
  CRAWL_MAX_PAGES: "400",
  CRAWL_MAX_DEPTH: "3",
  CRAWL_ALLOWED_PATHS: "/",
  CRAWL_BLOCKED_PATHS:
    "/admin,/dashboard,/signin,/api,/_next,/static,/assets,/community/admin",
};

const rawEnv: Partial<EnvInput> = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_GEN_MODEL: process.env.OPENAI_GEN_MODEL,
  OPENAI_EMBED_MODEL: process.env.OPENAI_EMBED_MODEL,

  UPSTASH_VECTOR_REST_URL: process.env.UPSTASH_VECTOR_REST_URL,
  UPSTASH_VECTOR_REST_TOKEN: process.env.UPSTASH_VECTOR_REST_TOKEN,
  UPSTASH_INDEX_NAME: process.env.UPSTASH_INDEX_NAME,
  UPSTASH_VECTOR_DIM: process.env.UPSTASH_VECTOR_DIM,

  SITE_BASE_URL: process.env.SITE_BASE_URL,
  INDEXER_SECRET: process.env.INDEXER_SECRET,

  CRAWL_MAX_PAGES: process.env.CRAWL_MAX_PAGES,
  CRAWL_MAX_DEPTH: process.env.CRAWL_MAX_DEPTH,
  CRAWL_ALLOWED_PATHS: process.env.CRAWL_ALLOWED_PATHS,
  CRAWL_BLOCKED_PATHS: process.env.CRAWL_BLOCKED_PATHS,
};

const withDefinedValues = <T extends Record<string, unknown>>(
  source: Partial<T>,
) => {
  const entries = Object.entries(source).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  return Object.fromEntries(entries) as Partial<T>;
};

const missingKeys = REQUIRED_KEYS.filter((key) => {
  const value = rawEnv[key];
  return typeof value !== "string" || value.trim() === "";
});

if (missingKeys.length) {
  console.warn(
    `[env] Missing rag env vars (${missingKeys.join(
      ", ",
    )}); falling back to mock defaults so deployment can proceed.`,
  );
}

const parsed = EnvSchema.parse({
  ...FALLBACK_ENV,
  ...withDefinedValues(rawEnv),
});

export const isMockRagEnv = missingKeys.length > 0;

const toPositiveInt = (value?: string) => {
  if (!value) return 1536;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    console.warn(
      "[env] Invalid UPSTASH_VECTOR_DIM value provided. Falling back to 1536.",
    );
    return 1536;
  }
  return Math.floor(parsedValue);
};

export const env = {
  ...parsed,
  UPSTASH_VECTOR_DIM: toPositiveInt(parsed.UPSTASH_VECTOR_DIM),
};

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
