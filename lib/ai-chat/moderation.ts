import { openai } from "@/lib/rag/ai";

export interface ModerationResult {
  ok: boolean;
  reason?: string;
  category?: string;
}

const LOCAL_BLOCKLIST = [
  /kill myself/i,
  /suicide/i,
  /terrorist/i,
  /weapon/i,
  /hate\s+speech/i,
];

export async function moderateInput(
  text: string,
): Promise<ModerationResult> {
  if (!text || !text.trim()) {
    return { ok: true };
  }

  if (LOCAL_BLOCKLIST.some((re) => re.test(text))) {
    return { ok: false, reason: "blocked_keywords" };
  }

  if (!openai) {
    return { ok: true };
  }

  try {
    const response = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: text,
    });
    const result = response.results?.[0];
    if (result?.flagged) {
      const category =
        Object.entries(result.categories ?? {}).find(
          ([, value]) => value === true,
        )?.[0] ?? "flagged";
      return { ok: false, reason: "openai_flagged", category };
    }
    return { ok: true };
  } catch (error) {
    console.warn("[ai-chat] moderation failed", error);
    return { ok: true };
  }
}
