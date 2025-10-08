// app/signin/page.tsx
"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export default function SignInPage() {
  const sp = useSearchParams();
  const error = sp.get("error");

  const message = useMemo(() => {
    if (!error) return null;
    // keep it simple; we don’t expose internals
    return "Sign-in failed. Please try again.";
  }, [error]);

  const onClick = useCallback(() => {
    // opens Google account chooser and returns to /dashboard
    signIn("google", {
      callbackUrl: "/dashboard",
      // ask Google to always show the chooser
      prompt: "select_account",
      redirect: true,
    });
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-[#070b19] text-white">
      <div className="relative w-[560px] max-w-[92vw] rounded-3xl p-10 shadow-2xl"
           style={{ boxShadow: "0 0 150px rgba(150, 80, 255, .15), inset 0 0 120px rgba(50, 20, 90, .35)", background: "linear-gradient(180deg,#0b0f23 0%, #0a0e1f 100%)" }}>
        <div className="flex items-center justify-center gap-3 mb-6">
          <Image src="/logo.svg" alt="logo" width={36} height={36} priority />
          <h1 className="text-2xl font-semibold">Studywithferuzbek</h1>
        </div>

        <button
          onClick={onClick}
          className="btn-primary w-full"
          aria-label="Continue with Google"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-neutral-300 mt-5">
          We only support Google sign-in. You’ll be redirected back to your dashboard.
        </p>

        {message && (
          <p className="mt-4 text-center text-rose-400 text-sm">{message}</p>
        )}
      </div>
    </div>
  );
}
