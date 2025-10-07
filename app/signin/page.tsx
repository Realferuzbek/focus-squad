// app/signin/page.tsx
"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export default function SignInPage() {
  // best-effort: keep session-version cookie aligned (non-httpOnly)
  useEffect(() => {
    const ver = process.env.NEXT_PUBLIC_SESSION_VERSION || process.env.SESSION_VERSION;
    if (ver) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      document.cookie = `sv=${ver}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
    }
  }, []);

  return (
    <main className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-6 py-3 rounded-full text-white font-medium bg-gradient-to-r from-fuchsia-500 to-indigo-500 hover:opacity-95 transition"
        >
          Continue with Google
        </button>
        <p className="text-sm text-gray-400 mt-4">
          We only support Google sign-in. Your session persists, and you’ll auto-return to the dashboard.
        </p>
      </div>
    </main>
  );
}
