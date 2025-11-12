export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const TIMER_APP_SRC = "/timer/flip_countdown_new/index.html";
const TIMER_TELEMETRY_ENABLED =
  (process.env.ENABLE_TIMER_TELEMETRY ?? "1").trim() !== "0";

function resolveTimerUrl(proto: string | null, host: string | null): string | null {
  if (host) return `${proto ?? "https"}://${host}${TIMER_APP_SRC}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;
  try {
    return new URL(TIMER_APP_SRC, siteUrl).toString();
  } catch {
    return null;
  }
}

function extractForwardedFor(header: string | null): string | null {
  if (!header) return null;
  const [first] = header.split(",");
  return first?.trim() ?? null;
}

async function probeTimer(url: string, meta: Record<string, unknown>) {
  const probe = await fetch(url, {
    method: "HEAD",
    cache: "no-store",
    redirect: "follow",
  });
  console.info("[timer-telemetry] embed probe ok", {
    url,
    status: probe.status,
    xFrameOptions: probe.headers.get("x-frame-options"),
    csp: probe.headers.get("content-security-policy"),
    vercelId: probe.headers.get("x-vercel-id"),
    ...meta,
  });
}

export async function POST(req: NextRequest) {
  if (!TIMER_TELEMETRY_ENABLED) {
    return new NextResponse(null, { status: 204 });
  }

  const forwardedFor = extractForwardedFor(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? null;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");

  const resolvedTimerUrl = resolveTimerUrl(proto, host);
  const meta = { forwardedFor, userAgent };

  if (!resolvedTimerUrl) {
    console.warn("[timer-telemetry] skipped, timer URL could not be resolved", meta);
    return NextResponse.json({ ok: false }, { status: 202 });
  }

  try {
    await probeTimer(resolvedTimerUrl, meta);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[timer-telemetry] embed probe failed", {
      url: resolvedTimerUrl,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
      ...meta,
    });
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}

