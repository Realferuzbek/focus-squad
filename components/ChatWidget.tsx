"use client";

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlarmClock,
  AlertTriangle,
  HelpCircle,
  Plus,
  Send,
  Settings,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrf-client";

type MessageRole = "user" | "assistant";

type Message = {
  role: MessageRole;
  text: string;
  timestamp: number;
  sources?: string[];
};

type AiStatus = "loading" | "online" | "disabled" | "error";

const suggestionPrompts = [
  {
    label: "Deep work sprint",
    value: "Give me a 2 hour deep-work plan.",
    Icon: AlarmClock,
  },
  {
    label: "Leaderboard pulse",
    value: "Summarize the latest leaderboard insights.",
    Icon: Trophy,
  },
  {
    label: "Focus accountability",
    value: "How can I stay accountable this week?",
    Icon: Target,
  },
  {
    label: "Mindset boost",
    value: "Share a mindset quote for today.",
    Icon: Sparkles,
  },
] as const;

const statusTokens: Record<
  AiStatus,
  { text: string; dot: string; pillBg: string; pillText: string }
> = {
  loading: {
    text: "Checking status…",
    dot: "bg-white/50",
    pillBg: "bg-white/5",
    pillText: "text-white/70",
  },
  online: {
    text: "Live",
    dot: "bg-[#22c55e]",
    pillBg: "bg-emerald-500/10",
    pillText: "text-emerald-200",
  },
  disabled: {
    text: "Disabled by admins",
    dot: "bg-[#fbbf24]",
    pillBg: "bg-amber-500/10",
    pillText: "text-amber-200",
  },
  error: {
    text: "Status unavailable",
    dot: "bg-rose-400",
    pillBg: "bg-rose-500/10",
    pillText: "text-rose-200",
  },
};

const launcherTokens: Record<AiStatus, { dot: string; showAlert?: boolean }> =
  {
    loading: { dot: "bg-white/50" },
    online: { dot: "bg-[#22c55e]" },
    disabled: { dot: "bg-[#fbbf24]", showAlert: true },
    error: { dot: "bg-rose-400", showAlert: true },
  };

