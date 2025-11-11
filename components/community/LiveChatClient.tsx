"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import TextareaAutosize from "react-textarea-autosize";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Bell,
  Clock,
  Loader2,
  Mic,
  MoreVertical,
  Paperclip,
  Pencil,
  Search,
  Send,
  Smile,
} from "lucide-react";
import "@emoji-mart/css/emoji-mart.css";

import GlowPanel from "@/components/GlowPanel";
import LiveAdminDrawer from "@/components/community/LiveAdminDrawer";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { trackLiveEvent } from "@/lib/analytics";
import { csrfFetch } from "@/lib/csrf-client";
import { buildPlainSnippet, ensureSafeHtml } from "@/lib/highlight";

const EmojiPicker = dynamic(
  () =>
    Promise.all([
      import("@emoji-mart/react"),
      import("@emoji-mart/data"),
    ]).then(([mod, data]) => {
      const Picker = mod.default;
      const EmojiPickerComponent = (props: any) => (
        <Picker data={data.default} {...props} />
      );
      EmojiPickerComponent.displayName = "LiveEmojiPicker";
      return EmojiPickerComponent;
    }),
  { ssr: false },
);

type LiveUser = {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
};

type LiveMessage = {
  id: string;
  realId?: number | null;
  authorId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  kind: "text" | "image" | "video" | "audio" | "file";
  text: string | null;
  filePath: string | null;
  fileMime: string | null;
  fileBytes: number | null;
  createdAt: string;
  highlight?: string | null;
  optimistic?: boolean;
};

type MessagesResponse = {
  messages: LiveMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  joined: boolean;
};

type StateResponse = {
  isLive: boolean;
  memberCount: number;
  groupName: string;
  groupDescription: string | null;
  groupAvatarUrl: string | null;
  wallpaperUrl: string | null;
};

type SearchResponse = {
  messages: LiveMessage[];
};

const MEMBER_FORMAT = new Intl.NumberFormat("en-US");

