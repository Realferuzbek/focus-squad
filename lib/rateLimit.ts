const buckets = new Map<string, { ts: number; count: number }>();
export function rateLimit(key: string, max = 30, perMs = 60_000) {
  const now = Date.now();
  const item = buckets.get(key);
  if (!item || now - item.ts > perMs) { buckets.set(key, { ts: now, count: 1 }); return { ok: true }; }
  item.count++;
  if (item.count > max) return { ok: false };
  return { ok: true };
}
