"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TIMER_APP_SRC } from "@/app/feature/timer/constants";

type FetchProbe = {
  status: number;
  ok: boolean;
  xFrameOptions: string | null;
  csp: string | null;
  cspReportOnly: string | null;
  error?: string;
};

export type TimerIframeState = {
  status: "loading" | "ready" | "timeout" | "error";
  loadEvent: boolean;
  errorEvent: boolean;
  readyEvent: boolean;
  lastEvent: string;
  errorMessage?: string | null;
  retryCount: number;
  src: string;
};

export type TimerSwState = {
  controller: boolean;
  active: string | null;
  waiting: string | null;
  installing: string | null;
};

type TimerDebugPanelProps = {
  iframeState?: TimerIframeState | null;
  offline?: boolean;
  swState?: TimerSwState | null;
};

const DEBUG_PARAM = "timerDebug";
const DEBUG_ENV_ENABLED = process.env.NEXT_PUBLIC_TIMER_DEBUG === "1";
const CHUNK_ERROR_PATTERN = /(Loading chunk|ChunkLoadError|Loading CSS chunk)/i;

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

function readBuildId(): string | null {
  if (typeof window === "undefined") return null;
  const fromGlobal = (window as { __NEXT_DATA__?: { buildId?: string } })
    .__NEXT_DATA__?.buildId;
  if (fromGlobal) return fromGlobal;
  const script = document.getElementById("__NEXT_DATA__");
  if (!script?.textContent) return null;
  try {
    const parsed = JSON.parse(script.textContent) as { buildId?: string };
    return parsed.buildId ?? null;
  } catch {
    return null;
  }
}

function shorten(value: string, max = 90): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export function TimerDebugPanel({
  iframeState,
  offline,
  swState,
}: TimerDebugPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [buildId, setBuildId] = useState<string | null>(null);
  const [chunkStatus, setChunkStatus] = useState<string>("ok");
  const [fetchProbe, setFetchProbe] = useState<FetchProbe | null>(null);
  const probeSrc = iframeState?.src ?? TIMER_APP_SRC;

  const debugEnabled = useMemo(() => {
    if (DEBUG_ENV_ENABLED) return true;
    const flag = searchParams?.get(DEBUG_PARAM);
    return flag === "1" || flag === "true";
  }, [searchParams]);

  const routeLabel = useMemo(() => {
    const params = searchParams?.toString() ?? "";
    return params ? `${pathname}?${params}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!debugEnabled) return;
    const resolvedBuildId = readBuildId();
    setBuildId(resolvedBuildId);
    console.info("[timer-debug] enabled", {
      route: routeLabel,
      buildId: resolvedBuildId,
    });
  }, [debugEnabled, routeLabel]);

  useEffect(() => {
    if (!debugEnabled) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);

    const runProbe = async () => {
      try {
        const res = await fetch(probeSrc, {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        if (cancelled) return;
        const nextProbe = {
          status: res.status,
          ok: res.ok,
          xFrameOptions: res.headers.get("x-frame-options"),
          csp: res.headers.get("content-security-policy"),
          cspReportOnly: res.headers.get("content-security-policy-report-only"),
        };
        setFetchProbe(nextProbe);
        console.info("[timer-debug] iframe probe", nextProbe);
      } catch (error) {
        if (cancelled) return;
        const message = getErrorMessage(error);
        setFetchProbe({
          status: 0,
          ok: false,
          xFrameOptions: null,
          csp: null,
          cspReportOnly: null,
          error: message || "probe failed",
        });
        console.warn("[timer-debug] iframe probe failed", { error: message });
      } finally {
        window.clearTimeout(timeout);
      }
    };

    runProbe();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [debugEnabled, probeSrc]);

  useEffect(() => {
    if (!debugEnabled) return;
    const onError = (event: ErrorEvent) => {
      const message = getErrorMessage(event.error ?? event.message);
      if (!CHUNK_ERROR_PATTERN.test(message)) return;
      setChunkStatus(`error: ${shorten(message, 120)}`);
      console.error("[timer-debug] chunk error", { message });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = getErrorMessage(event.reason);
      if (!CHUNK_ERROR_PATTERN.test(message)) return;
      setChunkStatus(`error: ${shorten(message, 120)}`);
      console.error("[timer-debug] chunk rejection", { message });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [debugEnabled]);

  if (!debugEnabled) return null;

  const fetchSummary = fetchProbe
    ? fetchProbe.error
      ? `error: ${shorten(fetchProbe.error, 120)}`
      : `${fetchProbe.status} ${fetchProbe.ok ? "ok" : "fail"}`
    : "pending";
  const xfoSummary = fetchProbe?.xFrameOptions ?? "none";
  const cspSummary = fetchProbe?.csp ? shorten(fetchProbe.csp, 80) : "none";
  const cspReportSummary = fetchProbe?.cspReportOnly
    ? shorten(fetchProbe.cspReportOnly, 80)
    : "none";
  const iframeStatus = iframeState?.status ?? "unknown";
  const iframeLast = iframeState?.lastEvent ?? "unknown";
  const iframeReady = iframeState
    ? iframeState.readyEvent
      ? "yes"
      : "no"
    : "unknown";
  const iframeLoad = iframeState
    ? iframeState.loadEvent
      ? "yes"
      : "no"
    : "unknown";
  const iframeError = iframeState
    ? iframeState.errorEvent
      ? "yes"
      : "no"
    : "unknown";
  const iframeErrorMessage =
    iframeState?.errorMessage ? shorten(iframeState.errorMessage, 120) : null;
  const iframeSrc = iframeState?.src ? shorten(iframeState.src, 80) : "unknown";
  const iframeRetries =
    typeof iframeState?.retryCount === "number" ? iframeState.retryCount : 0;
  const offlineSummary = offline ? "yes" : "no";
  const swControllerSummary = swState?.controller ? "yes" : "no";
  const swActiveSummary = swState?.active ?? "none";
  const swWaitingSummary = swState?.waiting ?? "none";
  const swInstallingSummary = swState?.installing ?? "none";

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(90vw,360px)] rounded-xl border border-white/10 bg-black/80 p-3 text-xs text-white shadow-2xl backdrop-blur">
      <div className="mb-2 text-sm font-semibold">TimerDebug</div>
      <div className="space-y-1 font-mono">
        <div>route: {routeLabel}</div>
        <div>buildId: {buildId ?? "unknown"}</div>
        <div>chunk: {chunkStatus}</div>
        <div>fetch: {fetchSummary}</div>
        <div>xfo: {xfoSummary}</div>
        <div>csp: {cspSummary}</div>
        <div>csp-ro: {cspReportSummary}</div>
        <div>iframe: {iframeStatus}</div>
        <div>iframe-last: {iframeLast}</div>
        <div>timer-ready: {iframeReady}</div>
        <div>iframe-load: {iframeLoad}</div>
        <div>
          iframe-error: {iframeError}
          {iframeErrorMessage ? ` (${iframeErrorMessage})` : ""}
        </div>
        <div>iframe-retries: {iframeRetries}</div>
        <div>iframe-src: {iframeSrc}</div>
        <div>offline: {offlineSummary}</div>
        <div>sw-controller: {swControllerSummary}</div>
        <div>sw-active: {swActiveSummary}</div>
        <div>sw-waiting: {swWaitingSummary}</div>
        <div>sw-installing: {swInstallingSummary}</div>
      </div>
    </aside>
  );
}
