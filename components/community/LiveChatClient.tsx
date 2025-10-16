"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import TextareaAutosize from "react-textarea-autosize";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Bell,
  Loader2,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smile,
} from "lucide-react";
import "@emoji-mart/css/emoji-mart.css";

import GlowPanel from "@/components/GlowPanel";
import { supabaseBrowser } from "@/lib/supabaseClient";

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
};

type SearchResponse = {
  messages: LiveMessage[];
};

const MEMBER_FORMAT = new Intl.NumberFormat("en-US");

type LiveChatClientProps = {
  user: LiveUser;
};

export default function LiveChatClient({ user }: LiveChatClientProps) {
  const [isLive, setIsLive] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 12,
  });

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    autoScrollRef.current = true;
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

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/community/live/state", { cache: "no-store" });
    if (!res.ok) throw new Error("state");
    const data: StateResponse = await res.json();
    setIsLive(data.isLive);
    setMemberCount(data.memberCount);
  }, []);

  const mergeMessages = useCallback(
    (incoming: LiveMessage[], replace = false) => {
      setMessages((prev) => {
        let base = replace ? [] : [...prev];
        incoming.forEach((msg) => {
          const key = msg.realId ? String(msg.realId) : msg.id;
          const existingIndex = base.findIndex((item) =>
            item.realId ? String(item.realId) === key : item.id === key,
          );
          if (existingIndex >= 0) {
            base[existingIndex] = { ...base[existingIndex], ...msg, optimistic: false };
          } else {
            base.push(msg);
          }
        });
        base.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        if (!joinedRef.current && base.length > 10) {
          return base.slice(base.length - 10);
        }
        return base;
      });
    },
    [],
  );

  const loadMessages = useCallback(
    async (cursor?: string | null, replace = false) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(
        `/api/community/live/messages${params.size ? `?${params}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("messages");
      const data: MessagesResponse = await res.json();
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
      setJoined(data.joined);
      mergeMessages(data.messages, replace);
    },
    [mergeMessages],
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
    const res = await fetch("/api/community/live/file-url", {
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
      const res = await fetch("/api/community/live/sign-upload", {
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
      if (!joined) throw new Error("join required");
      setSending(true);
      try {
        let body: Record<string, any> = {};
        if (payload.file) {
          const { file, kind } = payload.file;
          const signed = await signUpload(kind, file);
          const { error } = await supabaseBrowser.storage
            .from("dm-uploads")
            .uploadToSignedUrl(signed.path, signed.token, file);
          if (error) throw error;
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

        const res = await fetch("/api/community/live/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "send failed");
        }
        const data = await res.json();
        mergeMessages([data.message]);
      } finally {
        setSending(false);
      }
    },
    [joined, mergeMessages, sending, signUpload, user.avatarUrl, user.id, user.name],
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
      }
    },
    [composer, sendMessage],
  );

  const handleJoin = useCallback(async () => {
    const res = await fetch("/api/community/live/join", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "join failed");
    }
    setJoined(true);
    joinedRef.current = true;
    await Promise.all([fetchState(), loadMessages(undefined, true)]);
  }, [fetchState, loadMessages]);

  const handleLeave = useCallback(async () => {
    const res = await fetch("/api/community/live/leave", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "leave failed");
    }
    setJoined(false);
    joinedRef.current = false;
    await Promise.all([fetchState(), loadMessages(undefined, true)]);
    setMenuOpen(false);
  }, [fetchState, loadMessages]);

  const fetchSearch = useCallback(
    async (query: string) => {
      setSearching(true);
      try {
        const res = await fetch(`/api/community/live/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("search");
        const data: SearchResponse = await res.json();
        setSearchResults(data.messages);
      } catch (err) {
        console.error("search", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [],
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
            if (permission !== "granted") throw new Error("permission");
          }
          const keyRes = await fetch("/api/community/live/push/public-key");
          if (!keyRes.ok) throw new Error("vapid");
          const keyJson = await keyRes.json();
          if (!keyJson.key) throw new Error("vapid");
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toUint8(keyJson.key as string),
          });
        }
        if (!subscription) throw new Error("subscription");
        if (enable) {
          const payload = {
            endpoint: subscription.endpoint,
            p256dh: fromBuffer(subscription.getKey("p256dh")),
            auth: fromBuffer(subscription.getKey("auth")),
          };
          const res = await fetch("/api/community/live/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("subscribe");
        } else {
          const res = await fetch("/api/community/live/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (!res.ok) throw new Error("unsubscribe");
        }
        setPushEnabled(enable);
      } catch (err) {
        console.error("push toggle", err);
      } finally {
        setPushBusy(false);
      }
    },
    [ensureRegistration, fromBuffer, toUint8],
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
    }
  }, [recording, resetRecording, sendMessage]);

  const composerDisabled = !joined || !isLive || sending;
  const showJoinBanner = !joined;
  const showLockBanner = joined && !isLive;
  const [searchFocused, setSearchFocused] = useState(false);

  const handleEmoji = useCallback(
    (emoji: any) => {
      const native = emoji?.native;
      if (!native) return;
      setComposer((prev) => prev + native);
    },
    [],
  );

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-6 text-white">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Live Energy</p>
          <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Live Stream Chat</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm text-white/80">
            {MEMBER_FORMAT.format(memberCount)} members
          </span>
          <button
            type="button"
            onClick={() => togglePush(!pushEnabled)}
            disabled={pushBusy}
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/20 transition hover:border-white/40 hover:bg-white/10 ${pushEnabled ? "text-white" : "text-white/70"}`}
          >
            {pushBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => joined && setShowSearch(true)}
            disabled={!joined}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
          >
            <Search className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/40 hover:bg-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-20 w-48 rounded-2xl border border-white/10 bg-[#161624]/95 p-2 shadow-xl backdrop-blur">
                <button
                  type="button"
                  onClick={() => handleLeave().catch((err) => console.error(err))}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Leave chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/10"
                >
                  About
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <GlowPanel className="flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#0c0c1a] via-[#101032] to-[#0c0c1a]">
        <div className="space-y-3 border-b border-white/10 px-6 py-4">
          {showJoinBanner && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Join to chat and unlock the complete live history.
            </div>
          )}
          {showLockBanner && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Chat opens while the stream is live – we’ll ping you when we go on air.
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
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0f0f1f] transition hover:bg-white/80"
              >
                Join chat
              </button>
            </div>
          )}
          <div className="flex items-end gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
            <button
              type="button"
              disabled={composerDisabled}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
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
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
              >
                <Smile className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={composerDisabled}
                onClick={() => handleMic().catch((err) => console.error(err))}
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/10 disabled:opacity-40 ${recording ? "border-rose-400 bg-rose-500/20" : ""}`}
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleSendText()}
                disabled={composerDisabled || !composer.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-40"
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
                className="rounded-full border border-rose-100/40 px-3 py-1 text-xs uppercase tracking-wide"
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
              className="absolute right-4 top-4 text-sm text-white/60"
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
                className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 transition hover:bg-white/10"
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
                className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
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
                  className="w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-left text-sm text-white/80 transition hover:border-white/30 hover:bg-white/15"
                >
                  <p className="text-xs uppercase text-white/40">
                    {formatTimestamp(message.createdAt)}
                  </p>
                  <p
                    className="mt-2 text-base text-white"
                    dangerouslySetInnerHTML={{
                      __html: message.highlight ?? highlightFallback(message),
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
  );
}

type MessageBubbleProps = {
  message: LiveMessage;
  me: LiveUser;
  resolveFileUrl: (path: string) => Promise<string>;
};

function MessageBubble({ message, me, resolveFileUrl }: MessageBubbleProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMine = message.authorId === me.id;

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

  return (
    <div className={`flex gap-3 py-2 ${isMine ? "justify-end" : "justify-start"}`}>
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
  if (message.text) {
    return message.text.replace(/\s+/g, " ").slice(0, 160);
  }
  return `[${message.kind.toUpperCase()}]`;
}
