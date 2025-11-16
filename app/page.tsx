// app/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCachedSession } from "@/lib/server-session";
import SignInInteractive from "@/components/SignInInteractive";

export default async function Home() {
  const session = await getCachedSession();
  if (session?.user) {
    redirect("/dashboard");
  }
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
          <Suspense
            fallback={
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80" />
            }
          >
            <SignInInteractive defaultCallbackUrl="/dashboard" hintId={hintId} />
          </Suspense>
          <p id={hintId} className="text-sm text-zinc-400">
            We only support Google sign-in. You&apos;ll be redirected back to your
            dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
