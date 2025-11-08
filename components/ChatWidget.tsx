"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import { csrfFetch } from "@/lib/csrf-client";

type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
};

const quickPrompts = [
  "Give me a 2 hour deep-work plan.",
  "Summarize the latest leaderboard insights.",
  "Share a mindset quote for today.",
  "How can I stay accountable this week?",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

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
        throw new Error(message);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data?.answer || "I’m not sure how to answer that.",
          sources: Array.isArray(data?.sources) ? data.sources : [],
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
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center gap-2 rounded-full bg-gradient-to-r from-[#a855f7] via-[#6366f1] to-[#0ea5e9] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.45)] transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        <Sparkles className="h-4 w-4" />
        {open ? "Close AI" : "Ask AI"}
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
      </button>

      {open && (
        <div className="w-[min(420px,calc(100vw-2.5rem))]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#4c1d95] via-[#2d1b4b] to-[#041124] p-[1px] shadow-[0_25px_70px_rgba(15,10,40,0.65)]">
            <div className="flex h-[520px] flex-col rounded-[26px] border border-white/5 bg-[#05060c]/95 backdrop-blur-2xl">
              <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4 text-white">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a855f7] via-[#7c3aed] to-[#0ea5e9] shadow-[0_10px_35px_rgba(168,85,247,0.35)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-wide">
                    studywithferuzbek AI
                  </span>
                  <span className="text-xs text-white/60">
                    Always-on focus companion
                  </span>
                </div>
                <span className="ml-auto rounded-full border border-white/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.25em] text-emerald-300">
                  Beta
                </span>
              </div>

              <div
                ref={listRef}
                className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm text-white/90"
              >
                {messages.length === 0 && !loading && (
                  <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-white/70">
                    <p className="text-sm font-medium text-white">
                      Try one of these to get started:
                    </p>
                    <div className="mt-3 grid gap-2">
                      {quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setInput(prompt)}
                          className="rounded-2xl border border-white/5 bg-transparent px-4 py-2 text-left text-xs text-white/80 transition hover:border-white/30 hover:bg-white/5"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={`chat-message-${index}`}
                    className="flex flex-col gap-2"
                  >
                    <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                      {message.role === "user" ? "You" : "Assistant"}
                    </span>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "ml-auto max-w-[85%] bg-gradient-to-r from-[#a855f7] via-[#6366f1] to-[#0ea5e9] text-white shadow-[0_15px_35px_rgba(76,29,149,0.45)]"
                          : "mr-auto max-w-[90%] border border-white/5 bg-white/5 text-white/90"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      {message.sources && message.sources.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs">
                          {message.sources.map((source, idx) => (
                            <li key={`${source}-${idx}`}>
                              <a
                                href={source}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-300 underline decoration-dotted underline-offset-2"
                              >
                                {source}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                    Thinking
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 p-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && send()}
                    placeholder="Ask about this site..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={loading}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-[#a855f7] via-[#6366f1] to-[#0ea5e9] text-white shadow-[0_15px_30px_rgba(99,102,241,0.35)] transition hover:scale-[1.02] disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-white/40">
                  AI replies may be imperfect—verify before acting.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWidget;
