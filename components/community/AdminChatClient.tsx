
"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import { useVirtualizer } from "@tanstack/react-virtual";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { hasSubscription, subscribePush, unsubscribePush } from "@/lib/pushClient";
import GlowPanel from "@/components/GlowPanel";
import Image from "next/image";
import "@emoji-mart/css/emoji-mart.css";

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
      EmojiPickerComponent.displayName = "EmojiPickerComponent";
      return EmojiPickerComponent;
    }),
  { ssr: false },
);

type ThreadMeta = {
  id: string;
  userId: string;
  status: string;
  startedAt: string;
  lastMessageAt: string | null;
  wallpaperUrl: string | null;
  avatarUrl: string | null;
  description: string | null;
};

type Message = {
  id: string;
  threadId: string;
  authorId: string | null;
  kind: string;
  text: string | null;
  fileUrl: string | null;
  fileMime: string | null;
  fileBytes: number | null;
  editedAt: string | null;
  createdAt: string;
  highlight?: string | null;
};

type ChatUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  isDmAdmin?: boolean;
};

type MessagesResponse = {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
};

type SearchResponse = {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
};

type AuditEntry = {
  id: number;
  threadId: string;
  actorId: string | null;
  action: string;
  targetId: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
  text: string;
};

type AuditResponse = {
  entries: AuditEntry[];
  hasMore: boolean;
  nextCursor: string | null;
};

type AdminChatClientProps = {
  initialThread: ThreadMeta | null;
  user: ChatUser;
};

type UploadTask = {
  id: string;
  filename: string;
  kind: "image" | "video" | "audio" | "file";
  progress: number | null;
  error?: string;
};

const formatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "numeric",
});

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "mark",
    "u",
    "spoiler",
  ],
  attributes: {
    ...(defaultSchema.attributes || {}),
    spoiler: ["className"],
    mark: ["className"],
    u: ["className"],
  },
} as any;

function formatTime(value: string) {
  try {
    return formatter.format(new Date(value));
  } catch {
    return value;
  }
}

