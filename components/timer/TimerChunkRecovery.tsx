"use client";

import { useEffect } from "react";

const RETRY_KEY = "timer:chunk-retry";
const MAX_RETRIES = 1;
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

function readRetryCount(): number {
  try {
    const raw = sessionStorage.getItem(RETRY_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeRetryCount(count: number) {
  try {
    sessionStorage.setItem(RETRY_KEY, String(count));
  } catch {
    // ignore storage errors
  }
}

export function TimerChunkRecovery() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChunkError = (source: string, error: unknown) => {
      const message = getErrorMessage(error);
      if (!CHUNK_ERROR_PATTERN.test(message)) return;

      const attempts = readRetryCount();
      if (attempts >= MAX_RETRIES) {
        console.error("[timer] chunk load failed after retry", {
          source,
          message,
        });
        return;
      }

      writeRetryCount(attempts + 1);
      console.warn("[timer] chunk load failed; reloading", {
        source,
        message,
      });
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      handleChunkError("error", event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      handleChunkError("unhandledrejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
