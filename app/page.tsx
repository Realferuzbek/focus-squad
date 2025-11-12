// app/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getCachedSession } from "@/lib/server-session";
import SignInInteractive from "@/components/SignInInteractive";
import { SWITCH_ACCOUNT_DISABLED_NOTICE } from "@/lib/signin-messages";

export default async function Home() {
  const session = await getCachedSession();
  const isSignedIn = !!session?.user;
  const hintId = "home-auth-hint";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
          <Image
            src="/logo.svg"
            alt="Studywithferuzbek"
            width={40}
            height={40}
          />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">Studywithferuzbek</h1>
        <p className="mt-2 text-sm font-medium uppercase tracking-[0.3em] text-fuchsia-300/70">
          Welcome back
        </p>

        <div className="mt-8 space-y-3">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="block rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] px-6 py-3 text-base font-semibold shadow-[0_18px_35px_rgba(138,92,246,0.35)] transition hover:shadow-[0_25px_50px_rgba(138,92,246,0.45)]"
              >
                Go to dashboard
              </Link>
              <div className="flex flex-col items-center gap-2 text-sm text-zinc-400">
                <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.3em]">
                  <span className="text-zinc-500" aria-disabled>
                    Switch account
                  </span>
                  <span className="text-zinc-600">•</span>
                  <Link
                    href="/api/auth/signout?callbackUrl=/signin"
                    className="transition hover:text-white"
                  >
                    Sign out
                  </Link>
                </div>
                <p className="text-[13px] text-zinc-500">
                  {SWITCH_ACCOUNT_DISABLED_NOTICE.description}
                </p>
              </div>
            </>
          ) : (
            <>
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80" />
                }
              >
                <SignInInteractive
                  defaultCallbackUrl="/dashboard"
                  hintId={hintId}
                />
              </Suspense>
              <p
                id={hintId}
                className="text-sm text-zinc-400"
              >
                We only support Google sign-in. You&apos;ll be redirected back to your
                dashboard.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
