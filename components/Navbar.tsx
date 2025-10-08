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
    <header className="w-full border-b border-neutral-800/60 bg-black/20 backdrop-blur supports-[backdrop-filter]:bg-black/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-white">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="logo" width={28} height={28} />
          <span className="font-semibold">Studywithferuzbek</span>
        </Link>

        <nav className="relative flex items-center gap-3">
          {isAdmin && (
            <Link href="/admin" className="pill">
              Reviewer panel
            </Link>
          )}

          {/* avatar button */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative h-9 w-9 overflow-hidden rounded-full border border-neutral-700"
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
            <div className="absolute right-0 top-12 min-w-48 rounded-xl border border-neutral-800 bg-neutral-900/95 p-2 text-sm shadow-xl">
              <Link
                href="/signin?switch=1"
                className="block rounded-md px-3 py-2 hover:bg-neutral-800"
              >
                Switch account
              </Link>
              <Link
                href="/api/auth/signout?callbackUrl=/signin"
                className="block rounded-md px-3 py-2 hover:bg-neutral-800"
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
