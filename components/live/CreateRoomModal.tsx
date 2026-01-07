"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, Lock, X } from "lucide-react";
import { csrfFetch } from "@/lib/csrf-client";

type CreateRoomModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (roomId: string) => void;
};

type Visibility = "public" | "unlisted";

const DEFAULT_MAX_SIZE = 30;

function parseMaxSize(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(2, Math.min(200, Math.floor(parsed)));
}

export default function CreateRoomModal({
  open,
  onClose,
  onCreated,
}: CreateRoomModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [maxSize, setMaxSize] = useState(`${DEFAULT_MAX_SIZE}`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setVisibility("public");
    setMaxSize(`${DEFAULT_MAX_SIZE}`);
    setError(null);
  }, [open]);

  const sizeValue = useMemo(() => parseMaxSize(maxSize), [maxSize]);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Room title is required.");
      return;
    }
    if (sizeValue === null) {
      setError("Max size must be a number between 2 and 200.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/voice/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          max_size: sizeValue,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.error ?? "Failed to create room.";
        setError(message);
        return;
      }

      const payload = await res.json();
      if (payload?.id) {
        onCreated(payload.id);
      } else {
        setError("Room created but no id returned.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create room.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6">
      <button
        className="absolute inset-0 bg-[#05050c]/80 backdrop-blur-2xl"
        onClick={onClose}
        aria-label="Close create room modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-50 w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0e0f1c] via-[#0a0b16] to-[#05050b] text-white shadow-[0_35px_120px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Create room
            </p>
            <h2 className="text-2xl font-semibold">Start a voice room</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <label className="block space-y-2 text-sm">
            <span className="text-white/70">Room title</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              placeholder="e.g. Late-night IELTS speaking practice"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-white/70">Description (optional)</span>
            <textarea
              className="min-h-[96px] w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              placeholder="Let people know what you want to practice."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm">
              <span className="text-white/70">Visibility</span>
              <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    visibility === "public"
                      ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("unlisted")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    visibility === "unlisted"
                      ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  Unlisted
                </button>
              </div>
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-white/70">Max size</span>
              <input
                type="number"
                min={2}
                max={200}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                value={maxSize}
                onChange={(event) => setMaxSize(event.target.value)}
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-5">
          <p className="text-xs text-white/50">
            Camera stays off by default. Mic controls are in-room.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create room"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
