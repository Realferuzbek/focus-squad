import { readFile } from "fs/promises";
import path from "path";

export type AssistantKnowledge = {
  index: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: Array<{ href: string; title: string; description: string }>;
    note: string;
  };
  askAi: {
    eyebrow: string;
    title: string;
    intro: string;
    canDoTitle: string;
    canDo: string[];
    refusesTitle: string;
    refuses: string[];
    privacyTitle: string;
    privacyBody: string;
  };
  features: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ title: string; description: string }>;
  };
};

const KNOWLEDGE_PATH = path.join(
  process.cwd(),
  "content",
  "assistant-knowledge.json",
);

const FALLBACK: AssistantKnowledge = {
  index: {
    eyebrow: "Assistant Knowledge",
    title: "Assistant knowledge",
    intro: "Assistant knowledge is unavailable right now.",
    cards: [],
    note: "",
  },
  askAi: {
    eyebrow: "Ask AI Guide",
    title: "What Ask AI can and can't do",
    intro: "Assistant knowledge is unavailable right now.",
    canDoTitle: "What it can do",
    canDo: [],
    refusesTitle: "What it refuses",
    refuses: [],
    privacyTitle: "Privacy promise",
    privacyBody: "",
  },
  features: {
    eyebrow: "Focus Squad Features",
    title: "Focus Squad features",
    intro: "Assistant knowledge is unavailable right now.",
    items: [],
  },
};

export async function loadAssistantKnowledge(): Promise<AssistantKnowledge> {
  try {
    const raw = await readFile(KNOWLEDGE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AssistantKnowledge;
    if (!parsed?.index || !parsed?.askAi || !parsed?.features) {
      return FALLBACK;
    }
    return parsed;
  } catch (error) {
    console.warn("[assistant] failed to load assistant knowledge", error);
    return FALLBACK;
  }
}
