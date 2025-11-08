"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
  className?: string;
  label?: string;
  describedById?: string;
};

export default function GoogleSignInButton({
  callbackUrl = "/dashboard",
  className,
  label = "Continue with Google",
  describedById,
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } finally {
      setLoading(false);
    }
  }

  const baseClass =
    "relative inline-flex h-12 min-h-[48px] w-full items-center justify-center rounded-2xl bg-[linear-gradient(120deg,#7c3aed,#8b5cf6,#a855f7,#ec4899)] px-6 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(123,58,237,0.35)] transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-75";

  const mergedClass = className ? `${baseClass} ${className}` : baseClass;
  const describedBy = describedById?.trim() ? describedById : undefined;

  return (
    <button
      type="button"
      className={mergedClass}
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      aria-describedby={describedBy}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {loading ? "Redirecting to Google..." : ""}
      </span>
      {loading ? "Redirecting..." : label}
    </button>
  );
}
