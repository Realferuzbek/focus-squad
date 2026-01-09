"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  resolveSignInError,
  sanitizeCallbackPath,
  SWITCH_ACCOUNT_DISABLED_NOTICE,
} from "@/lib/signin-messages";
import { buildExternalSigninUrl, isTelegramWebView } from "@/lib/inapp-browser";

const SWITCH_ACCOUNT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SWITCH_ACCOUNT === "1";

type SignInInteractiveProps = {
  defaultCallbackUrl: string;
  hintId: string;
  initialIsTelegramWebView?: boolean;
};

export default function SignInInteractive({
  defaultCallbackUrl,
  hintId,
  initialIsTelegramWebView,
}: SignInInteractiveProps) {
  const params = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [openBlocked, setOpenBlocked] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [telegramWebView, setTelegramWebView] = useState(
    () => initialIsTelegramWebView ?? false,
  );

  const switchRequested = params.get("switch") === "1";
  const switchMode = SWITCH_ACCOUNT_ENABLED && switchRequested;

  const errorCode = params.get("error");
  const blockedValues = params.getAll("blocked");
  const blockedParam =
    blockedValues.find((value) => value != null) ?? params.get("blocked");

  const errorMessage = useMemo(
    () => resolveSignInError(errorCode ?? undefined),
    [errorCode],
  );
  const blockedMessage = useMemo(() => {
    if (!blockedParam) return null;
    return blockedParam === "1"
      ? {
          title: "Account temporarily locked",
          description:
            "Your account was blocked by an administrator. Please contact support if you believe this is a mistake.",
        }
      : null;
  }, [blockedParam]);

  const callbackUrl = useMemo(() => {
    const callbackCandidates = params.getAll("callbackUrl");
    const callback =
      callbackCandidates.find((value) => value != null) ??
      params.get("callbackUrl");
    return sanitizeCallbackPath(callback) ?? defaultCallbackUrl;
  }, [params, defaultCallbackUrl]);

  const srcFromTelegram = useMemo(() => {
    const values = params.getAll("src");
    if (values.some((value) => value?.toLowerCase() === "telegram")) {
      return true;
    }
    const single = params.get("src");
    return single?.toLowerCase() === "telegram";
  }, [params]);

  const alertId = errorMessage ? "signin-error" : undefined;
  const blockedAlertId = blockedMessage ? "signin-blocked" : undefined;
  const switchAlertId = !switchMode && switchRequested ? "signin-switch" : undefined;
  const describedBy =
    [hintId, alertId, blockedAlertId, switchAlertId]
      .filter(Boolean)
      .join(" ") || undefined;

  const handleClick = useCallback(() => {
    if (redirecting || telegramWebView) return;
    setRedirecting(true);
    signIn(
      "google",
      { callbackUrl, redirect: true },
      { prompt: "select_account" },
    ).catch((error) => {
      console.error("[signin] failed to start Google OAuth", error);
      setRedirecting(false);
    });
  }, [callbackUrl, redirecting, telegramWebView]);

  const handleExternalBrowserClick = useCallback(() => {
    if (typeof window === "undefined") return;
    const targetUrl =
      externalUrl ?? buildExternalSigninUrl(window.location.href);

    if (telegramWebView && isAndroid) {
      const intentUrl = buildAndroidIntentUrl(targetUrl);
      if (intentUrl) {
        try {
          window.location.href = intentUrl;
        } catch {
          // Ignore intent errors and fall back to window.open.
        }
      }
    }

    const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
    setOpenBlocked(!opened);
  }, [externalUrl, isAndroid, telegramWebView]);

  useEffect(() => {
    if (switchMode && !redirecting && !telegramWebView) {
      handleClick();
    }
  }, [handleClick, redirecting, switchMode, telegramWebView]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setTelegramWebView(isTelegramWebView(navigator.userAgent));
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setExternalUrl(buildExternalSigninUrl(window.location.href));
  }, [params]);

  const idleLabel = switchMode
    ? "Switch account with Google"
    : "Continue with Google";
  const redirectLabel = switchMode ? "Switching..." : "Redirecting...";
  const srStatus = switchMode
    ? "Switching accounts through Google..."
    : "Redirecting to Google...";

  const telegramHelperId = "signin-telegram-helper";

  if (telegramWebView) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleExternalBrowserClick}
          aria-describedby={telegramHelperId}
          className="relative inline-flex h-12 min-h-[48px] w-full items-center justify-center rounded-2xl bg-[linear-gradient(120deg,#7c3aed,#8b5cf6,#a855f7,#ec4899)] px-6 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(123,58,237,0.35)] transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          Continue in Browser
        </button>
        <p id={telegramHelperId} className="text-sm text-neutral-300">
          Telegram&apos;s in-app browser may ask for email again. Continue in
          browser for quickest sign-in.
        </p>
        {openBlocked && externalUrl ? (
          <p className="text-sm text-neutral-400">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline decoration-white/60 underline-offset-4 transition hover:text-white/90"
            >
              Open in browser
            </a>
          </p>
        ) : null}
        {openBlocked ? (
          <p className="text-sm text-neutral-400">
            Tap the menu and choose Open in browser.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {blockedMessage ? (
        <div
          id={blockedAlertId}
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-50"
        >
          <p className="font-semibold">{blockedMessage.title}</p>
          <p className="mt-1 text-yellow-100/80">
            {blockedMessage.description}
          </p>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          id={alertId}
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
        >
          <p className="font-semibold">{errorMessage.title}</p>
          <p className="mt-1 text-red-50/80">{errorMessage.description}</p>
        </div>
      ) : null}

      {!switchMode && switchRequested ? (
        <div
          id={switchAlertId}
          role="status"
          aria-live="polite"
          className="mb-4 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100"
        >
          <p className="font-semibold">
            {SWITCH_ACCOUNT_DISABLED_NOTICE.title}
          </p>
          <p className="mt-1 text-fuchsia-100/80">
            {SWITCH_ACCOUNT_DISABLED_NOTICE.description}
          </p>
        </div>
      ) : null}

      {srcFromTelegram ? (
        <p className="mb-3 text-sm text-emerald-200">
          You&apos;re in browser ✅
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={redirecting}
        aria-busy={redirecting}
        aria-describedby={describedBy}
        className="relative inline-flex h-12 min-h-[48px] w-full items-center justify-center rounded-2xl bg-[linear-gradient(120deg,#7c3aed,#8b5cf6,#a855f7,#ec4899)] px-6 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(123,58,237,0.35)] transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-75"
      >
        <span role="status" aria-live="polite" className="sr-only">
          {redirecting ? srStatus : ""}
        </span>
        {redirecting ? redirectLabel : idleLabel}
      </button>
    </>
  );
}

function buildAndroidIntentUrl(targetUrl: string): string | null {
  try {
    const url = new URL(targetUrl);
    const isLocalhost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";
    const scheme = isLocalhost ? "http" : "https";
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${scheme};end`;
  } catch {
    return null;
  }
}
