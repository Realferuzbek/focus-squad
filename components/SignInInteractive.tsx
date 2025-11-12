"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  resolveSignInError,
  sanitizeCallbackPath,
  SWITCH_ACCOUNT_DISABLED_NOTICE,
} from "@/lib/signin-messages";

const SWITCH_ACCOUNT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SWITCH_ACCOUNT === "1";

type SignInInteractiveProps = {
  defaultCallbackUrl: string;
  hintId: string;
};

export default function SignInInteractive({
  defaultCallbackUrl,
  hintId,
}: SignInInteractiveProps) {
  const params = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);

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

  const alertId = errorMessage ? "signin-error" : undefined;
  const blockedAlertId = blockedMessage ? "signin-blocked" : undefined;
  const switchAlertId = !switchMode && switchRequested ? "signin-switch" : undefined;
  const describedBy =
    [hintId, alertId, blockedAlertId, switchAlertId]
      .filter(Boolean)
      .join(" ") || undefined;

  const handleClick = useCallback(() => {
    if (redirecting) return;
    setRedirecting(true);
    // EFFECT: Starts the Google OAuth flow without bundling next-auth/react, keeping JS light.
    const url = new URL("/api/auth/signin/google", window.location.origin);
    url.searchParams.set("callbackUrl", callbackUrl);
    if (switchMode) {
      url.searchParams.set("prompt", "select_account");
    }
    window.location.assign(url.toString());
  }, [callbackUrl, redirecting, switchMode]);

  useEffect(() => {
    if (switchMode && !redirecting) {
      handleClick();
    }
  }, [handleClick, redirecting, switchMode]);

  const idleLabel = switchMode
    ? "Switch account with Google"
    : "Continue with Google";
  const redirectLabel = switchMode ? "Switching..." : "Redirecting...";
  const srStatus = switchMode
    ? "Switching accounts through Google..."
    : "Redirecting to Google...";

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
