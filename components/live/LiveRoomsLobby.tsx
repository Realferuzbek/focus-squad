"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Link2,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import CreateRoomModal from "@/components/live/CreateRoomModal";
import DevJoinPanel from "@/components/live/DevJoinPanel";

type LiveRoom = {
  id: string;
  created_at: string;
  created_by: string;
  created_by_name?: string | null;
  created_by_avatar_url?: string | null;
  title: string;
  description?: string | null;
  visibility: "public" | "unlisted";
  status: "active" | "ended";
  max_size: number;
};

type LiveRoomsLobbyProps = {
  user: {
    id: string;
    displayName?: string | null;
    name?: string | null;
    email?: string | null;
    isAdmin?: boolean | null;
  };
};

const invitePattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function buildInviteUrl(roomId: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/feature/live/room/${roomId}`;
}

export default function LiveRoomsLobby({ user }: LiveRoomsLobbyProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadRooms() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/rooms", { cache: "no-store" });
      if (!res.ok) {
        setError("Unable to load rooms right now.");
        return;
      }
      const payload = await res.json();
      setRooms(payload?.rooms ?? []);
    } catch (err) {
      console.error(err);
      setError("Unable to load rooms right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (inviteOpen) return;
    setInviteInput("");
    setInviteError(null);
  }, [inviteOpen]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) => {
      const title = room.title.toLowerCase();
      const description = room.description?.toLowerCase() ?? "";
      return title.includes(query) || description.includes(query);
    });
  }, [rooms, search]);

  function handleJoin(roomId: string) {
    router.push(`/feature/live/room/${roomId}`);
  }

  async function handleCopyInvite(roomId: string) {
    const link = buildInviteUrl(roomId);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  function handleInviteGo() {
    const match = inviteInput.match(invitePattern);
    if (!match) {
      setInviteError("Paste a valid room link or room id.");
      return;
    }
    setInviteError(null);
    router.push(`/feature/live/room/${match[0]}`);
  }

  const isAdmin = Boolean(user.isAdmin);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 text-white">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-white/50">
            Voice-first lobby
          </p>
          <h1 className="text-3xl font-semibold">Live Rooms</h1>
          <p className="max-w-2xl text-sm text-white/65">
            Jump into live speaking rooms, meet new people, and keep the camera
            optional. One click to join.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setInviteOpen((prev) => !prev)}
            className="btn-secondary"
          >
            Join by link
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary">
            Create room
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              className="w-full rounded-full border border-white/10 bg-[#10101b] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              placeholder="Search rooms by title"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={loadRooms}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {inviteOpen ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Link2 className="h-4 w-4 text-white/50" />
              <input
                className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                placeholder="Paste invite link or room id"
                value={inviteInput}
                onChange={(event) => setInviteInput(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleInviteGo}
              className="btn-primary h-10 px-5 text-xs"
            >
              Join room
            </button>
            {inviteError ? (
              <p className="text-xs text-rose-300">{inviteError}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active rooms</h2>
          <span className="pill">{rooms.length} live</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
            Loading rooms...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
            {error}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-2xl">
              🎙️
            </div>
            <p className="text-lg font-semibold">No rooms live right now</p>
            <p className="text-sm text-white/60">
              Be the first to start a voice room for the community.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary"
            >
              Create the first room
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRooms.map((room) => {
              const creatorLabel =
                room.created_by === user.id
                  ? "You"
                  : room.created_by_name ?? "Someone";
              return (
                <div
                  key={room.id}
                  className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#101120] via-[#0b0c16] to-[#07070f] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.4)] transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-white">
                        {room.title}
                      </h3>
                      <p className="text-sm text-white/65">
                        Created by {creatorLabel}
                      </p>
                      {room.description ? (
                        <p className="text-sm text-white/50">
                          {room.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill">
                        {room.visibility === "public" ? "Public" : "Unlisted"}
                      </span>
                      <span className="pill">
                        <Users className="h-3 w-3" />
                        {room.max_size} seats
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleJoin(room.id)}
                      className="btn-primary"
                    >
                      Join room
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyInvite(room.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/25 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedId === room.id ? "Copied" : "Copy invite"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isAdmin ? (
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <DevJoinPanel />
        </section>
      ) : null}

      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(roomId) => {
          setCreateOpen(false);
          router.push(`/feature/live/room/${roomId}`);
        }}
      />
    </div>
  );
}
