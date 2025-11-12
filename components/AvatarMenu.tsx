"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { csrfFetch } from "@/lib/csrf-client";
import AvatarBadge from "@/components/AvatarBadge";

type AvatarMenuProps = {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  switchAccountLabel: string;
  deleteAccountLabel: string;
  deleteAccountConfirm?: string;
};

export default function AvatarMenu({
  avatarUrl,
  name,
  email,
  switchAccountLabel,
  deleteAccountLabel,
  deleteAccountConfirm,
}: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setDeleting(false);
      setSwitching(false);
    }
  }, [open]);

  const handleSwitchAccount = useCallback(async () => {
    if (switching) return;
    setError(null);
    setSwitching(true);
    setOpen(false);
    try {
      await signOut({
        callbackUrl: "/signin?switch=1",
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to switch accounts right now.";
      setError(message);
      setSwitching(false);
    }
  }, [switching]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    const confirmed = window.confirm(
      deleteAccountConfirm ??
        "Deleting your account removes your profile and Telegram link. This cannot be undone. Continue?",
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/account", { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || "Failed to delete account.");
      }
      window.location.assign(
        "/api/auth/signout?callbackUrl=/signin?deleted=1",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to delete account right now.";
      setError(message);
      setDeleting(false);
    }
  }, [deleting, deleteAccountConfirm]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
        aria-label="Account menu"
      >
        <AvatarBadge
          avatarUrl={avatarUrl}
          name={name}
          email={email}
          size={40}
          alt="Account avatar"
          className="shadow-[0_15px_35px_rgba(10,10,30,0.6)]"
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-14 min-w-48 rounded-2xl border border-white/10 bg-[#09090f]/95 p-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
          <button
            type="button"
            onClick={handleSwitchAccount}
            disabled={switching}
            className="block w-full rounded-xl px-3 py-2 text-left text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {switching ? `${switchAccountLabel}…` : switchAccountLabel}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-rose-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            {deleting ? `${deleteAccountLabel}…` : deleteAccountLabel}
          </button>
          {error ? (
            <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
