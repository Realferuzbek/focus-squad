export const runtime = "edge";

const TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  json: "application/json",
  ico: "image/x-icon",
};

export async function GET(
  _req: Request,
  ctx: { params: { path: string[] } }
) {
  const path = ctx.params.path.join("/");
  const upstream = `https://raw.githubusercontent.com/Realferuzbek/flip_countdown_new/main/${path}`;
  const res = await fetch(upstream, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return new Response("Not found", { status: res.status });
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const ct = TYPE[ext] || "application/octet-stream";
  return new Response(res.body, {
    headers: {
      "content-type": ct,
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
