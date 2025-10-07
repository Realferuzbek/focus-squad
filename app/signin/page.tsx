// app/signin/page.tsx
"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="px-6 py-3 rounded-full text-white"
        style={{
          background:
            "linear-gradient(90deg, rgba(244,114,182,1) 0%, rgba(147,51,234,1) 100%)",
        }}
      >
        Continue with Google
      </button>
    </div>
  );
}
