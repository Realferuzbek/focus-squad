export function isTelegramWebView(ua?: string): boolean {
  if (typeof ua !== "string" || ua.length === 0) return false;
  return /telegram/i.test(ua);
}
