import { detect } from "tinyld";

export type SupportedLanguage = "en" | "uz" | "ru";

export interface LanguageDetectionResult {
  code: SupportedLanguage;
  raw: string | null;
  confidence: number;
}

const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  eng: "en",
  english: "en",
  uz: "uz",
  uzb: "uz",
  "uz-latn": "uz",
  "uz-uz": "uz",
  uzbek: "uz",
  ru: "ru",
  rus: "ru",
  "ru-ru": "ru",
  russian: "ru",
};

const UZ_KEYWORDS =
  /(salom|assalomu|rahmat|bo['’`]?yicha|qanday|maqsadim|o'qish|o‘qish|ishlayman|reja)/i;
const CYRILLIC_REGEX = /[А-Яа-яЁё]/g;

export function detectLanguage(input: string): LanguageDetectionResult {
  if (!input || !input.trim()) {
    return { code: "en", raw: null, confidence: 0 };
  }

  const trimmed = input.trim();
  const scriptGuess = guessByScript(trimmed);
  if (scriptGuess) {
    return { code: scriptGuess, raw: scriptGuess, confidence: 0.92 };
  }

  let raw: string | null = null;
  try {
    raw = detect(trimmed) ?? null;
  } catch {
    raw = null;
  }

  const normalized = normalizeLanguageCode(raw);
  if (normalized !== "en") {
    return { code: normalized, raw, confidence: 0.65 };
  }

  if (UZ_KEYWORDS.test(trimmed)) {
    return { code: "uz", raw: "uz", confidence: 0.6 };
  }

  return { code: "en", raw, confidence: 0.5 };
}

function normalizeLanguageCode(code: string | null): SupportedLanguage {
  if (!code) return "en";
  const mapped = LANGUAGE_MAP[code.toLowerCase()];
  return mapped ?? "en";
}

function guessByScript(value: string): SupportedLanguage | null {
  const cyrillicMatches = value.match(CYRILLIC_REGEX)?.length ?? 0;
  if (cyrillicMatches >= 4) return "ru";

  if (UZ_KEYWORDS.test(value)) return "uz";
  const containsOsh = /o['’`]?z/i.test(value);
  if (containsOsh) return "uz";
  return null;
}

export function getLanguageLabel(code: SupportedLanguage) {
  switch (code) {
    case "ru":
      return "Russian";
    case "uz":
      return "Uzbek";
    default:
      return "English";
  }
}
