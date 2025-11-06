// components/Navbar.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type NavbarProps = {
  isAdmin?: boolean;
  avatarUrl?: string | null;
};

export default function Navbar({ isAdmin = false, avatarUrl }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-white">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image src="/logo.svg" alt="logo" width={30} height={30} />
          <span className="text-lg font-semibold tracking-tight">Studywithferuzbek</span>
        </Link>

        <nav className="relative flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin" className="btn-primary px-5 opacity-90 hover:opacity-100">
              Reviewer panel
            </Link>
          )}

          {/* avatar button */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative h-10 w-10 overflow-hidden rounded-full border border-white/15 bg-[#11111f] shadow-[0_15px_35px_rgba(10,10,20,0.45)] transition hover:border-white/30"
            aria-label="Account menu"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="avatar" fill sizes="36px" className="object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-neutral-800">
                <span className="text-xs">🙂</span>
              </div>
            )}
          </button>

          {/* menu */}
          {open && (
            <div className="absolute right-0 top-14 min-w-48 rounded-2xl border border-white/10 bg-[#09090f]/95 p-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
              <Link
                href="/signin?switch=1"
                className="block rounded-xl px-3 py-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Switch account
              </Link>
              <Link
                href="/api/auth/signout?callbackUrl=/signin"
                className="block rounded-xl px-3 py-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Sign out
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

