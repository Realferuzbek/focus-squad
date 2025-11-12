"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

type AvatarMenuProps = {
  avatarUrl?: string | null;
  switchAccountLabel: string;
  signOutLabel: string;
};

export default function AvatarMenu({
  avatarUrl,
  switchAccountLabel,
  signOutLabel,
}: AvatarMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
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

      {open ? (
        <div className="absolute right-0 top-14 min-w-48 rounded-2xl border border-white/10 bg-[#09090f]/95 p-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
          <Link
            href="/signin?switch=1"
            className="block rounded-xl px-3 py-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={() => setOpen(false)}
          >
            {switchAccountLabel}
          </Link>
          <Link
            href="/api/auth/signout?callbackUrl=/signin"
            className="block rounded-xl px-3 py-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={() => setOpen(false)}
          >
            {signOutLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

