"use client";

import NextImage from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Image as ImageIcon,
  Loader2,
  Search,
  Upload,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

import { supabaseBrowser } from "@/lib/supabaseClient";
import type { ListedMember, ListedRemoved } from "@/lib/live/admin";

type TabKey = "general" | "members" | "removed" | "appearance" | "admins" | "recent";

type AdminStateUpdatePayload = {
  groupName: string;
  groupDescription: string | null;
  groupAvatarUrl: string | null;
  wallpaperUrl: string | null;
};

type AuditEntry = {
  id: number;
  at: string;
  action: string;
  actor: string | null;
  targetUser: string | null;
  messageId: number | null;
  fromText: string | null;
  toText: string | null;
  actorProfile?: {
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  targetProfile?: {
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
};

type LiveAdminDrawerProps = {
  open: boolean;
  activeTab: TabKey;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: TabKey) => void;
  state: {
    groupName: string;
    groupDescription: string | null;
    groupAvatarUrl: string | null;
    wallpaperUrl: string | null;
    subscribersCount: number;
    isLive: boolean;
    activeMembers: number;
    removedMembers: number;
  };
  saving: boolean;
  onSave: (payload: AdminStateUpdatePayload) => Promise<boolean>;
  onError: (message: string) => void;
  onRefresh: () => Promise<void>;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "general", label: "General" },
  { key: "members", label: "Members" },
  { key: "removed", label: "Removed" },
  { key: "appearance", label: "Appearance" },
  { key: "admins", label: "Admins" },
  { key: "recent", label: "Recent actions" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function getFocusable(root: HTMLElement | null) {
  if (!root) return [] as HTMLElement[];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const styles = window.getComputedStyle(element);
    return styles.visibility !== "hidden" && styles.display !== "none";
  });
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
    img.src = objectUrl;
  });
}

