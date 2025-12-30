"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TIMER_APP_SRC } from "@/app/feature/timer/constants";
import {
  TimerDebugPanel,
  type TimerIframeState,
  type TimerSwState,
} from "@/components/timer/TimerDebugPanel";

const LOAD_TIMEOUT_MS = 5000;
const POLL_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 200;

function buildIframeSrc(base: string, retryNonce: string | null): string {
  if (!retryNonce) return base;
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}retry=${encodeURIComponent(retryNonce)}`;
}

export function TimerFrame() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [retryNonce, setRetryNonce] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState<TimerIframeState["status"]>("loading");
  const [loadEvent, setLoadEvent] = useState(false);
  const [readyEvent, setReadyEvent] = useState(false);
  const [errorEvent, setErrorEvent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState("mount");
  const [isOffline, setIsOffline] = useState(false);
  const [swState, setSwState] = useState<TimerSwState | null>(null);

  const iframeSrc = useMemo(
    () => buildIframeSrc(TIMER_APP_SRC, retryNonce),
    [retryNonce],
  );

  const iframeState = useMemo<TimerIframeState>(
    () => ({
      status,
      loadEvent,
      readyEvent,
      errorEvent,
      lastEvent,
      errorMessage,
      retryCount,
      src: iframeSrc,
    }),
    [
      status,
      loadEvent,
      readyEvent,
      errorEvent,
      lastEvent,
      errorMessage,
      retryCount,
      iframeSrc,
    ],
  );

  const resetState = useCallback((eventLabel: string) => {
    setStatus("loading");
    setLoadEvent(false);
    setReadyEvent(false);
    setErrorEvent(false);
    setErrorMessage(null);
    setLastEvent(eventLabel);
  }, []);

  const handleRetry = useCallback(() => {
    resetState("retry");
    setRetryCount((prev) => prev + 1);
    setRetryNonce(String(Date.now()));
  }, [resetState]);

  const sendParentReady = useCallback((source: "mount" | "load") => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.postMessage(
        { type: "timer-parent-ready", source },
        window.location.origin,
      );
      setLastEvent(`parent-ready:${source}`);
    } catch {
      setLastEvent(`parent-ready:${source}:error`);
    }
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const currentWindow = iframeRef.current?.contentWindow;
      if (!currentWindow || event.source !== currentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      if ((event.data as { type?: string }).type !== "timer-ready") return;

      setReadyEvent(true);
      setStatus("ready");
      setLastEvent("ready");
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    sendParentReady("mount");
  }, [iframeSrc, sendParentReady]);

  useEffect(() => {
    if (status === "ready" || status === "error" || status === "timeout") return;
    let cancelled = false;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (cancelled) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        window.clearInterval(interval);
        return;
      }
      const currentWindow = iframeRef.current?.contentWindow;
      if (!currentWindow) return;
      try {
        if ((currentWindow as { __TIMER_READY__?: boolean }).__TIMER_READY__) {
          window.clearInterval(interval);
          setReadyEvent(true);
          setStatus("ready");
          setLastEvent("ready:poll");
        }
      } catch {
        window.clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [iframeSrc, status]);

  useEffect(() => {
    if (status === "ready" || status === "error" || status === "timeout") return;
    const timeout = window.setTimeout(() => {
      setStatus((prev) => {
        if (prev === "ready" || prev === "error") return prev;
        setErrorMessage("timeout");
        setLastEvent("timeout");
        return "timeout";
      });
    }, LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [iframeSrc, status]);

  const handleLoad = useCallback(() => {
    setLoadEvent(true);
    setLastEvent("load");
    sendParentReady("load");
  }, [sendParentReady]);

  const handleError = useCallback(() => {
    setErrorEvent(true);
    setErrorMessage("iframe error");
    setStatus("error");
    setLastEvent("error");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      setSwState({
        controller: false,
        active: null,
        waiting: null,
        installing: null,
      });
      return;
    }

    let cancelled = false;
    const cleanup: Array<() => void> = [];

    const updateState = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (cancelled) return;
      setSwState({
        controller: Boolean(navigator.serviceWorker.controller),
        active: reg?.active?.state ?? null,
        waiting: reg?.waiting?.state ?? null,
        installing: reg?.installing?.state ?? null,
      });
    };

    const attachWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onState = () => {
        updateState().catch(() => {});
      };
      worker.addEventListener("statechange", onState);
      cleanup.push(() => worker.removeEventListener("statechange", onState));
    };

    updateState()
      .then(() => navigator.serviceWorker.getRegistration())
      .then((reg) => {
        if (cancelled || !reg) return;
        const onUpdateFound = () => {
          updateState().catch(() => {});
        };
        reg.addEventListener("updatefound", onUpdateFound);
        cleanup.push(() => reg.removeEventListener("updatefound", onUpdateFound));
        attachWorker(reg.active);
        attachWorker(reg.waiting);
        attachWorker(reg.installing);
      })
      .catch(() => {});

    const onControllerChange = () => {
      updateState().catch(() => {});
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    cleanup.push(() =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      ),
    );

    return () => {
      cancelled = true;
      cleanup.forEach((fn) => fn());
    };
  }, []);

  const showFallback = status === "timeout" || status === "error";

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#050816]">
      <TimerDebugPanel
        iframeState={iframeState}
        offline={isOffline}
        swState={swState}
      />
      <iframe
        ref={iframeRef}
        key={retryCount}
        src={iframeSrc}
        title="Focus Squad Timer"
        className="block h-[100dvh] min-h-[100dvh] w-full border-0"
        // EFFECT: Prioritize the embedded timer so it becomes the LCP element faster.
        fetchPriority="high"
        importance="high"
        allow="fullscreen"
        allowFullScreen
        onLoad={handleLoad}
        onError={handleError}
      />
      {showFallback ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050816]/95 text-white">
          <div className="mx-auto max-w-md px-6 text-center">
            <h1 className="text-lg font-semibold">Timer didn't load</h1>
            <p className="mt-2 text-sm text-white/70">
              {isOffline
                ? "You're offline. Reconnect and try again."
                : "Try reloading the timer or hard reload the page."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white hover:border-white/40"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Hard reload page
              </button>
              <button
                type="button"
                onClick={() => window.open(TIMER_APP_SRC, "_blank", "noopener")}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white hover:border-white/30"
              >
                Open timer in new tab
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
