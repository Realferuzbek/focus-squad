const HTML_ESCAPE_REGEX = /[&<>"']/g;
const REGEXP_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;
const WHITESPACE_REGEX = /\s+/g;

export interface HighlightOptions {
  maxLength?: number;
}

function trimSnippet(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(WHITESPACE_REGEX, " ").trim();
}

export function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_REGEX, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

export function escapeRegExp(value: string): string {
  return value.replace(REGEXP_ESCAPE_REGEX, "\\$&");
}

function sliceSnippet(text: string, options?: HighlightOptions): string {
  const length = options?.maxLength ?? 200;
  return text.slice(0, length);
}

export function buildPlainSnippet(
  text: string | null | undefined,
  options?: HighlightOptions,
): string | null {
  const condensed = trimSnippet(text);
  if (!condensed) return null;
  return escapeHtml(sliceSnippet(condensed, options));
}

export function buildHighlightSnippet(
  text: string | null | undefined,
  query: string | null | undefined,
  options?: HighlightOptions,
): string | null {
  if (!query) {
    return buildPlainSnippet(text, options);
  }
  const condensed = trimSnippet(text);
  if (!condensed) return null;
  const snippet = escapeHtml(sliceSnippet(condensed, options));
  const escapedQuery = escapeHtml(trimSnippet(query));
  if (!escapedQuery) return snippet;
  const regex = new RegExp(`(${escapeRegExp(escapedQuery)})`, "gi");
  return snippet.replace(regex, "<mark>$1</mark>");
}

export function ensureSafeHtml(value: string | null | undefined): string {
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower.includes("<script") || lower.includes("<iframe")) {
    throw new Error("Unsafe HTML payload rejected");
  }
  return value;
}

