'use client';
import Link from 'next/link';
import LivePill from './LivePill';

export default function Navbar() {
  return (
    <nav className="h-16 px-4 border-b border-neutral-800 flex items-center justify-between">
      <div className="font-bold text-[18px]">Focus Squad</div>
      <div className="flex items-center gap-4">
        <LivePill />
        <Link href="/admin" className="btn-secondary focus-ring" aria-label="Reviewer panel">
          Reviewer panel
        </Link>
        <img src="/logo.svg" alt="" className="w-8 h-8 rounded-full" />
      </div>
    </nav>
  );
}