function formatTimestamp(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus>("loading");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/status", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to load status.");
      }

      const enabled = Boolean(body?.enabled);
      setAiStatus(enabled ? "online" : "disabled");
      setStatusError(null);
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : "Unable to load assistant status.",
      );
      setAiStatus((prev) => (prev === "disabled" ? prev : "error"));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = window.setInterval(refreshStatus, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshStatus]);

  const handleSuggestion = useCallback((value: string) => {
    setInput(value);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      inputRef.current?.focus();
    }
  }, []);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || sending || aiStatus === "disabled") {
      return;
    }

    setInput("");
    setStatusError(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: question, timestamp: Date.now() },
    ]);
    setSending(true);

    try {
      const res = await csrfFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : "Unable to reach the assistant right now.";

        if (res.status === 503) {
          setAiStatus("disabled");
          setStatusError(message);
          return;
        }

        throw new Error(message);
      }

      setAiStatus("online");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            data?.answer ||
            "I’m not sure how to answer that just yet, but I’m learning.",
          sources: Array.isArray(data?.sources) ? data.sources : [],
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [aiStatus, input, sending]);

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const composerDisabled = sending || aiStatus === "disabled";
  const composerPlaceholder =
    aiStatus === "disabled" ? "AI is disabled right now." : "Ask about this site...";
  const statusLabel = statusError || statusTokens[aiStatus].text;
  const visibleSuggestions = showAllSuggestions
    ? suggestionPrompts
    : suggestionPrompts.slice(0, 3);

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="ask-ai-launcher relative flex h-11 w-[min(160px,40vw)] items-center gap-3 rounded-full px-4 text-left text-white focus:outline-none"
      >
        <div className="relative">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.35),rgba(255,255,255,0.05))] text-white shadow-[0_0_22px_rgba(124,58,237,0.55)]">
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent)] blur-lg"
            />
            <Sparkles className="ai-spark relative z-10 h-4 w-4" />
          </div>
          <span
            className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#050712] ${launcherTokens[aiStatus].dot} shadow-[0_0_12px_rgba(34,211,238,0.55)]`}
          >
            {launcherTokens[aiStatus].showAlert && (
              <span className="text-[10px] font-semibold text-[#050712]">!</span>
            )}
          </span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium">Ask AI</span>
          <span className="text-[11px] text-white/70">Always-on focus</span>
        </div>
      </button>

      {open && (
        <div className="w-[min(500px,calc(100vw-2.5rem))] animate-[ai-panel-in_0.2s_ease-out]">
          <div className="rounded-[24px] border border-white/10 bg-[rgba(5,7,18,0.9)] shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
            <div
              className="flex h-[620px] min-h-[520px] flex-col rounded-[22px] border border-white/5 bg-[rgba(5,7,18,0.88)]"
              style={{ maxHeight: "calc(100vh - 3rem)" }}
            >
              <header className="flex items-center gap-4 px-6 py-5">
                <div className="relative flex items-center gap-4">
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-0 -z-10 -m-[3px] rounded-full ${
                        aiStatus === "disabled"
                          ? "border-2 border-white/10"
                          : "bg-[conic-gradient(from_140deg_at_50%_50%,#7c3aed,#22d3ee)] blur-[0.5px]"
                      } opacity-80`}
                    />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] via-[#4c1d95] to-[#22d3ee] text-white shadow-[0_12px_35px_rgba(124,58,237,0.45)]">
                      <Sparkles className="ai-spark h-6 w-6" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-white">
                      studywithferuzbek AI
                    </span>
                    <span className="text-sm text-white/70">
                      Always-on focus companion
                    </span>
                    <span
                      className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.05em] ${statusTokens[aiStatus].pillBg} ${statusTokens[aiStatus].pillText}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusTokens[aiStatus].dot}`} />
                      {statusLabel}
                    </span>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <span className="rounded-full border border-emerald-300/30 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200">
                    Beta
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAllSuggestions(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:border-white/30 hover:text-white"
                      aria-label="What can this AI do?"
                      title="What can this AI do?"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusError((previous) => previous)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-white/30 hover:text-white"
                      aria-label="Assistant settings"
                      title="Assistant settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:border-rose-400 hover:text-rose-200"
                      aria-label="Close assistant"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </header>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-70" />

              <div
                ref={listRef}
                data-ai-scroll
                className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm text-white/90"
              >
                {messages.length === 0 && !sending && (
                  <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-white/80">
                    <p className="text-base font-semibold text-white">
                      Get started in 1 tap
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {visibleSuggestions.map(({ label, value, Icon }, index) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleSuggestion(value)}
                          style={{ animationDelay: `${index * 40}ms` }}
                          className="ai-chip flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-white/80 transition-all hover:-translate-y-0.5 hover:border-transparent hover:bg-[linear-gradient(135deg,rgba(124,58,237,0.18),rgba(34,211,238,0.18))]"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                    {suggestionPrompts.length > 3 && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAllSuggestions((previous) => !previous)
                        }
                        className="mt-3 text-sm font-medium text-sky-300 underline-offset-4 hover:underline"
                      >
                        {showAllSuggestions ? "Hide ideas" : "More ideas"}
                      </button>
                    )}
                  </div>
                )}

                {aiStatus === "disabled" && (
                  <div className="ai-system-banner mx-auto flex w-full max-w-[360px] items-start gap-3 rounded-2xl border border-amber-400/30 bg-[rgba(251,191,36,0.08)] px-4 py-3 text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-amber-200">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        AI is currently disabled
                      </p>
                      <p className="text-xs text-white/70">
                        Admins turned this off. You can still browse the site
                        normally.
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((message, index) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={`chat-message-${message.timestamp}-${index}`}
                      className={`flex flex-col gap-2 ${
                        isUser ? "items-end text-right" : "items-start text-left"
                      }`}
                    >
                      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-white/60">
                        {isUser ? "You" : "Assistant"}
                      </span>
                      <div
                        className={`rounded-[18px] px-4 py-3 text-sm leading-relaxed shadow-[0_10px_30px_rgba(5,5,15,0.45)] ${
                          isUser
                            ? "max-w-[85%] bg-[linear-gradient(135deg,#7C3AED,#22D3EE)] text-white shadow-[0_18px_35px_rgba(34,211,238,0.35)]"
                            : "max-w-[90%] border border-white/10 bg-white/5 text-white/90"
                        } ${
                          isUser
                            ? "rounded-tr-[12px]"
                            : "rounded-tl-[12px]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.text}</p>
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                            {message.sources.map((source, sourceIndex) => (
                              <a
                                key={`${source}-${sourceIndex}`}
                                href={source}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-white/10 px-3 py-1 text-white/80 underline-offset-2 hover:text-sky-300 hover:underline"
                              >
                                Source {sourceIndex + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-white/60">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-center gap-3 text-[12px] text-white/75">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white">
                      <Sparkles className="ai-spark h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="flex items-center text-[12px] font-medium">
                        Typing…
                        <span className="ai-typing-dots">
                          <span />
                          <span />
                          <span />
                        </span>
                      </span>
                      <div className="ai-thinking-bar" />
                    </div>
                  </div>
                )}
              </div>

              <footer className="px-6 pb-5 pt-3">
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70"
                    aria-label="Quick actions"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={composerPlaceholder}
                    rows={1}
                    disabled={composerDisabled}
                    className="chat-input flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!input.trim() || composerDisabled}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7C3AED,#22D3EE)] text-white shadow-[0_18px_35px_rgba(34,211,238,0.35)] transition hover:scale-105 disabled:opacity-40 disabled:shadow-none"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4 -rotate-[30deg]" />
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-white/50">
                  AI replies may be imperfect—verify before acting.
                </p>
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWidget;
