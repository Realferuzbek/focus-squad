// app/signin/page.tsx
"use client";

import { useEffect } from "react";

export default function SignInPage() {
  // Set sv cookie after successful auth (middleware checks it)
  useEffect(() => {
    // noop here; cookie is set by /signin/sv route in next file if needed later
  }, []);

  const google = () => {
    const url = `/api/auth/signin/google?callbackUrl=${encodeURIComponent("/dashboard")}`;
    window.location.href = url;
  };

  return (
    <div className="min-h-[100dvh] bg-[#0b0b0f] text-white flex items-center justify-center">
      <div className="mx-4 w-full max-w-md rounded-2xl p-10"
           style={{ background: "linear-gradient(180deg,#12121a 0%,#0b0b0f 100%)", boxShadow: "0 10px 60px rgba(120,80,255,.2)" }}>
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/logo.svg" alt="logo" width={40} height={40} />
          <h1 className="text-2xl font-semibold tracking-tight">Studywithferuzbek</h1>
        </div>
        <button
          onClick={google}
          className="w-full rounded-xl py-3 text-base font-semibold
                     bg-gradient-to-r from-[#8a5bff] via-[#b157ff] to-[#ff5ddd] hover:opacity-90 transition"
        >
          Continue with Google
        </button>
        <p className="text-center text-sm text-zinc-400 mt-4">
          We only support Google sign-in. You’ll be redirected back to your dashboard.
        </p>
      </div>
    </div>
  );
}
