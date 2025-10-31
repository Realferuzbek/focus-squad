import { NextRequest } from "next/server";

const ASSET_BASE = "https://raw.githubusercontent.com/Realferuzbek/flip_countdown_new/main/";

const CONTENT_TYPES = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".mp3", "audio/mpeg"],
  [".json", "application/json"],
  [".ico", "image/x-icon"],
]);

function getContentType(path: string, fallback?: string | null) {
  const lower = path.toLowerCase();
  for (const [ext, type] of CONTENT_TYPES) {
    if (lower.endsWith(ext)) {
      return type;
    }
  }
  return fallback ?? "application/octet-stream";
}

function buildTargetUrl(pathSegments: string[]) {
  const assetPath = pathSegments.join("/");
  return `${ASSET_BASE}${assetPath}`;
}

function isValidPath(pathSegments: string[]) {
  return pathSegments.length > 0 && pathSegments.every((segment) => segment && !segment.includes(".."));
}

export async function GET(_request: NextRequest, context: { params: { path?: string[] } }) {
  const segments = context.params?.path ?? [];

  if (!isValidPath(segments)) {
    return new Response("Invalid asset path", { status: 400 });
  }

  const targetUrl = buildTargetUrl(segments);

  const response = await fetch(targetUrl, {
    headers: {
      Accept: "*/*",
      "User-Agent": "study-with-feruzbek-timer-proxy",
    },
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const bodyText = await response.text().catch(() => "Asset fetch failed");
    return new Response(bodyText, { status: response.status });
  }

  const contentType = getContentType(targetUrl, response.headers.get("content-type"));

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  const etag = response.headers.get("etag");
  if (etag) {
    headers.set("ETag", etag);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
