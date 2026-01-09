export function isTelegramWebView(ua?: string): boolean {
  if (typeof ua !== "string" || ua.length === 0) return false;
  return /telegram/i.test(ua);
}

export function buildExternalSigninUrl(currentUrl: string): string {
  try {
    const url = new URL(currentUrl);
    url.pathname = "/signin";
    url.hash = "";
    if (!url.searchParams.has("src")) {
      url.searchParams.set("src", "telegram");
    }
    return url.toString();
  } catch {
    return "/signin?src=telegram";
  }
}