function clampWords(input: string, limit: number) {
  const words = input.trim().split(/\s+/);
  return words.slice(0, limit).join(" ");
}
export default function AdminChatClient({
  initialThread,
  user,
}: AdminChatClientProps) {
  const [thread, setThread] = useState<ThreadMeta | null>(initialThread);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [metaForm, setMetaForm] = useState({
    avatarUrl: initialThread?.avatarUrl ?? "",
    wallpaperUrl: initialThread?.wallpaperUrl ?? "",
    description: initialThread?.description ?? "",
  });
  const [pushSupported, setPushSupported] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(
    null,
  );
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileUrlCache = useRef<Map<string, { url: string; expires: number }>>(
    new Map(),
  );

  const isDmAdmin = !!user.isDmAdmin;
  const pushLabel = pushSupported
    ? pushSubscribed
      ? "Subscribed"
      : "Off"
    : "Unavailable";
  const pushIcon = pushSupported ? (pushSubscribed ? "🔔" : "🔕") : "🚫";

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 140,
    overscan: 8,
  });

  const scrollToBottom = useCallback(
    (smooth = false) => {
      if (messages.length === 0) return;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, {
          align: "end",
          behavior: smooth ? "smooth" : "auto",
        });
      });
    },
    [messages.length, virtualizer],
  );

  const memoizedThreadId = thread?.id;

  const loadMessages = useCallback(
    async (cursor?: string) => {
      if (!memoizedThreadId) return;
      setLoadingMessages(true);
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(
          `/api/community/adminchat/messages${params.toString() ? `?${params}` : ""}`,
          { method: "GET", cache: "no-store" },
        );
        if (!res.ok) throw new Error("Failed to load messages");
        const data: MessagesResponse = await res.json();
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
        setMessages((prev) =>
          cursor ? [...data.messages, ...prev] : data.messages,
        );
        if (!cursor) {
          scrollToBottom(false);
        }
      } catch (err) {
        console.error(err);
        setError("Could not load messages.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [memoizedThreadId, scrollToBottom],
  );

  const refreshThread = useCallback(async () => {
    try {
      const res = await fetch("/api/community/adminchat/thread", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.thread) {
        setThread(data.thread);
        setMetaForm({
          avatarUrl: data.thread.avatarUrl ?? "",
          wallpaperUrl: data.thread.wallpaperUrl ?? "",
          description: data.thread.description ?? "",
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadAudit = useCallback(
    async (cursor?: string) => {
      if (!isDmAdmin || !memoizedThreadId) return;
      setAuditLoading(true);
      try {
        const params = new URLSearchParams({ threadId: memoizedThreadId });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(
          `/api/community/adminchat/audit?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Failed to load audit entries");
        const data: AuditResponse = await res.json();
        setAuditEntries((prev) =>
          cursor ? [...prev, ...data.entries] : data.entries,
        );
        setAuditHasMore(data.hasMore);
        setAuditCursor(data.nextCursor);
        setAuditError(null);
      } catch (err) {
        console.error(err);
        setAuditError("Unable to load recent actions.");
      } finally {
        setAuditLoading(false);
      }
    },
    [isDmAdmin, memoizedThreadId],
  );

  const refreshAuditIfOpen = useCallback(() => {
    if (auditOpen && !auditLoading) {
      loadAudit();
    }
  }, [auditLoading, auditOpen, loadAudit]);

  const handleLoadMoreAudit = useCallback(() => {
    if (!auditCursor || auditLoading) return;
    loadAudit(auditCursor);
  }, [auditCursor, auditLoading, loadAudit]);

  const handleTogglePush = useCallback(async () => {
    if (!pushSupported || pushLoading) return;
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await unsubscribePush();
        setPushSubscribed(false);
      } else {
        await subscribePush();
        setPushSubscribed(true);
      }
      refreshAuditIfOpen();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to update push notifications.";
      if (message.toLowerCase().includes("denied")) {
        setError("Notifications are blocked in your browser settings.");
      } else {
        setError("Unable to update push notifications right now.");
      }
    } finally {
      setPushLoading(false);
    }
  }, [pushSupported, pushLoading, pushSubscribed, refreshAuditIfOpen]);

  useEffect(() => {
    if (memoizedThreadId) {
      loadMessages();
    }
  }, [memoizedThreadId, loadMessages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      typeof Notification !== "undefined";
    setPushSupported(supported);
    if (!supported) return;
    hasSubscription()
      .then((value) => setPushSubscribed(value))
      .catch(() => setPushSubscribed(false));
  }, []);

  useEffect(() => {
    setAuditEntries([]);
    setAuditCursor(null);
    setAuditHasMore(false);
    setAuditError(null);
    setAuditOpen(false);
  }, [memoizedThreadId]);

  useEffect(() => {
    if (!auditOpen || !isDmAdmin || !memoizedThreadId) return;
    if (auditEntries.length > 0 || auditLoading) return;
    loadAudit();
  }, [
    auditOpen,
    isDmAdmin,
    memoizedThreadId,
    loadAudit,
    auditEntries.length,
    auditLoading,
  ]);

  const sendReceipt = useCallback(
    async (typing: boolean) => {
      if (!memoizedThreadId) return;
      try {
        await fetch("/api/community/adminchat/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: isDmAdmin ? memoizedThreadId : undefined,
            typing,
            lastReadAt: !typing ? new Date().toISOString() : undefined,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    },
    [memoizedThreadId, isDmAdmin],
  );

  useEffect(() => {
    if (!memoizedThreadId) return;
    const channel = supabaseBrowser.channel(`dm_thread_${memoizedThreadId}`);
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${memoizedThreadId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const next = [...prev, mapMessageRow(row)];
            return next.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );
          });
          if (row.author_id !== user.id) {
            sendReceipt(false);
          }
          scrollToBottom(true);
          refreshAuditIfOpen();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${memoizedThreadId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === row.id
                ? { ...mapMessageRow(row), highlight: msg.highlight }
                : msg,
            ),
          );
          refreshAuditIfOpen();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${memoizedThreadId}`,
        },
        (payload) => {
          const row = payload.old as any;
          if (!row?.id) return;
          setMessages((prev) => prev.filter((msg) => msg.id !== row.id));
          refreshAuditIfOpen();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_message_visibility",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const hidden = payload.new as any;
          if (!hidden.hidden) return;
          setMessages((prev) => prev.filter((msg) => msg.id !== hidden.message_id));
          if (hidden.user_id !== user.id) {
            refreshAuditIfOpen();
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [memoizedThreadId, refreshAuditIfOpen, scrollToBottom, sendReceipt, user.id]);

  useEffect(() => {
    if (!memoizedThreadId) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last && last.authorId !== user.id) {
      sendReceipt(false);
    }
  }, [messages, memoizedThreadId, sendReceipt, user.id]);

  useEffect(() => {
    if (!memoizedThreadId) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (composer.trim().length > 0) {
      sendReceipt(true);
      typingTimeout.current = setTimeout(() => {
        sendReceipt(false);
      }, 1500);
    } else {
      sendReceipt(false);
    }
  }, [composer, memoizedThreadId, sendReceipt]);
  const applyFormatting = useCallback((type: "bold" | "italic" | "underline" | "quote" | "spoiler") => {
    const textarea = composerRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = composer.slice(start, end);
    let before = "";
    let after = "";
    switch (type) {
      case "bold":
        before = after = "**";
        break;
      case "italic":
        before = after = "*";
        break;
      case "underline":
        before = "<u>";
        after = "</u>";
        break;
      case "quote":
        before = "\n> ";
        after = "\n";
        break;
      case "spoiler":
        before = "||";
        after = "||";
        break;
    }
    const nextValue =
      composer.slice(0, start) + before + selected + after + composer.slice(end);
    setComposer(nextValue);
    requestAnimationFrame(() => {
      const pos = start + before.length + selected.length + after.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  }, [composer]);

  const handleInsertEmoji = useCallback(
    (emoji: any) => {
      const textarea = composerRef.current;
      const native = emoji?.native;
      if (!textarea || !native) return;
      const start = textarea.selectionStart ?? composer.length;
      const end = textarea.selectionEnd ?? composer.length;
      const nextValue =
        composer.slice(0, start) + native + composer.slice(end);
      setComposer(nextValue);
      requestAnimationFrame(() => {
        const pos = start + native.length;
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
      });
    },
    [composer],
  );

  const signUpload = useCallback(
    async (
      kind: "image" | "video" | "audio" | "file",
      file: File,
    ): Promise<{ path: string; token: string; expiresIn: number }> => {
      if (!memoizedThreadId) throw new Error("No thread");
      const res = await fetch("/api/community/adminchat/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: memoizedThreadId,
          kind,
          filename: file.name,
          mime: file.type,
          bytes: file.size,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to sign upload");
      }
      return res.json();
    },
    [memoizedThreadId],
  );

  const resolveFileUrl = useCallback(
    async (path: string) => {
      const cached = fileUrlCache.current.get(path);
      if (cached && cached.expires > Date.now() + 10_000) {
        return cached.url;
      }

      const res = await fetch("/api/community/adminchat/file-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, ttl: 3600 }),
      });
      if (!res.ok) {
        fileUrlCache.current.delete(path);
        throw new Error("Failed to sign file");
      }
      const data = await res.json();
      const expires = Date.now() + (data.expiresIn ?? 3600) * 1000;
      fileUrlCache.current.set(path, { url: data.url, expires });
      return data.url as string;
    },
    [],
  );

  const handleSend = useCallback(async () => {
    if (!memoizedThreadId || sending) return;
    const trimmed = composer.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await fetch("/api/community/adminchat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          threadId: isDmAdmin ? memoizedThreadId : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const data = await res.json();
      setMessages((prev) => {
        const next = [...prev, data.message as Message];
        return next.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );
      });
      setComposer("");
      scrollToBottom(true);
      refreshAuditIfOpen();
    } catch (err) {
      console.error(err);
      setError("Message failed to send.");
    } finally {
      setSending(false);
    }
  }, [composer, isDmAdmin, memoizedThreadId, refreshAuditIfOpen, scrollToBottom, sending]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      setEditingId(null);
      setEditingText("");
      return;
    }
    try {
      const res = await fetch(`/api/community/adminchat/message/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.message.id
            ? { ...data.message, highlight: msg.highlight }
            : msg,
        ),
      );
      refreshAuditIfOpen();
      setEditingId(null);
      setEditingText("");
    } catch (err) {
      console.error(err);
      setError("Unable to edit message.");
    }
  }, [editingId, editingText, refreshAuditIfOpen]);

  const handleHide = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(
        `/api/community/adminchat/message/${messageId}/hide`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed");
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      refreshAuditIfOpen();
    } catch (err) {
      console.error(err);
      setError("Failed to delete message.");
    }
  }, [refreshAuditIfOpen]);

  const handleHardDelete = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`/api/community/adminchat/message/${messageId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      refreshAuditIfOpen();
    } catch (err) {
      console.error(err);
      setError("Failed to hard delete message.");
    }
  }, [refreshAuditIfOpen]);

  const compressImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return file;
    const img = document.createElement("img");
    const objectUrl = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });
    const maxDim = Math.max(img.width, img.height);
    if (maxDim <= 1920) {
      URL.revokeObjectURL(objectUrl);
      return file;
    }
    const scale = 1920 / maxDim;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        (b) => resolve(b),
        file.type,
        0.9,
      ),
    );
    if (!blob) return file;
    return new File([blob], file.name, { type: file.type });
  }, []);

  const uploadAndSend = useCallback(
    async (file: File, kind: "image" | "video" | "audio" | "file") => {
      const taskId = `${Date.now()}-${file.name}`;
      setUploadQueue((prev) => [
        ...prev,
        { id: taskId, filename: file.name, kind, progress: null },
      ]);
      try {
        const preparedFile =
          kind === "image" ? await compressImage(file) : file;
        const signed = await signUpload(kind, preparedFile);
        const { error: uploadError } = await supabaseBrowser
          .storage
          .from("dm-uploads")
          .uploadToSignedUrl(signed.path, signed.token, preparedFile);
        if (uploadError) throw uploadError;

        const payload = {
          kind,
          filePath: signed.path,
          fileMime: preparedFile.type,
          fileBytes: preparedFile.size,
        };

        const res = await fetch("/api/community/adminchat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to send media");
        const data = await res.json();
        setMessages((prev) => {
          const next = [...prev, data.message as Message];
          return next.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime(),
          );
        });
        refreshAuditIfOpen();
        scrollToBottom(true);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Upload failed");
        setUploadQueue((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, error: err?.message ?? "failed" } : task,
          ),
        );
      } finally {
        setUploadQueue((prev) => prev.filter((task) => task.id !== taskId));
      }
    },
    [compressImage, refreshAuditIfOpen, scrollToBottom, signUpload],
  );

  const handleFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video" | "audio" | "file") => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      event.target.value = "";
      setAttachMenuOpen(false);
      await uploadAndSend(file, kind);
    },
    [uploadAndSend],
  );
  const startRecording = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const file = new File(
          [blob],
          `voice-${Date.now()}.webm`,
          { type: "audio/webm" },
        );
        await uploadAndSend(file, "audio");
        setRecording(false);
        setRecordingSeconds(0);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((secs) => secs + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      setError("Microphone access denied.");
    }
  }, [recording, uploadAndSend]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }, [recording]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      setSearchResults([]);
      setSearchQuery("");
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    if (!memoizedThreadId || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchQuery.trim() });
        if (isDmAdmin) params.set("threadId", memoizedThreadId);
        const res = await fetch(
          `/api/community/adminchat/messages?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!res.ok) throw new Error("Search failed");
        const data: SearchResponse = await res.json();
        setSearchResults(data.messages);
        setSearchError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSearchError("Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isDmAdmin, memoizedThreadId, searchOpen, searchQuery]);

  const scrollToMessage = useCallback(
    (id: string) => {
      const index = messages.findIndex((msg) => msg.id === id);
      if (index === -1) return;
      setActiveHighlight(id);
      virtualizer.scrollToIndex(index, {
        align: "center",
        behavior: "smooth",
      });
      setTimeout(() => setActiveHighlight(null), 2000);
      setSearchOpen(false);
    },
    [messages, virtualizer],
  );

  const onLoadMore = useCallback(() => {
    if (!hasMore || !nextCursor) return;
    loadMessages(nextCursor);
  }, [hasMore, loadMessages, nextCursor]);

  const handleComposerKey = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (mod) {
        if (event.key.toLowerCase() === "b") {
          event.preventDefault();
          applyFormatting("bold");
        } else if (event.key.toLowerCase() === "i") {
          event.preventDefault();
          applyFormatting("italic");
        } else if (event.key.toLowerCase() === "u") {
          event.preventDefault();
          applyFormatting("underline");
        }
      }
    },
    [applyFormatting, handleSend],
  );

  const handleMetaSave = useCallback(async () => {
    if (!memoizedThreadId) return;
    try {
      const payload = {
        threadId: memoizedThreadId,
        avatarUrl: metaForm.avatarUrl.trim() || null,
        wallpaperUrl: metaForm.wallpaperUrl.trim() || null,
        description: clampWords(metaForm.description, 40) || null,
      };
      const res = await fetch("/api/community/adminchat/thread", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update thread");
      const data = await res.json();
      setThread(data.thread);
      setCustomizeOpen(false);
      refreshAuditIfOpen();
    } catch (err) {
      console.error(err);
      setError("Unable to update thread details.");
    }
  }, [memoizedThreadId, metaForm, refreshAuditIfOpen]);

  const markdownComponents = useMemo(
    () => ({
      spoiler: Spoiler,
      mark: (props: any) => (
        <mark className="rounded px-1 py-0.5 bg-white/10 text-white" {...props} />
      ),
      u: (props: any) => <u className="underline-offset-2" {...props} />,
      a: (props: any) => (
        <a
          {...props}
          className="underline text-[var(--swf-glow-end)] hover:opacity-80"
          target="_blank"
          rel="noreferrer"
        />
      ),
    }),
    [],
  );

  const wallpaperStyle = useMemo(() => {
    if (!thread?.wallpaperUrl) return undefined;
    return {
      backgroundImage: `linear-gradient(rgba(7,7,11,0.92), rgba(7,7,11,0.95)), url(${thread.wallpaperUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    } as CSSProperties;
  }, [thread?.wallpaperUrl]);
  return (
    <div className="flex flex-col gap-6" style={wallpaperStyle}>
      <header className="sticky top-0 z-30 -mx-4 flex flex-col gap-4 border-b border-white/10 bg-[#07070b]/95 px-4 py-4 backdrop-blur md:mx-0 md:rounded-3xl md:border md:px-6 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {thread?.avatarUrl ? (
                <Image
                  src={thread.avatarUrl}
                  alt="Thread avatar"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-xl">💬</div>
              )}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Admin Chat
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                <span className="pill border-white/10 text-white/60">
                  {thread?.status?.toUpperCase() ?? "OPEN"}
                </span>
                {thread?.description && (
                  <span className="line-clamp-1 max-w-[320px] text-white/60">
                    {thread.description}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleTogglePush}
              disabled={!pushSupported || pushLoading}
              title={pushSupported ? "Toggle push notifications" : "Push not supported"}
            >
              <span>{pushIcon}</span>
              <span>{pushLoading ? "…" : pushLabel}</span>
            </button>
            {isDmAdmin && (
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setAuditOpen(true)}
                disabled={!memoizedThreadId}
              >
                Recent actions
              </button>
            )}
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white"
              onClick={() => setSearchOpen(true)}
            >
              Search
            </button>
            {isDmAdmin && thread && (
              <button
                type="button"
                className="btn-secondary h-10 px-4 text-xs"
                onClick={() => setCustomizeOpen(true)}
              >
                Customize
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}
      </header>

      {!thread ? (
        <GlowPanel subtle className="flex flex-col items-center gap-6 p-10 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Start a chat with the admin team
            </h2>
            <p className="text-sm text-white/65">
              Ask questions, share progress, or get feedback. Your conversation stays
              private with the Focus Squad admins.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary px-10"
            onClick={async () => {
              try {
                const res = await fetch("/api/community/adminchat/start", {
                  method: "POST",
                });
                if (!res.ok) throw new Error("Failed to start chat");
                const data = await res.json();
                setThread(data.thread);
                await refreshThread();
              } catch (err) {
                console.error(err);
                setError("Unable to start chat right now.");
              }
            }}
          >
            Start chat
          </button>
        </GlowPanel>
      ) : (
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#0d0d16]/80 shadow-[0_25px_80px_-28px_rgba(119,88,247,0.55)]">
          <div
            ref={listRef}
            className="flex max-h-[60vh] flex-col overflow-y-auto px-4 pt-6 md:px-6 md:pt-8"
          >
            {hasMore && (
              <button
                type="button"
                className="mx-auto mb-4 rounded-full border border-white/10 px-4 py-1 text-xs text-white/65 transition hover:border-white/25 hover:text-white"
                onClick={onLoadMore}
                disabled={loadingMessages}
              >
                {loadingMessages ? "Loading…" : "Load previous"}
              </button>
            )}

            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const message = messages[virtualRow.index];
                return (
                  <div
                    key={message.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: "16px",
                    }}
                  >
                    <MessageBubble
                      message={message}
                      currentUserId={user.id}
                      active={activeHighlight === message.id}
                      onEdit={(msg) => {
                        setEditingId(msg.id);
                        setEditingText(msg.text ?? "");
                      }}
                    onDelete={handleHide}
                    onHardDelete={handleHardDelete}
                    canHardDelete={isDmAdmin}
                    menuOpenId={menuOpenId}
                    setMenuOpenId={setMenuOpenId}
                    setEditingId={setEditingId}
                    editingId={editingId}
                      editingText={editingText}
                      setEditingText={setEditingText}
                      onEditSubmit={handleEditSubmit}
                      resolveFileUrl={resolveFileUrl}
                      markdownComponents={markdownComponents}
                    />
                  </div>
                );
              })}
            </div>

            <div ref={bottomRef} />
          </div>
          {uploadQueue.length > 0 && (
            <div className="px-4 md:px-6">
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                {uploadQueue.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"
                  >
                    <span>
                      {task.filename} · {task.kind.toUpperCase()}
                    </span>
                    <span>{task.error ? "Failed" : "Uploading…"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-0 rounded-3xl border-t border-white/10 bg-[#0d0d16]/95 p-4 md:border md:px-6 md:pb-6 md:pt-4">
            <div className="flex items-center gap-2 pb-3 text-sm text-white/60">
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:border-white/30 hover:text-white"
                onClick={() => applyFormatting("bold")}
              >
                B
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:border-white/30 hover:text-white"
                onClick={() => applyFormatting("italic")}
              >
                I
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:border-white/30 hover:text-white"
                onClick={() => applyFormatting("underline")}
              >
                U
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:border-white/30 hover:text-white"
                onClick={() => applyFormatting("quote")}
              >
                &gt;
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:border-white/30 hover:text-white"
                onClick={() => applyFormatting("spoiler")}
              >
                Spoiler
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:border-white/30 hover:text-white"
                onClick={() => setEmojiOpen((v) => !v)}
              >
                😊
              </button>
              <div className="relative">
                <button
                  type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition hover:border-white/30 hover:text-white"
                  onClick={() => setAttachMenuOpen((v) => !v)}
                >
                  Attach
                </button>
                <AnimatePresence>
                  {attachMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute right-0 top-10 z-50 min-w-[200px] rounded-2xl border border-white/10 bg-[#10101c] p-3 shadow-xl"
                    >
                      <div className="flex flex-col gap-2 text-xs text-white/70">
                        <label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 hover:text-white">
                          Image · ≤5MB
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleFileInput(event, "image")}
                          />
                        </label>
                        <label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 hover:text-white">
                          Video · ≤50MB
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(event) => handleFileInput(event, "video")}
                          />
                        </label>
                        <label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 hover:text-white">
                          Audio · ≤10MB
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(event) => handleFileInput(event, "audio")}
                          />
                        </label>
                        <label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/30 hover:text-white">
                          File · ≤20MB
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => handleFileInput(event, "file")}
                          />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                className={`rounded-full border border-white/10 px-3 py-1 text-xs transition ${recording ? "bg-rose-500/30 border-rose-300/40 text-rose-100" : "bg-white/5 text-white/70 hover:border-white/30 hover:text-white"}`}
                onClick={() => {
                  if (recording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
              >
                {recording ? `Stop · ${recordingSeconds}s` : "Mic"}
              </button>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_0_40px_rgba(139,92,246,0.15)]">
              <textarea
                ref={composerRef}
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={handleComposerKey}
                disabled={sending}
                placeholder="Write a message..."
                className="min-h-[72px] resize-none rounded-2xl border border-transparent bg-transparent text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>Enter to send · Shift + Enter for newline</span>
                <button
                  type="button"
                  className="btn-primary h-10 px-8"
                  onClick={handleSend}
                  disabled={sending || !composer.trim()}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {emojiOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-24 right-4 z-50 shadow-2xl md:right-10"
          >
            <GlowPanel subtle className="p-2">
              <EmojiPicker
                theme="dark"
                onEmojiSelect={(emoji: any) => {
                  handleInsertEmoji(emoji);
                }}
                onClickOutside={() => setEmojiOpen(false)}
              />
            </GlowPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {auditOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur"
            onClick={() => setAuditOpen(false)}
          >
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#090912]/95 px-6 py-6 text-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Recent actions</h3>
                  <p className="text-xs text-white/50">
                    Logged events for this thread.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-white/60 transition hover:text-white"
                  onClick={() => setAuditOpen(false)}
                >
                  Close
                </button>
              </div>
              {auditError && (
                <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
                  {auditError}
                </div>
              )}
              <div className="mt-4 space-y-3">
                {auditEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                  >
                    <div>{entry.text}</div>
                    <div className="mt-2 text-[11px] uppercase tracking-wide text-white/35">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {!auditEntries.length && !auditLoading && !auditError && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-xs text-white/50">
                    No activity recorded yet.
                  </div>
                )}
                {auditLoading && auditEntries.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-white/60">
                    Loading…
                  </div>
                )}
              </div>
              {auditHasMore && (
                <button
                  type="button"
                  className="mt-6 w-full rounded-2xl border border-white/15 bg-transparent px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleLoadMoreAudit}
                  disabled={auditLoading}
                >
                  {auditLoading ? "Loading…" : "Load more"}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-10"
          >
            <GlowPanel subtle className="w-full max-w-xl p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Search messages</h3>
                <button
                  type="button"
                  className="text-sm text-white/60 hover:text-white"
                  onClick={() => setSearchOpen(false)}
                >
                  Close
                </button>
              </div>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Type to search…"
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              />
              <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto">
                {searchLoading && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
                    Searching…
                  </div>
                )}
                {searchError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
                    {searchError}
                  </div>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
                    No results yet.
                  </div>
                )}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition hover:border-white/30 hover:text-white"
                    onClick={() => scrollToMessage(result.id)}
                  >
                    <div
                      className="prose prose-invert max-w-none text-xs"
                      dangerouslySetInnerHTML={{
                        __html: buildSearchSnippet(result),
                      }}
                    />
                    <div className="mt-2 text-[11px] text-white/40">
                      {new Date(result.createdAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </GlowPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {customizeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-10"
          >
            <GlowPanel subtle className="w-full max-w-xl space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Thread appearance</h3>
                <button
                  type="button"
                  className="text-sm text-white/60 hover:text-white"
                  onClick={() => setCustomizeOpen(false)}
                >
                  Close
                </button>
              </div>
              <label className="block space-y-2 text-sm text-white/70">
                Avatar URL
                <input
                  value={metaForm.avatarUrl}
                  onChange={(event) =>
                    setMetaForm((prev) => ({ ...prev, avatarUrl: event.target.value }))
                  }
                  placeholder="https://…"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                />
              </label>
              <label className="block space-y-2 text-sm text-white/70">
                Wallpaper URL
                <input
                  value={metaForm.wallpaperUrl}
                  onChange={(event) =>
                    setMetaForm((prev) => ({
                      ...prev,
                      wallpaperUrl: event.target.value,
                    }))
                  }
                  placeholder="https://…"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                />
              </label>
              <label className="block space-y-2 text-sm text-white/70">
                Description (≤ 40 words)
                <textarea
                  value={metaForm.description}
                  onChange={(event) =>
                    setMetaForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                />
              </label>
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>
                  {metaForm.description.trim()
                    ? metaForm.description.trim().split(/\s+/).length
                    : 0}{" "}
                  words
                </span>
                <button
                  type="button"
                  className="btn-primary h-10 px-6"
                  onClick={handleMetaSave}
                >
                  Save changes
                </button>
              </div>
            </GlowPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type MessageBubbleProps = {
  message: Message;
  currentUserId: string;
  active: boolean;
  onEdit: (message: Message) => void;
  onDelete: (id: string) => void;
  onHardDelete: (id: string) => void;
  canHardDelete: boolean;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  editingId: string | null;
  editingText: string;
  setEditingId: (value: string | null) => void;
  setEditingText: (value: string) => void;
  onEditSubmit: () => void;
  resolveFileUrl: (path: string) => Promise<string>;
  markdownComponents: Record<string, any>;
};

function MessageBubble({
  message,
  currentUserId,
  active,
  onEdit,
  onDelete,
  onHardDelete,
  canHardDelete,
  menuOpenId,
  setMenuOpenId,
  editingId,
  editingText,
  setEditingId,
  setEditingText,
  onEditSubmit,
  resolveFileUrl,
  markdownComponents,
}: MessageBubbleProps) {
  const mine = message.authorId === currentUserId;
  const isEditing = editingId === message.id;
  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[75%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-[0_15px_45px_rgba(9,9,20,0.4)] ${
          mine
            ? "border-transparent bg-gradient-to-r from-[var(--swf-glow-start)] to-[var(--swf-glow-end)] text-white"
            : "border-white/10 bg-white/5 text-white/85"
        } ${active ? "ring-2 ring-[var(--swf-glow-end)]" : ""}`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editingText}
              onChange={(event) => setEditingText(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:border-white/40"
                onClick={() => {
                  setMenuOpenId(null);
                  setEditingId(null);
                  setEditingText("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary h-9 px-4 text-xs"
                onClick={onEditSubmit}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <Fragment>
            {message.kind === "text" && message.text && (
              <MessageMarkdown
                text={message.text}
                components={markdownComponents}
              />
            )}
            {message.kind !== "text" && message.fileUrl && (
              <MessageMedia
                message={message}
                resolveFileUrl={resolveFileUrl}
              />
            )}
            {message.kind !== "text" && message.text && (
              <div className="mt-3">
                <MessageMarkdown
                  text={message.text}
                  components={markdownComponents}
                />
              </div>
            )}
            <div className="mt-3 flex items-center gap-3 text-[11px] text-white/60">
              <span>{formatTime(message.createdAt)}</span>
              {message.editedAt && <span>edited</span>}
            </div>
          </Fragment>
        )}

        {!isEditing && (
          <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              className="rounded-full bg-black/30 px-2 py-1 text-xs text-white/70 transition hover:bg-black/50"
              onClick={() =>
                setMenuOpenId(menuOpenId === message.id ? null : message.id)
              }
            >
              •••
            </button>
            {menuOpenId === message.id && (
              <div className="absolute right-0 top-7 flex min-w-[140px] flex-col gap-1 rounded-2xl border border-white/10 bg-[#10101c] p-2 text-xs text-white/70 shadow-lg">
                {mine && message.kind === "text" && (
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-left transition hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      onEdit(message);
                      setMenuOpenId(null);
                    }}
                  >
                    Edit
                  </button>
                )}
                {canHardDelete && message.kind !== "system" && (
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-left text-rose-200 transition hover:bg-rose-500/20 hover:text-white"
                    onClick={() => {
                      onHardDelete(message.id);
                      setMenuOpenId(null);
                    }}
                  >
                    Hard delete
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-left transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    onDelete(message.id);
                    setMenuOpenId(null);
                  }}
                >
                  Delete for me
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type MessageMarkdownProps = {
  text: string;
  components: Record<string, any>;
};

function MessageMarkdown({ text, components }: MessageMarkdownProps) {
  const transformed = useMemo(() => {
    let next = text;
    next = next.replace(
      /\|\|([\s\S]+?)\|\|/g,
      (_, content) => `<spoiler>${content}</spoiler>`,
    );
    return next;
  }, [text]);
  return (
    <ReactMarkdown
      className="prose prose-invert max-w-none text-sm"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {transformed}
    </ReactMarkdown>
  );
}

type MessageMediaProps = {
  message: Message;
  resolveFileUrl: (path: string) => Promise<string>;
};

function MessageMedia({ message, resolveFileUrl }: MessageMediaProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!message.fileUrl) return;
    resolveFileUrl(message.fileUrl)
      .then((signed) => {
        if (!active) return;
        setUrl(signed);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        if (!active) return;
        setError("Unable to load media");
      });
    return () => {
      active = false;
    };
  }, [message.fileUrl, resolveFileUrl]);

  if (error) {
    return (
      <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-rose-200">
        {error}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-white/60">
        Loading…
      </div>
    );
  }

  if (message.kind === "image") {
    return (
      <Image
        src={url}
        alt="uploaded"
        width={800}
        height={600}
        className="max-h-80 w-full rounded-2xl object-cover"
      />
    );
  }
  if (message.kind === "video") {
    return (
      <video
        src={url}
        controls
        className="max-h-80 w-full rounded-2xl"
        preload="metadata"
      />
    );
  }
  if (message.kind === "audio") {
    return <audio src={url} controls className="w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 hover:border-white/30 hover:text-white"
    >
      📎 {message.fileMime ?? "file"} · {message.fileBytes ? formatBytes(message.fileBytes) : "download"}
    </a>
  );
}

function buildSearchSnippet(message: Message) {
  if (message.highlight) return message.highlight;
  if (message.text) {
    return message.text.replace(/\s+/g, " ").trim().slice(0, 160);
  }
  return `[${message.kind.toUpperCase()}]`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function mapMessageRow(row: any): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    kind: row.kind,
    text: row.text,
    fileUrl: row.file_url,
    fileMime: row.file_mime,
    fileBytes: row.file_bytes,
    editedAt: row.edited_at,
    createdAt: row.created_at,
  };
}

function Spoiler(props: any) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      className={`cursor-pointer rounded bg-white/10 px-1 py-0.5 ${revealed ? "" : "blur-sm"}`}
      onClick={() => setRevealed(true)}
    >
      {props.children}
    </span>
  );
}

