// app/signin/page.tsx
import Image from "next/image";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import {
  resolveSignInError,
  sanitizeCallbackPath,
} from "@/lib/signin-messages";

type SignInPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function SignInPage({ searchParams = {} }: SignInPageProps) {
  const errorCode =
    typeof searchParams.error === "string" ? searchParams.error : undefined;
  const errorMessage = resolveSignInError(errorCode);

  const callbackFromParams = searchParams.callbackUrl;
  const callbackUrl =
    sanitizeCallbackPath(callbackFromParams) ?? "/dashboard";

  const hintId = "signin-hint";
  const alertId = errorMessage ? "signin-error" : undefined;
  const describedBy = [hintId, alertId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white">
      <main
        className="w-[520px] max-w-[92vw] rounded-3xl bg-neutral-900/70 px-8 pb-10 pt-9 shadow-[0_0_120px_40px_rgba(118,0,255,0.2)] backdrop-blur"
        role="main"
        aria-labelledby="signin-heading"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600/70 via-purple-500/70 to-fuchsia-500/80">
            <Image src="/logo.svg" alt="logo" width={28} height={28} priority />
          </div>
          <h1
            id="signin-heading"
            className="text-2xl font-extrabold uppercase tracking-[0.22em]"
          >
            Study With Feruzbek
          </h1>
        </div>

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

        <GoogleSignInButton
          callbackUrl={callbackUrl}
          describedById={describedBy}
        />

        <p id={hintId} className="mt-4 text-center text-sm text-neutral-300">
          We only support Google sign-in. You'll be redirected back to your dashboard.
        </p>
      </main>
    </div>
  );
}