async function prepareAvatar(file: File): Promise<File> {
  const image = await loadImageElement(file);
  const minSide = Math.min(image.width, image.height);
  const size = Math.min(1024, minSide);
  const sx = (image.width - minSide) / 2;
  const sy = (image.height - minSide) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(image, sx, sy, minSide, minSide, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("blob");
  const fileNameRoot = file.name.replace(/\.\w+$/, "") || "avatar";
  return new File([blob], `${fileNameRoot}.webp`, { type: "image/webp" });
}

async function prepareWallpaper(file: File): Promise<File> {
  const image = await loadImageElement(file);
  const maxDimension = 1920;
  const ratio = Math.min(maxDimension / image.width, maxDimension / image.height, 1);
  const width = Math.round(image.width * ratio);
  const height = Math.round(image.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("blob");
  const fileNameRoot = file.name.replace(/\.\w+$/, "") || "wallpaper";
  return new File([blob], `${fileNameRoot}.webp`, { type: "image/webp" });
}

function buildPublicUrl(path: string, explicit?: string | null) {
  if (explicit) return explicit;
  if (!SUPABASE_URL) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/live_assets/${path}`;
}

export default function LiveAdminDrawer({
  open,
  activeTab,
  onOpenChange,
  onTabChange,
  state,
  onSave,
  onError,
  onRefresh,
  saving,
}: LiveAdminDrawerProps) {
  const [currentTab, setCurrentTab] = useState<TabKey>(activeTab);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const [nameInput, setNameInput] = useState(state.groupName);
  const [descriptionInput, setDescriptionInput] = useState(state.groupDescription ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(state.groupAvatarUrl ?? null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(state.wallpaperUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [wallpaperUploading, setWallpaperUploading] = useState(false);

  const [members, setMembers] = useState<ListedMember[]>([]);
  const [membersCursor, setMembersCursor] = useState<string | null>(null);
  const [membersHasMore, setMembersHasMore] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersSearchValue, setMembersSearchValue] = useState("");
  const [membersQuery, setMembersQuery] = useState("");
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const [removed, setRemoved] = useState<ListedRemoved[]>([]);
  const [removedCursor, setRemovedCursor] = useState<string | null>(null);
  const [removedHasMore, setRemovedHasMore] = useState(false);
  const [removedLoading, setRemovedLoading] = useState(false);
  const [removedSearchValue, setRemovedSearchValue] = useState("");
  const [removedQuery, setRemovedQuery] = useState("");
  const [removedActionId, setRemovedActionId] = useState<string | null>(null);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (currentTab !== activeTab) {
      onTabChange(currentTab);
    }
  }, [currentTab, activeTab, onTabChange]);

  useEffect(() => {
    if (!open) return;
    setNameInput(state.groupName);
    setDescriptionInput(state.groupDescription ?? "");
    setAvatarUrl(state.groupAvatarUrl ?? null);
    setWallpaperUrl(state.wallpaperUrl ?? null);
  }, [open, state.groupAvatarUrl, state.groupDescription, state.groupName, state.wallpaperUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setPrefersReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  const descriptionWords = useMemo(() => {
    const trimmed = descriptionInput.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [descriptionInput]);

  const normalizedDescription = descriptionInput.trim() ? descriptionInput.trim() : null;
  const baselineDescription = state.groupDescription ? state.groupDescription.trim() : null;
  const generalDirty =
    nameInput.trim() !== state.groupName || normalizedDescription !== baselineDescription;
  const appearanceDirty =
    (avatarUrl ?? null) !== (state.groupAvatarUrl ?? null) ||
    (wallpaperUrl ?? null) !== (state.wallpaperUrl ?? null);

  const canSaveGeneral =
    currentTab === "general" && generalDirty && !saving && !avatarUploading && !wallpaperUploading;
  const canSaveAppearance =
    currentTab === "appearance" &&
    appearanceDirty &&
    !saving &&
    !avatarUploading &&
    !wallpaperUploading;

  const signAndUpload = useCallback(
    async (file: File, variant: "avatar" | "wallpaper") => {
      const res = await fetch("/api/community/live/admin/sign-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime: file.type,
          bytes: file.size,
          variant,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "sign");
      }
      const data = await res.json();
      const { error } = await supabaseBrowser.storage
        .from("live_assets")
        .uploadToSignedUrl(data.path, data.token, file);
      if (error) {
        throw error;
      }
      return buildPublicUrl(data.path, data.publicUrl);
    },
    [],
  );

  const handleAvatarFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        setAvatarUploading(true);
        const prepared = await prepareAvatar(file);
        const uploadedUrl = await signAndUpload(prepared, "avatar");
        setAvatarUrl(uploadedUrl);
      } catch (error) {
        console.error("avatar upload", error);
        onError("Failed to upload avatar. Please try again.");
      } finally {
        setAvatarUploading(false);
      }
    },
    [onError, signAndUpload],
  );

  const handleWallpaperFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        setWallpaperUploading(true);
        const prepared = await prepareWallpaper(file);
        const uploadedUrl = await signAndUpload(prepared, "wallpaper");
        setWallpaperUrl(uploadedUrl);
      } catch (error) {
        console.error("wallpaper upload", error);
        onError("Failed to upload wallpaper. Please try again.");
      } finally {
        setWallpaperUploading(false);
      }
    },
    [onError, signAndUpload],
  );

  const handleSave = useCallback(async () => {
    if (currentTab !== "general" && currentTab !== "appearance") return;
    if (
      (currentTab === "general" && !generalDirty) ||
      (currentTab === "appearance" && !appearanceDirty)
    ) {
      onOpenChange(false);
      return;
    }
    const normalizedName = nameInput.trim() || "Live Stream Chat";
    const payload: AdminStateUpdatePayload = {
      groupName: normalizedName,
      groupDescription: normalizedDescription,
      groupAvatarUrl: avatarUrl,
      wallpaperUrl,
    };
    const success = await onSave(payload);
    if (success) {
      await onRefresh();
      onOpenChange(false);
    }
  }, [
    appearanceDirty,
    avatarUrl,
    currentTab,
    generalDirty,
    nameInput,
    normalizedDescription,
    onOpenChange,
    onRefresh,
    onSave,
    wallpaperUrl,
  ]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s" &&
        (currentTab === "general" || currentTab === "appearance")
      ) {
        event.preventDefault();
        void handleSave();
        return;
      }
      if (event.key === "Tab") {
        const focusables = getFocusable(containerRef.current);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const focusables = getFocusable(containerRef.current);
    if (focusables.length) {
      focusables[0].focus();
    } else {
      containerRef.current?.focus();
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [currentTab, handleSave, open, onOpenChange]);

  const loadMembers = useCallback(
    async (reset: boolean) => {
      if (!open) return;
      if (membersLoading) return;
      setMembersLoading(true);
      try {
        const params = new URLSearchParams({ limit: "25" });
        if (!reset && membersCursor) {
          params.set("cursor", membersCursor);
        }
        if (membersQuery) {
          params.set("q", membersQuery);
        }
        const res = await fetch(
          `/api/community/live/admin/members?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("members");
        }
        const data: {
          items: ListedMember[];
          nextCursor: string | null;
          hasMore: boolean;
        } = await res.json();
        setMembers((prev) => (reset ? data.items : [...prev, ...data.items]));
        setMembersHasMore(data.hasMore);
        setMembersCursor(data.nextCursor ?? null);
      } catch (error) {
        console.error("load members", error);
        onError("Unable to load members right now.");
      } finally {
        setMembersLoading(false);
      }
    },
    [membersCursor, membersLoading, membersQuery, onError, open],
  );

  const loadRemoved = useCallback(
    async (reset: boolean) => {
      if (!open) return;
      if (removedLoading) return;
      setRemovedLoading(true);
      try {
        const params = new URLSearchParams({ limit: "25" });
        if (!reset && removedCursor) {
          params.set("cursor", removedCursor);
        }
        if (removedQuery) {
          params.set("q", removedQuery);
        }
        const res = await fetch(
          `/api/community/live/admin/removed?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("removed");
        }
        const data: {
          items: ListedRemoved[];
          nextCursor: string | null;
          hasMore: boolean;
        } = await res.json();
        setRemoved((prev) => (reset ? data.items : [...prev, ...data.items]));
        setRemovedHasMore(data.hasMore);
        setRemovedCursor(data.nextCursor ?? null);
      } catch (error) {
        console.error("load removed", error);
        onError("Unable to load removed members.");
      } finally {
        setRemovedLoading(false);
      }
    },
    [onError, open, removedCursor, removedLoading, removedQuery],
  );

  const loadAudit = useCallback(
    async (reset: boolean) => {
      if (!open) return;
      if (auditLoading) return;
      setAuditLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (!reset && auditCursor) {
          params.set("cursor", auditCursor);
        }
        const res = await fetch(
          `/api/community/live/admin/audit?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("audit");
        }
        const data: {
          items: AuditEntry[];
          hasMore: boolean;
          nextCursor: string | null;
        } = await res.json();
        setAuditEntries((prev) => (reset ? data.items : [...prev, ...data.items]));
        setAuditHasMore(data.hasMore);
        setAuditCursor(data.nextCursor ?? null);
      } catch (error) {
        console.error("load audit", error);
        onError("Unable to load audit history.");
      } finally {
        setAuditLoading(false);
      }
    },
    [auditCursor, auditLoading, onError, open],
  );

  useEffect(() => {
    if (!open) return;
    if (currentTab === "members") {
      void loadMembers(true);
    } else if (currentTab === "removed") {
      void loadRemoved(true);
    } else if (currentTab === "recent") {
      void loadAudit(true);
    }
  }, [currentTab, loadAudit, loadMembers, loadRemoved, open]);

  const handleMemberSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMembersCursor(null);
      setMembersQuery(membersSearchValue.trim());
    },
    [membersSearchValue],
  );

  const handleRemovedSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setRemovedCursor(null);
      setRemovedQuery(removedSearchValue.trim());
    },
    [removedSearchValue],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      setMemberActionId(userId);
      try {
        const res = await fetch("/api/community/live/admin/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remove: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "remove");
        }
        await Promise.all([onRefresh(), loadMembers(true), loadRemoved(true)]);
      } catch (error) {
        console.error("remove member", error);
        onError("Failed to remove member.");
      } finally {
        setMemberActionId(null);
      }
    },
    [loadMembers, loadRemoved, onError, onRefresh],
  );

  const handleRestoreMember = useCallback(
    async (userId: string) => {
      setRemovedActionId(userId);
      try {
        const res = await fetch("/api/community/live/admin/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restore: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "restore");
        }
        await Promise.all([onRefresh(), loadMembers(true), loadRemoved(true)]);
      } catch (error) {
        console.error("restore member", error);
        onError("Failed to restore member.");
      } finally {
        setRemovedActionId(null);
      }
    },
    [loadMembers, loadRemoved, onError, onRefresh],
  );

  const refreshCurrentTab = useCallback(() => {
    if (currentTab === "members") {
      void loadMembers(true);
    } else if (currentTab === "removed") {
      void loadRemoved(true);
    } else if (currentTab === "recent") {
      void loadAudit(true);
    } else if (currentTab === "general" || currentTab === "appearance") {
      setNameInput(state.groupName);
      setDescriptionInput(state.groupDescription ?? "");
      setAvatarUrl(state.groupAvatarUrl ?? null);
      setWallpaperUrl(state.wallpaperUrl ?? null);
    }
  }, [
    currentTab,
    loadAudit,
    loadMembers,
    loadRemoved,
    state.groupAvatarUrl,
    state.groupDescription,
    state.groupName,
    state.wallpaperUrl,
  ]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Live community admin"
        tabIndex={-1}
        className={`relative ml-auto flex h-full w-full max-w-[460px] flex-col bg-[#080814] text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] ${
          prefersReducedMotion ? "" : "transition duration-300"
        }`}
      >
        <header className="flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Live Control</p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight">{state.groupName}</h2>
            <p className="mt-2 text-xs text-white/50">
              {state.subscribersCount.toLocaleString("en-US")} subscribers ·{" "}
              {state.isLive ? "Open" : "Locked"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close admin drawer"
            className="rounded-full border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav
          className="flex gap-2 overflow-x-auto border-b border-white/10 px-6 py-3"
          role="tablist"
        >
          {TABS.map((tab) => {
            const selected = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                onClick={() => setCurrentTab(tab.key)}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  selected
                    ? "bg-white text-[#090912]"
                    : "border border-white/10 text-white/70 hover:border-white/20 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentTab === "general" && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-white/70" htmlFor="group-name">
                  Group name
                </label>
                <input
                  id="group-name"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value.slice(0, 120))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white/70" htmlFor="group-description">
                    Description
                  </label>
                  <span className="text-xs text-white/40">{descriptionWords} / 40 words</span>
                </div>
                <textarea
                  id="group-description"
                  value={descriptionInput}
                  onChange={(event) => setDescriptionInput(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                  placeholder="What should members feel when they join this space?"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">Subscribers</p>
                  <p className="mt-2 text-xl font-semibold">
                    {state.subscribersCount.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">Status</p>
                  <p className="mt-2 text-xl font-semibold">{state.isLive ? "Open" : "Locked"}</p>
                </div>
              </div>
            </div>
          )}

          {currentTab === "appearance" && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <header className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Group avatar</h3>
                    <p className="text-xs text-white/50">Square · up to 1024px</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                  >
                    <Upload className="h-4 w-4" />
                    {avatarUploading ? "Uploading…" : "Upload"}
                  </button>
                </header>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                    {avatarUrl ? (
                      <NextImage
                        src={avatarUrl}
                        alt="Group avatar"
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/40">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-white/60">
                    <span>Recommended: transparent PNG or square photo.</span>
                    {avatarUrl && (
                      <button
                        type="button"
                        className="self-start rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10"
                        onClick={() => setAvatarUrl(null)}
                      >
                        Remove avatar
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <header className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Wallpaper</h3>
                    <p className="text-xs text-white/50">Landscape · up to 1920px wide</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => wallpaperInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                  >
                    <Upload className="h-4 w-4" />
                    {wallpaperUploading ? "Uploading…" : "Upload"}
                  </button>
                </header>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="relative h-32 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                    {wallpaperUrl ? (
                      <NextImage
                        src={wallpaperUrl}
                        alt="Wallpaper preview"
                        fill
                        className="object-cover"
                        sizes="320px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/40">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  {wallpaperUrl && (
                    <button
                      type="button"
                      onClick={() => setWallpaperUrl(null)}
                      className="self-start rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10"
                    >
                      Remove wallpaper
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {currentTab === "members" && (
            <section className="space-y-4">
              <form onSubmit={handleMemberSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={membersSearchValue}
                    onChange={(event) => setMembersSearchValue(event.target.value)}
                    placeholder="Search members…"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#080812] transition hover:bg-white/80"
                >
                  Filter
                </button>
              </form>
              <div className="space-y-3">
                {membersLoading && members.length === 0 && (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading members…
                  </div>
                )}
                {!membersLoading && members.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                    No active members match that search.
                  </div>
                )}
                {members.map((member) => {
                  const busy = memberActionId === member.userId;
                  return (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {member.displayName ?? "Member"}
                        </p>
                        <p className="text-xs text-white/50">{member.email ?? "—"}</p>
                        {member.joinedAt && (
                          <p className="mt-1 text-xs text-white/40">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </button>
                    </div>
                  );
                })}
                {membersHasMore && (
                  <button
                    type="button"
                    onClick={() => loadMembers(false)}
                    disabled={membersLoading}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {membersLoading ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            </section>
          )}

          {currentTab === "removed" && (
            <section className="space-y-4">
              <form onSubmit={handleRemovedSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={removedSearchValue}
                    onChange={(event) => setRemovedSearchValue(event.target.value)}
                    placeholder="Search removed members…"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-300/60"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#080812] transition hover:bg-white/80"
                >
                  Filter
                </button>
              </form>
              <div className="space-y-3">
                {removedLoading && removed.length === 0 && (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading removed members…
                  </div>
                )}
                {!removedLoading && removed.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                    This list is clear for now.
                  </div>
                )}
                {removed.map((entry) => {
                  const busy = removedActionId === entry.userId;
                  return (
                    <div
                      key={entry.userId}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {entry.displayName ?? "Member"}
                        </p>
                        <p className="text-xs text-white/50">{entry.email ?? "—"}</p>
                        {entry.removedAt && (
                          <p className="mt-1 text-xs text-white/40">
                            Removed {new Date(entry.removedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreMember(entry.userId)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        Restore
                      </button>
                    </div>
                  );
                })}
                {removedHasMore && (
                  <button
                    type="button"
                    onClick={() => loadRemoved(false)}
                    disabled={removedLoading}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {removedLoading ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            </section>
          )}

          {currentTab === "admins" && (
            <div className="space-y-4 text-sm text-white/70">
              <p>
                We’re building the admin roster tools. For now, ask the team to add the admin via
                Supabase console.
              </p>
              <p className="text-xs text-white/40">
                Coming soon: invite by email, role handoff workflows, and audit visibility.
              </p>
            </div>
          )}

          {currentTab === "recent" && (
            <section className="space-y-3">
              {auditLoading && auditEntries.length === 0 && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading actions…
                </div>
              )}
              {auditEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                >
                  <header className="flex items-center justify-between text-xs uppercase text-white/40">
                    <span>{new Date(entry.at).toLocaleString()}</span>
                    <span>{entry.action.replace(/_/g, " ")}</span>
                  </header>
                  <p className="mt-2 text-sm text-white">
                    {entry.actorProfile?.displayName ?? "Someone"} →{" "}
                    {entry.targetProfile?.displayName ?? entry.targetUser ?? "—"}
                  </p>
                  {entry.fromText && (
                    <p className="mt-1 text-xs text-white/60">from: {entry.fromText}</p>
                  )}
                  {entry.toText && (
                    <p className="mt-1 text-xs text-white/60">to: {entry.toText}</p>
                  )}
                </article>
              ))}
              {auditEntries.length === 0 && !auditLoading && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  No audit entries yet.
                </div>
              )}
              {auditHasMore && (
                <button
                  type="button"
                  onClick={() => loadAudit(false)}
                  disabled={auditLoading}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {auditLoading ? "Loading…" : "Load more"}
                </button>
              )}
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-white/10 bg-[#080814]/95 px-6 py-4 backdrop-blur">
          {(currentTab === "general" || currentTab === "appearance") && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!(canSaveGeneral || canSaveAppearance)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#080814] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(saving || avatarUploading || wallpaperUploading) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save changes
              </button>
            </div>
          )}
          {currentTab !== "general" && currentTab !== "appearance" && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Close
              </button>
              <button
                type="button"
                onClick={refreshCurrentTab}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
          )}
        </footer>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFile}
        />
        <input
          ref={wallpaperInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleWallpaperFile}
        />
      </div>
    </div>
  );
}