type Notice = {
  id: number;
  text: string;
  variant: "error" | "success";
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export type LiveAdminStateSnapshot = {
  isLive: boolean;
  updatedAt: string | null;
  groupName: string;
  groupAvatarUrl: string | null;
  groupDescription: string | null;
  wallpaperUrl: string | null;
  subscribersCount: number;
  activeMembers: number;
  removedMembers: number;
};

type AdminStateUpdatePayload = {
  groupName: string;
  groupDescription: string | null;
  groupAvatarUrl: string | null;
  wallpaperUrl: string | null;
};

const STATUS_MESSAGES: Record<number, string> = {
  401: "Please sign back in to chat.",
  403: "Join the livestream chat to participate.",
  409: "Chat is locked until we go live.",
  429: "You’re sending messages too quickly. Take a breather.",
};

type LiveChatClientProps = {
  user: LiveUser;
  adminState?: LiveAdminStateSnapshot | null;
};

export default function LiveChatClient({ user, adminState }: LiveChatClientProps) {
  const [isLive, setIsLive] = useState(adminState?.isLive ?? false);
  const [memberCount, setMemberCount] = useState(adminState?.subscribersCount ?? 0);
  const [groupName, setGroupName] = useState(adminState?.groupName ?? "Live Stream Chat");
  const [groupDescription, setGroupDescription] = useState<string | null>(
    adminState?.groupDescription ?? null,
  );
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(
    adminState?.groupAvatarUrl ?? null,
  );
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(
    adminState?.wallpaperUrl ?? null,
  );
  const [wallpaperReadyUrl, setWallpaperReadyUrl] = useState<string | null>(null);
  const [wallpaperVisible, setWallpaperVisible] = useState(false);
  const [wallpaperFit, setWallpaperFit] = useState<"cover" | "contain">("cover");
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [wallpaperParallax, setWallpaperParallax] = useState(0);
  const [adminActiveMembers, setAdminActiveMembers] = useState(
    adminState?.activeMembers ?? adminState?.subscribersCount ?? 0,
  );
  const [adminRemovedMembers, setAdminRemovedMembers] = useState(
    adminState?.removedMembers ?? 0,
  );
  const [joined, setJoined] = useState(false);
  const joinedRef = useRef(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LiveMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  const [adminDrawerTab, setAdminDrawerTab] = useState<
    "general" | "members" | "removed" | "appearance" | "admins" | "recent"
  >("general");
  const [adminSaving, setAdminSaving] = useState(false);
  const [mobileAdminMenuOpen, setMobileAdminMenuOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeTimeoutsRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!adminState) return;
    setIsLive(adminState.isLive);
    setMemberCount(adminState.subscribersCount ?? 0);
    setGroupName(adminState.groupName ?? "Live Stream Chat");
    setGroupDescription(adminState.groupDescription ?? null);
    setGroupAvatarUrl(adminState.groupAvatarUrl ?? null);
    setWallpaperUrl(adminState.wallpaperUrl ?? null);
    setAdminActiveMembers(adminState.activeMembers ?? adminState.subscribersCount ?? 0);
    setAdminRemovedMembers(adminState.removedMembers ?? 0);
  }, [adminState]);

  useEffect(() => {
    if (!adminDrawerOpen) {
      setMobileAdminMenuOpen(false);
    }
  }, [adminDrawerOpen]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pageHiddenRef = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 12,
  });

  const pushNotice = useCallback(
    (message: string, variant: Notice["variant"] = "error") => {
      if (!message) return;
      const id = Number(Date.now() + Math.random());
      setNotices((prev) => [...prev, { id, text: message, variant }]);
      if (typeof window !== "undefined") {
        const timeoutId = window.setTimeout(() => {
          setNotices((prev) => prev.filter((notice) => notice.id !== id));
          noticeTimeoutsRef.current.delete(id);
        }, 5000);
        noticeTimeoutsRef.current.set(id, timeoutId);
      }
    },
    [],
  );

  const pushError = useCallback(
    (message: string) => {
      pushNotice(message, "error");
    },
    [pushNotice],
  );

  const pushSuccess = useCallback(
    (message: string) => {
      pushNotice(message, "success");
    },
    [pushNotice],
  );

  const openAdminPanel = useCallback(
    (tab: typeof adminDrawerTab = "general") => {
      setAdminDrawerTab(tab);
      setAdminDrawerOpen(true);
    },
    [],
  );

  const handleAdminDrawerChange = useCallback((open: boolean) => {
    if (!open) {
      setAdminDrawerTab("general");
    }
    setAdminDrawerOpen(open);
  }, []);

  const closeAllMenus = useCallback(() => {
    setMenuOpen(false);
    setMobileAdminMenuOpen(false);
  }, []);

  const handleAdminStateSave = useCallback(
    async (payload: AdminStateUpdatePayload) => {
      setAdminSaving(true);
      try {
        const res = await csrfFetch("/api/community/live/admin/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          pushError(data.error ?? "Unable to save changes right now.");
          return false;
        }
        const data = await res.json().catch(() => ({}));
        const state: LiveAdminStateSnapshot | undefined = data?.state;
        if (state) {
          setIsLive(state.isLive);
          setMemberCount(state.subscribersCount ?? 0);
          setGroupName(state.groupName ?? "Live Stream Chat");
          setGroupDescription(state.groupDescription ?? null);
          setGroupAvatarUrl(state.groupAvatarUrl ?? null);
          setWallpaperUrl(state.wallpaperUrl ?? null);
          setAdminActiveMembers(state.activeMembers ?? state.subscribersCount ?? 0);
          setAdminRemovedMembers(state.removedMembers ?? 0);
        }
        return true;
      } catch (error) {
        console.error("admin-state-save", error);
        pushError("Unable to save changes right now.");
        return false;
      } finally {
        setAdminSaving(false);
      }
    },
    [pushError],
  );

  const interactiveTransition = prefersReducedMotion ? "" : "transition duration-200";
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c1a]";
  const headerButtonClass = `flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/80 ${interactiveTransition} ${focusRing} hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11`;
  const menuItemClass = `flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white/80 ${interactiveTransition} ${focusRing} hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40`;
  const displayMemberCount = useMemo(
    () => MEMBER_FORMAT.format(memberCount),
    [memberCount],
  );
  const wallpaperStyle = useMemo<CSSProperties | undefined>(() => {
    if (!wallpaperReadyUrl) return undefined;
    return {
      backgroundImage: `url(${wallpaperReadyUrl})`,
      backgroundSize: wallpaperFit,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      opacity: wallpaperVisible ? 1 : 0,
      transform: prefersReducedMotion ? undefined : `translateY(${wallpaperParallax}px)`,
      transition: prefersReducedMotion
        ? "opacity 0.25s ease"
        : "opacity 0.4s ease, transform 0.6s ease",
    } as CSSProperties;
  }, [prefersReducedMotion, wallpaperFit, wallpaperParallax, wallpaperReadyUrl, wallpaperVisible]);
  const liveStatusLabel = isLive ? "Open" : "Locked";

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    autoScrollRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotion = () => {
      setPrefersReducedMotion(mq.matches);
    };
    handleMotion();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handleMotion);
      return () => mq.removeEventListener("change", handleMotion);
    }
    mq.addListener(handleMotion);
    return () => mq.removeListener(handleMotion);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setWallpaperReadyUrl(wallpaperUrl ?? null);
      setWallpaperVisible(!!wallpaperUrl);
      return;
    }
    if (!wallpaperUrl) {
      setWallpaperReadyUrl(null);
      setWallpaperVisible(false);
      return;
    }
    let active = true;
    const image = new window.Image();
    image.src = wallpaperUrl;
    if (image.complete) {
      setWallpaperReadyUrl(wallpaperUrl);
      setWallpaperVisible(true);
      return () => {
        active = false;
      };
    }
    setWallpaperVisible(false);
    image.onload = () => {
      if (!active) return;
      setWallpaperReadyUrl(wallpaperUrl);
      setWallpaperVisible(true);
    };
    image.onerror = () => {
      if (!active) return;
      setWallpaperReadyUrl(null);
      setWallpaperVisible(false);
    };
    return () => {
      active = false;
    };
  }, [wallpaperUrl]);

  const updateWallpaperFit = useCallback(() => {
    if (typeof window === "undefined") return;
    const width = window.innerWidth;
    setWallpaperFit(width < 520 ? "contain" : "cover");
    setIsNarrowViewport(width < 768);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    updateWallpaperFit();
    window.addEventListener("resize", updateWallpaperFit);
    return () => window.removeEventListener("resize", updateWallpaperFit);
  }, [updateWallpaperFit]);

  useEffect(() => {
    if (prefersReducedMotion || typeof window === "undefined") {
      setWallpaperParallax(0);
      return;
    }
    if (!wallpaperReadyUrl) {
      setWallpaperParallax(0);
      return;
    }
    let ticking = false;
    const maxShift = isNarrowViewport ? 12 : 26;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const offset = clamp(window.scrollY * 0.08, -maxShift, maxShift);
        setWallpaperParallax(offset);
        ticking = false;
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isNarrowViewport, prefersReducedMotion, wallpaperReadyUrl]);

  useEffect(() => {
    const timeoutMap = noticeTimeoutsRef.current;
    return () => {
      if (typeof window === "undefined") return;
      timeoutMap.forEach((timeoutId) => window.window.clearTimeout(timeoutId));
      timeoutMap.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      const hidden = document.hidden;
      pageHiddenRef.current = hidden;
      if (!hidden) {
        setUnreadCount(0);
      }
    };
    handleVisibility();

    document.addEventListener("visibilitychange", handleVisibility);

    if (typeof window !== "undefined") {
      const handleFocus = () => {
        pageHiddenRef.current = false;
        setUnreadCount(0);
      };
      window.addEventListener("focus", handleFocus);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("focus", handleFocus);
      };
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [messages],
  );

  useEffect(() => {
    if (!sortedMessages.length) return;
    if (!autoScrollRef.current) return;
    virtualizer.scrollToIndex(sortedMessages.length - 1, { align: "end" });
  }, [sortedMessages, virtualizer]);

  const isLiveAdmin = useMemo(() => Boolean(adminState), [adminState]);

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/community/live/state", { cache: "no-store" });
    if (!res.ok) throw new Error("state");
    const data: StateResponse = await res.json();
    setIsLive(data.isLive);
    setMemberCount(data.memberCount);
    setGroupName(data.groupName ?? "Live Stream Chat");
    setGroupDescription(data.groupDescription ?? null);
    setGroupAvatarUrl(data.groupAvatarUrl ?? null);
    setWallpaperUrl(data.wallpaperUrl ?? null);
    if (!isLiveAdmin) {
      setAdminActiveMembers(data.memberCount);
    }
  }, [isLiveAdmin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      fetchState().catch((err) => console.error("state refresh", err));
    }, 30000);
    return () => window.clearInterval(interval);
  }, [fetchState]);

  const mergeMessages = useCallback(
    (incoming: LiveMessage[], options?: { replace?: boolean }) => {
      setMessages((prev) => {
        let base = options?.replace ? [] : [...prev];
        let addedByOthers = false;

        incoming.forEach((msg) => {
          const existingIndex = base.findIndex((item) =>
            msg.realId && item.realId
              ? item.realId === msg.realId
              : item.id === msg.id,
          );
          if (existingIndex >= 0) {
            base[existingIndex] = {
              ...base[existingIndex],
              ...msg,
              optimistic: false,
            };
          } else {
            base.push(msg);
            if (msg.authorId && msg.authorId !== user.id) {
              addedByOthers = true;
            }
          }
        });

        base.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        if (!joinedRef.current && base.length > 10) {
          base = base.slice(base.length - 10);
        }

        if (
          !options?.replace &&
          addedByOthers &&
          pageHiddenRef.current &&
          joinedRef.current
        ) {
          setUnreadCount((value) => value + 1);
        }

        return base;
      });
    },
    [user.id],
  );

  const loadMessages = useCallback(
    async (cursor?: string | null, replace = false) => {
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(
          `/api/community/live/messages${params.size ? `?${params}` : ""}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const status = res.status;
          const data = await res.json().catch(() => ({}));
          pushError(
            STATUS_MESSAGES[status] ?? data.error ?? "Unable to load messages.",
          );
          return;
        }
        const data: MessagesResponse = await res.json();
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
        setJoined(data.joined);
        mergeMessages(data.messages, { replace });
      } catch (err) {
        console.error("messages", err);
        if (!replace) {
          pushError("Unable to load messages.");
        }
      }
    },
    [mergeMessages, pushError],
  );

  useEffect(() => {
    let active = true;
    Promise.all([fetchState(), loadMessages(undefined, true)])
      .catch((err) => console.error("live bootstrap", err))
      .finally(() => {
        if (active) setInitialLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchState, loadMessages]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel("live_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_messages" },
        (payload) => {
          const row = payload.new as any;
          const msg: LiveMessage = {
            id: `srv-${row.id}`,
            realId: row.id,
            authorId: row.author_id,
            authorName: row.author?.display_name ?? null,
            authorAvatar: row.author?.avatar_url ?? null,
            kind: row.kind,
            text: row.text,
            filePath: row.file_path,
            fileMime: row.file_mime,
            fileBytes: row.file_bytes,
            createdAt: row.created_at,
          };
          mergeMessages([msg]);
        },
      )
      .subscribe();
    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [mergeMessages]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel("live_stream_state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_stream_state", filter: "id=eq.1" },
        () => {
          fetchState().catch((err) => console.error("state update", err));
        },
      )
      .subscribe();
    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [fetchState]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    autoScrollRef.current = atBottom;
    if (el.scrollTop < 160 && hasMore && !loadingMore) {
      setLoadingMore(true);
      loadMessages(nextCursor)
        .catch((err) => console.error("load older", err))
        .finally(() => setLoadingMore(false));
    }
  }, [hasMore, loadMessages, loadingMore, nextCursor]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const fileUrlCache = useRef(
    new Map<
      string,
      {
        url: string;
        expires: number;
      }
    >(),
  );

  const resolveFileUrl = useCallback(async (path: string) => {
    const cached = fileUrlCache.current.get(path);
    if (cached && cached.expires > Date.now() + 10_000) {
      return cached.url;
    }
    const res = await csrfFetch("/api/community/live/file-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, ttl: 1800 }),
    });
    if (!res.ok) throw new Error("sign");
    const data = await res.json();
    fileUrlCache.current.set(path, {
      url: data.url,
      expires: Date.now() + (data.expiresIn ?? 1800) * 1000,
    });
    return data.url as string;
  }, []);

  const signUpload = useCallback(
    async (
      kind: "image" | "video" | "audio" | "file",
      file: File,
    ): Promise<{ path: string; token: string }> => {
      const res = await csrfFetch("/api/community/live/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          filename: file.name,
          mime: file.type,
          bytes: file.size,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "upload denied");
      }
      return res.json();
    },
    [],
  );

  const sendMessage = useCallback(
    async (payload: {
      text?: string;
      file?: { file: File; kind: "image" | "video" | "audio" | "file" };
    }) => {
      if (sending) return;
      if (!joined) {
        pushError(STATUS_MESSAGES[403]);
        return;
      }
      setSending(true);
      try {
        let body: Record<string, any> = {};
        if (payload.file) {
          const { file, kind } = payload.file;
          const signed = await signUpload(kind, file);
          const { error } = await supabaseBrowser.storage
            .from("dm-uploads")
            .uploadToSignedUrl(signed.path, signed.token, file);
          if (error) {
            console.error("upload", error);
            pushError("Upload failed. Please try again.");
            return;
          }
          body = {
            kind,
            filePath: signed.path,
            fileMime: file.type,
            fileBytes: file.size,
            text: payload.text?.trim() || undefined,
          };
        } else {
          body = { text: payload.text?.trim() };
        }

        const optimistic: LiveMessage | null = payload.file
          ? {
              id: `temp-${Date.now()}`,
              authorId: user.id,
              authorName: user.name ?? "You",
              authorAvatar: user.avatarUrl ?? null,
              kind: payload.file.kind,
              text: body.text ?? null,
              filePath: payload.file ? body.filePath ?? null : null,
              fileMime: payload.file.file.type,
              fileBytes: payload.file.file.size,
              createdAt: new Date().toISOString(),
              optimistic: true,
            }
          : body.text
            ? {
                id: `temp-${Date.now()}`,
                authorId: user.id,
                authorName: user.name ?? "You",
                authorAvatar: user.avatarUrl ?? null,
                kind: "text",
                text: body.text,
                filePath: null,
                fileMime: null,
                fileBytes: null,
                createdAt: new Date().toISOString(),
                optimistic: true,
              }
            : null;

        if (optimistic) {
          mergeMessages([optimistic]);
        }

        const res = await csrfFetch("/api/community/live/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const status = res.status;
          pushError(
            STATUS_MESSAGES[status] ?? data.error ?? "Message failed to send.",
          );
          return;
        }
        const data = await res.json();
        mergeMessages([data.message]);
        trackLiveEvent("live_send", { kind: data.message.kind });
      } catch (err) {
        console.error("send", err);
        pushError("Message failed to send.");
      } finally {
        setSending(false);
      }
    },
    [
      joined,
      mergeMessages,
      pushError,
      sending,
      signUpload,
      user.avatarUrl,
      user.id,
      user.name,
    ],
  );

  const handleDeleteMessage = useCallback(
    async (message: LiveMessage) => {
      if (!message.realId) return;
      try {
        const res = await csrfFetch(`/api/community/live/messages/${message.realId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const status = res.status;
          const data = await res.json().catch(() => ({}));
          pushError(
            STATUS_MESSAGES[status] ??
              data.error ??
              "Unable to delete that message right now.",
          );
          return;
        }
        trackLiveEvent("live_delete", { id: message.realId });
        setMessages((prev) =>
          prev.filter((item) =>
            item.realId
              ? item.realId !== message.realId
              : item.id !== message.id,
          ),
        );
      } catch (err) {
        console.error("delete", err);
        pushError("Unable to delete that message right now.");
      }
    },
    [pushError],
  );

  const handleSendText = useCallback(async () => {
    const trimmed = composer.trim();
    if (!trimmed) return;
    try {
      await sendMessage({ text: trimmed });
      setComposer("");
    } catch (err) {
      console.error("send text", err);
    }
  }, [composer, sendMessage]);

  const handleFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      const kind = inferKind(file.type);
      try {
        await sendMessage({
          text: composer.trim() || undefined,
          file: { file, kind },
        });
        if (composer.trim()) setComposer("");
      } catch (err) {
        console.error("send file", err);
        pushError("Upload failed. Please try again.");
      }
    },
    [composer, pushError, sendMessage],
  );

  const handleJoin = useCallback(async () => {
    try {
      const res = await csrfFetch("/api/community/live/join", { method: "POST" });
      if (!res.ok) {
        const status = res.status;
        const data = await res.json().catch(() => ({}));
        pushError(
          STATUS_MESSAGES[status] ?? data.error ?? "Unable to join right now.",
        );
        return;
      }
      setJoined(true);
      joinedRef.current = true;
      trackLiveEvent("live_join");
      await Promise.all([fetchState(), loadMessages(undefined, true)]);
    } catch (err) {
      console.error("join", err);
      pushError("Unable to join right now.");
    }
  }, [fetchState, loadMessages, pushError]);

  const handleLeave = useCallback(async () => {
    try {
      const res = await csrfFetch("/api/community/live/leave", { method: "POST" });
      if (!res.ok) {
        const status = res.status;
        const data = await res.json().catch(() => ({}));
        pushError(
          STATUS_MESSAGES[status] ?? data.error ?? "Unable to leave right now.",
        );
        return;
      }
      setJoined(false);
      joinedRef.current = false;
      trackLiveEvent("live_leave");
      await Promise.all([fetchState(), loadMessages(undefined, true)]);
      setMenuOpen(false);
    } catch (err) {
      console.error("leave", err);
      pushError("Unable to leave right now.");
    }
  }, [fetchState, loadMessages, pushError]);

  const fetchSearch = useCallback(
    async (query: string) => {
      setSearching(true);
      try {
        const res = await fetch(`/api/community/live/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          const status = res.status;
          const data = await res.json().catch(() => ({}));
          pushError(
            STATUS_MESSAGES[status] ?? data.error ?? "Search failed. Try again soon.",
          );
          setSearchResults([]);
          return;
        }
        const data: SearchResponse = await res.json();
        setSearchResults(data.messages);
      } catch (err) {
        console.error("search", err);
        setSearchResults([]);
        pushError("Search failed. Try again soon.");
      } finally {
        setSearching(false);
      }
    },
    [pushError],
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!searchQuery.trim()) return;
      fetchSearch(searchQuery.trim());
    },
    [fetchSearch, searchQuery],
  );

  const handleSearchSelect = useCallback(
    (message: LiveMessage) => {
      setShowSearch(false);
      const index = sortedMessages.findIndex((item) => item.realId === message.realId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
      }
    },
    [sortedMessages, virtualizer],
  );

  const ensureRegistration = useCallback(async () => {
    if (typeof window === "undefined") throw new Error("push disabled");
    if (!("serviceWorker" in navigator)) throw new Error("push disabled");
    const existing = await navigator.serviceWorker.getRegistration("/sw.js");
    if (existing) return existing;
    return navigator.serviceWorker.register("/sw.js");
  }, []);

  const fromBuffer = useCallback((buffer: ArrayBuffer | null) => {
    if (!buffer) return "";
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }, []);

  const toUint8 = useCallback((base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  const togglePush = useCallback(
    async (enable: boolean) => {
      setPushBusy(true);
      try {
        const registration = await ensureRegistration();
        let subscription = await registration.pushManager.getSubscription();
        if (enable && !subscription) {
          if (typeof Notification !== "undefined") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
              pushError("Enable notifications in your browser to subscribe.");
              setPushBusy(false);
              return;
            }
          }
          const keyRes = await fetch("/api/community/live/push/public-key");
          if (!keyRes.ok) {
            pushError("Unable to configure notifications right now.");
            setPushBusy(false);
            return;
          }
          const keyJson = await keyRes.json();
          if (!keyJson.key) {
            pushError("Notifications are not available for this browser.");
            setPushBusy(false);
            return;
          }
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toUint8(keyJson.key as string),
          });
        }
        if (!subscription) {
          pushError("Notifications are not available on this device.");
          setPushBusy(false);
          return;
        }
        if (enable) {
          const payload = {
            endpoint: subscription.endpoint,
            p256dh: fromBuffer(subscription.getKey("p256dh")),
            auth: fromBuffer(subscription.getKey("auth")),
          };
          const res = await csrfFetch("/api/community/live/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const status = res.status;
            const data = await res.json().catch(() => ({}));
            pushError(
              STATUS_MESSAGES[status] ??
                data.error ??
                "Unable to enable notifications right now.",
            );
            setPushBusy(false);
            return;
          }
        } else {
          const res = await csrfFetch("/api/community/live/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (!res.ok) {
            const status = res.status;
            const data = await res.json().catch(() => ({}));
            pushError(
              STATUS_MESSAGES[status] ??
                data.error ??
                "Unable to disable notifications right now.",
            );
            setPushBusy(false);
            return;
          }
        }
        setPushEnabled(enable);
        trackLiveEvent("live_toggle_notifications", { enabled: enable });
      } catch (err) {
        console.error("push toggle", err);
        pushError("Unable to update notifications right now.");
      } finally {
        setPushBusy(false);
      }
    },
    [ensureRegistration, fromBuffer, toUint8, pushError],
  );

  useEffect(() => {
    fetch("/api/community/live/push/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.active) setPushEnabled(true);
      })
      .catch(() => {});
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetRecording = useCallback(() => {
    setRecording(false);
    setRecordingSeconds(0);
    setRecordingError(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  const handleMic = useCallback(async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener("stop", async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        resetRecording();
        if (!blob.size) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        try {
          await sendMessage({ file: { file, kind: "audio" } });
        } catch (err) {
          console.error("voice", err);
          setRecordingError("Voice upload failed");
          pushError("Voice upload failed.");
        }
      });
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("mic", err);
      resetRecording();
      setRecordingError("Microphone access denied");
      pushError("Microphone access denied.");
    }
  }, [pushError, recording, resetRecording, sendMessage]);

  const composerDisabled = (!joined && !isLiveAdmin) || (!isLive && !isLiveAdmin) || sending;
  const showJoinBanner = !joined && !isLiveAdmin;
  const lockBannerText = !isLive
    ? isLiveAdmin
      ? "Chat is currently locked. Lock toggles with the Telegram live session."
      : "Chat opens while the stream is live – we’ll ping you when we go on air."
    : null;
  const [searchFocused, setSearchFocused] = useState(false);

  const lockedTooltip = !isLive
    ? isLiveAdmin
      ? "Lock toggles with the Telegram live session"
      : "Opens during livestream"
    : undefined;

  const handleEmoji = useCallback(
    (emoji: any) => {
      const native = emoji?.native;
      if (!native) return;
      setComposer((prev) => prev + native);
    },
    [],
  );

  return (
    <>
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-6 text-white">
      {notices.length > 0 && (
        <div className="pointer-events-none fixed bottom-6 right-4 z-50 flex w-full max-w-xs flex-col gap-3 sm:pointer-events-auto">
          {notices.map((notice) => (
            <div
              key={notice.id}
              role="status"
              aria-live="assertive"
              className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                notice.variant === "success"
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                  : "border-rose-400/60 bg-rose-500/20 text-rose-100"
              }`}
            >
              {notice.text}
            </div>
          ))}
        </div>
      )}
      <section
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#181832] via-[#10102a] to-[#1e1335] ${
          prefersReducedMotion ? "" : "shadow-[0_20px_60px_rgba(118,76,255,0.35)]"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden">
          {wallpaperStyle && (
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-no-repeat ${
                prefersReducedMotion ? "" : "will-change-transform"
              }`}
              style={wallpaperStyle}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050515]/65 via-[#050515]/25 to-[#050515]/80" />
        </div>
        <div
          className={`relative flex flex-col gap-6 p-4 sm:p-8 ${
            prefersReducedMotion ? "bg-black/30" : "bg-white/5 backdrop-blur-md"
          }`}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <GroupAvatar name={groupName} avatarUrl={groupAvatarUrl} />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">Live Energy</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-2xl font-semibold sm:text-3xl md:text-4xl">{groupName}</h1>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isLive ? "bg-emerald-400" : "bg-white/40"
                      } ${!prefersReducedMotion && isLive ? "animate-pulse" : ""}`}
                    />
                    {liveStatusLabel}
                  </span>
                </div>
                {groupDescription && (
                  <p className="mt-2 max-w-xl text-sm text-white/70">{groupDescription}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                    {displayMemberCount} subscribers
                  </span>
                  {isLiveAdmin && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
                      {adminActiveMembers} active · {adminRemovedMembers} removed
                    </span>
                  )}
                  {joined && unreadCount > 0 && (
                    <span
                      className="inline-flex items-center gap-2 rounded-full border border-violet-400/60 bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-100"
                      aria-live="polite"
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {isLiveAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => openAdminPanel("general")}
                    title="Edit group"
                    aria-label="Edit group"
                    className={headerButtonClass}
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePush(!pushEnabled)}
                    disabled={pushBusy}
                    aria-label={pushEnabled ? "Disable live notifications" : "Enable live notifications"}
                    aria-pressed={pushEnabled}
                    title={pushEnabled ? "Disable live notifications" : "Enable live notifications"}
                    className={`${headerButtonClass} ${pushEnabled ? "text-white" : ""}`}
                  >
                    {pushBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => joined && setShowSearch(true)}
                    disabled={!joined}
                    aria-label="Search chat"
                    aria-disabled={!joined}
                    title={joined ? "Search messages" : "Join chat to search the archive"}
                    className={`${headerButtonClass} ${!joined ? "opacity-40" : ""}`}
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAdminPanel("recent")}
                    title="Recent actions"
                    aria-label="Recent actions"
                    className={headerButtonClass}
                  >
                    <Clock className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => togglePush(!pushEnabled)}
                    disabled={pushBusy}
                    aria-label={pushEnabled ? "Disable live notifications" : "Enable live notifications"}
                    aria-pressed={pushEnabled}
                    title={pushEnabled ? "Disable live notifications" : "Enable live notifications"}
                    className={`${headerButtonClass} ${pushEnabled ? "text-white" : ""}`}
                  >
                    {pushBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => joined && setShowSearch(true)}
                    disabled={!joined}
                    aria-label="Search chat"
                    aria-disabled={!joined}
                    title={joined ? "Search messages" : "Join chat to search the archive"}
                    className={`${headerButtonClass} ${!joined ? "opacity-40" : ""}`}
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((prev) => !prev)}
                      aria-label="Chat menu"
                      aria-expanded={menuOpen}
                      className={headerButtonClass}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-12 z-20 w-48 rounded-2xl border border-white/10 bg-[#161624]/95 p-2 shadow-xl backdrop-blur">
                        <button
                          type="button"
                          onClick={() => {
                            closeAllMenus();
                            handleLeave().catch((err) => console.error(err));
                          }}
                          className={menuItemClass}
                        >
                          Leave chat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSearch(true);
                            closeAllMenus();
                          }}
                          className={`${menuItemClass} text-white/70`}
                        >
                          About
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end md:hidden">
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  isLiveAdmin
                    ? setMobileAdminMenuOpen((prev) => !prev)
                    : setMenuOpen((prev) => !prev)
                }
                aria-label="More actions"
                aria-expanded={isLiveAdmin ? mobileAdminMenuOpen : menuOpen}
                className={headerButtonClass}
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {(isLiveAdmin ? mobileAdminMenuOpen : menuOpen) && (
                <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-white/10 bg-[#161624]/95 p-2 shadow-xl backdrop-blur">
                  {isLiveAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          openAdminPanel("general");
                          closeAllMenus();
                        }}
                        className={menuItemClass}
                      >
                        Edit group
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openAdminPanel("recent");
                          closeAllMenus();
                        }}
                        className={menuItemClass}
                      >
                        Recent actions
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          togglePush(!pushEnabled);
                          closeAllMenus();
                        }}
                        disabled={pushBusy}
                        className={menuItemClass}
                      >
                        {pushEnabled ? "Disable notifications" : "Enable notifications"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!joined) return;
                          setShowSearch(true);
                          closeAllMenus();
                        }}
                        disabled={!joined}
                        className={`${menuItemClass} ${!joined ? "opacity-40" : ""}`}
                      >
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeAllMenus();
                          handleLeave().catch((err) => console.error(err));
                        }}
                        className={`${menuItemClass} text-white/70`}
                      >
                        Leave chat
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          togglePush(!pushEnabled);
                          closeAllMenus();
                        }}
                        disabled={pushBusy}
                        className={menuItemClass}
                      >
                        {pushEnabled ? "Disable notifications" : "Enable notifications"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!joined) return;
                          setShowSearch(true);
                          closeAllMenus();
                        }}
                        disabled={!joined}
                        className={`${menuItemClass} ${!joined ? "opacity-40" : ""}`}
                      >
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeAllMenus();
                          handleLeave().catch((err) => console.error(err));
                        }}
                        className={`${menuItemClass} text-white/70`}
                      >
                        Leave chat
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <GlowPanel className="flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#0c0c1a] via-[#101032] to-[#0c0c1a]">
        <div className="space-y-3 border-b border-white/10 px-6 py-4">
          {showJoinBanner && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Join to chat and unlock the complete live history.
            </div>
          )}
          {lockBannerText && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {lockBannerText}
            </div>
          )}
        </div>
        <div className="relative flex-1">
          <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-6">
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const message = sortedMessages[item.index];
                if (!message) return null;
                return (
                  <div
                    key={message.id}
                    ref={(node) => {
                      if (node) {
                        virtualizer.measureElement(node);
                      }
                    }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    <MessageBubble
                      message={message}
                      me={user}
                      resolveFileUrl={resolveFileUrl}
                      onDelete={handleDeleteMessage}
                      joined={joined}
                    />
                  </div>
                );
              })}
            </div>
            {initialLoading && (
              <div className="flex items-center justify-center py-10 text-white/60">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading live feed…
              </div>
            )}
          </div>
          {loadingMore && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-1 text-xs text-white/60 backdrop-blur">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching earlier moments…
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-4">
          {showJoinBanner && (
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
              <span>You’re seeing highlights — join to send messages and scroll deeper.</span>
              <button
                type="button"
                onClick={() => handleJoin().catch((err) => console.error(err))}
                className={`rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0f0f1f] ${interactiveTransition} ${focusRing} hover:bg-white/80`}
              >
                Join chat
              </button>
            </div>
          )}
          {lockBannerText && !showJoinBanner && !isLiveAdmin && (
            <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {lockBannerText}
            </div>
          )}
          <div className="flex items-end gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
            <button
              type="button"
              disabled={composerDisabled}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach a file"
              aria-disabled={composerDisabled}
              title={!isLive ? lockedTooltip : "Attach a file"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ${interactiveTransition} ${focusRing} hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <TextareaAutosize
              minRows={1}
              maxRows={6}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!composerDisabled) handleSendText();
                }
              }}
              disabled={composerDisabled}
              placeholder={
                !joined
                  ? "Join to share the hype…"
                  : !isLive
                    ? "We’ll open the floor once we’re live."
                    : "Drop a message for the stream…"
              }
              className="flex-1 resize-none bg-transparent text-base text-white placeholder-white/40 outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={composerDisabled}
                onClick={() => setShowEmoji((prev) => !prev)}
                aria-label="Insert emoji"
                aria-disabled={composerDisabled}
                title={!isLive ? lockedTooltip : "Insert emoji"}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ${interactiveTransition} ${focusRing} hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Smile className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={composerDisabled}
                onClick={() => handleMic().catch((err) => console.error(err))}
                aria-label={recording ? "Stop voice recording" : "Record a voice message"}
                aria-disabled={composerDisabled}
                title={
                  !isLive ? lockedTooltip : recording ? "Stop recording" : "Record a voice message"
                }
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white ${interactiveTransition} ${focusRing} hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${recording ? "border-rose-400 bg-rose-500/20" : ""}`}
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleSendText()}
                disabled={composerDisabled || !composer.trim()}
                aria-label="Send message"
                title={!isLive ? lockedTooltip : "Send message"}
                aria-disabled={composerDisabled || !composer.trim()}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-violet-500 text-white ${interactiveTransition} ${focusRing} hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
          {recording && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm text-rose-100">
              <span>Recording · {formatDuration(recordingSeconds)}</span>
              <button
                type="button"
                className={`rounded-full border border-rose-100/40 px-3 py-1 text-xs uppercase tracking-wide ${interactiveTransition} ${focusRing}`}
                onClick={() => handleMic().catch((err) => console.error(err))}
              >
                Stop
              </button>
            </div>
          )}
          {recordingError && (
            <p className="mt-2 text-sm text-rose-200/80">{recordingError}</p>
          )}
        </div>
      </GlowPanel>

      {showEmoji && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-6">
          <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#121228] p-4 shadow-2xl">
            <button
              type="button"
              aria-label="Close emoji picker"
              className={`absolute right-4 top-4 text-sm text-white/60 ${interactiveTransition} ${focusRing}`}
              onClick={() => setShowEmoji(false)}
            >
              close
            </button>
            <EmojiPicker onEmojiSelect={handleEmoji} theme="dark" />
          </div>
        </div>
      )}

      {showSearch && (
        <div className="fixed inset-0 z-40 bg-[#050514]/90 backdrop-blur">
          <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Search the live chat</h2>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                aria-label="Close search"
                className={`rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 ${interactiveTransition} ${focusRing} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSearchSubmit} className="mt-6 flex gap-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Keywords, phrases, or vibes…"
                className={`flex-1 rounded-2xl border px-4 py-3 text-white outline-none transition ${searchFocused ? "border-violet-400 bg-white/15" : "border-white/15 bg-white/10"}`}
              />
              <button
                type="submit"
                disabled={!searchQuery.trim()}
                aria-disabled={!searchQuery.trim()}
                className={`rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white ${interactiveTransition} ${focusRing} hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Search
              </button>
            </form>
            <div className="mt-6 space-y-3 overflow-auto">
              {searching && (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}
              {!searching && searchResults.length === 0 && searchQuery.trim() && (
                <p className="text-sm text-white/60">
                  No matches yet — try another phrase.
                </p>
              )}
              {searchResults.map((message) => (
                <button
                  key={`${message.realId}-${message.createdAt}`}
                  type="button"
                  onClick={() => handleSearchSelect(message)}
                  className={`w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-left text-sm text-white/80 ${interactiveTransition} ${focusRing} hover:border-white/30 hover:bg-white/15`}
                >
                  <p className="text-xs uppercase text-white/40">
                    {formatTimestamp(message.createdAt)}
                  </p>
                  <p
                    className="mt-2 text-base text-white"
                    dangerouslySetInnerHTML={{
                      __html: ensureSafeHtml(
                        message.highlight ?? highlightFallback(message),
                      ),
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.zip,.rar,.doc,.docx,.ppt,.pptx,.txt"
        className="hidden"
        onChange={handleFileSelected}
      />
      </div>
      {isLiveAdmin && (
        <LiveAdminDrawer
          open={adminDrawerOpen}
          activeTab={adminDrawerTab}
          onOpenChange={handleAdminDrawerChange}
          onTabChange={setAdminDrawerTab}
          viewerId={user.id}
          state={{
            groupName,
            groupDescription,
            groupAvatarUrl,
            wallpaperUrl,
            subscribersCount: memberCount,
            isLive,
            activeMembers: adminActiveMembers,
            removedMembers: adminRemovedMembers,
          }}
          saving={adminSaving}
          onSave={handleAdminStateSave}
          onError={pushError}
          onNotice={pushSuccess}
          onRefresh={fetchState}
        />
      )}
    </>
  );
}

type MessageBubbleProps = {
  message: LiveMessage;
  me: LiveUser;
  resolveFileUrl: (path: string) => Promise<string>;
  onDelete: (message: LiveMessage) => void | Promise<void>;
  joined: boolean;
};

function MessageBubble({
  message,
  me,
  resolveFileUrl,
  onDelete,
  joined,
}: MessageBubbleProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMine = message.authorId === me.id;
  const allowDelete = joined && isMine && !!message.realId;
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!message.filePath) {
      setUrl(null);
      return;
    }
    resolveFileUrl(message.filePath)
      .then((signed) => {
        if (!active) return;
        setUrl(signed);
        setError(null);
      })
      .catch((err) => {
        console.error("file", err);
        if (active) setError("Unable to load media");
      });
    return () => {
      active = false;
    };
  }, [message.filePath, resolveFileUrl]);

  useEffect(
    () => () => {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
      }
    },
    [],
  );

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const requestDelete = () => {
    if (!allowDelete) return;
    if (typeof window === "undefined") return;
    clearLongPress();
    if (window.confirm("Delete this message?")) {
      void onDelete(message);
    }
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!allowDelete) return;
    event.preventDefault();
    requestDelete();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!allowDelete) return;
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      clearLongPress();
      longPressTimer.current = window.setTimeout(() => {
        requestDelete();
      }, 650);
    }
  };

  const handlePointerEnd = () => {
    clearLongPress();
  };

  return (
    <div
      className={`flex gap-3 py-2 ${isMine ? "justify-end" : "justify-start"}`}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      title={allowDelete ? "Long press or right-click to delete" : undefined}
    >
      {!isMine && (
        <AvatarBadge name={message.authorName} avatarUrl={message.authorAvatar} />
      )}
      <div
        className={`max-w-[70%] rounded-3xl px-4 py-3 shadow-xl transition ${
          isMine
            ? "rounded-br-lg bg-gradient-to-br from-violet-500/80 to-indigo-500/80 text-white"
            : "rounded-bl-lg border border-white/15 bg-white/10 text-white/90 backdrop-blur"
        }`}
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
          <span>{isMine ? "You" : message.authorName ?? "Member"}</span>
          <span>{formatTimestamp(message.createdAt)}</span>
        </div>
        {message.text && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {message.text}
          </p>
        )}
        {message.filePath && (
          <div className="mt-3">
            {error && (
              <div className="rounded-xl bg-black/30 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}
            {!error && !url && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading media…
              </div>
            )}
            {!error && url && (
              <MediaAttachment message={message} url={url} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type MediaAttachmentProps = {
  message: LiveMessage;
  url: string;
};

function MediaAttachment({ message, url }: MediaAttachmentProps) {
  if (message.kind === "image") {
    return (
      <Image
        src={url}
        alt="shared"
        width={800}
        height={600}
        className="max-h-80 w-full rounded-2xl object-cover"
        unoptimized
      />
    );
  }
  if (message.kind === "video") {
    return <video src={url} controls className="max-h-80 w-full rounded-2xl" />;
  }
  if (message.kind === "audio") {
    return <audio src={url} controls className="w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs text-white transition hover:border-white/40"
    >
      📎 {message.fileMime ?? "Attachment"} ·{" "}
      {message.fileBytes ? formatBytes(message.fileBytes) : "download"}
    </a>
  );
}

type GroupAvatarProps = {
  name: string | null;
  avatarUrl: string | null;
};

function GroupAvatar({ name, avatarUrl }: GroupAvatarProps) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name ?? "Group avatar"}
        width={96}
        height={96}
        className="h-16 w-16 rounded-2xl border border-white/20 object-cover shadow-lg"
      />
    );
  }
  const initials = name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-semibold uppercase text-white/80">
      {initials || "✨"}
    </div>
  );
}

type AvatarBadgeProps = {
  name: string | null;
  avatarUrl: string | null;
};

function AvatarBadge({ name, avatarUrl }: AvatarBadgeProps) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name ?? "member"}
        width={40}
        height={40}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  const initials = name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold uppercase text-white/80">
      {initials || "✨"}
    </div>
  );
}

function inferKind(mime: string): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function highlightFallback(message: LiveMessage) {
  const source = message.text ?? `[${message.kind.toUpperCase()}]`;
  return buildPlainSnippet(source, { maxLength: 160 }) ?? "";
}
