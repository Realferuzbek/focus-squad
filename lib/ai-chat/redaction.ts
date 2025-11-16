export type RedactionStatus = "redacted" | "skipped" | "failed";

const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:(?:\+?\d{1,3}[-\s.]*)?(?:\(?\d{2,4}\)?[-\s.]*)?\d{3}[-\s.]?\d{2,4}[-\s.]?\d{2,4})/g;
const ADDRESS_PATTERN =
  /\b\d{1,4}\s+(?:[A-Za-z0-9]+\s){1,4}(?:street|st\.|road|rd\.|avenue|ave\.|drive|dr\.|lane|ln\.|boulevard|blvd\.|way)\b/gi;
const TELEGRAM_PATTERN = /@[a-z0-9_]{5,}/gi;

export function redactForStorage(input: string): {
  value: string;
  status: RedactionStatus;
} {
  if (!input) return { value: "", status: "skipped" };
  try {
    let next = input;
    let changed = false;
    const replace = (pattern: RegExp, label: string) => {
      next = next.replace(pattern, () => {
        changed = true;
        return `[redacted ${label}]`;
      });
    };

    replace(EMAIL_PATTERN, "email");
    replace(PHONE_PATTERN, "phone");
    replace(ADDRESS_PATTERN, "address");
    replace(TELEGRAM_PATTERN, "handle");

    return { value: next, status: changed ? "redacted" : "skipped" };
  } catch (error) {
    console.warn("[ai-chat] redaction failed", error);
    return { value: input, status: "failed" };
  }
}
