"use client";

import { useCallback, useState } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      });
      if (!res.ok) throw new Error("Failed to ask AI");
      const data = await res.json();
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
          text: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 999,
      }}
    >
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="bg-black text-white rounded-full px-4 py-2 shadow-lg"
      >
        {open ? "Close" : "Ask AI"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 80,
            width: 380,
            maxHeight: 540,
            display: "flex",
            flexDirection: "column",
            background: "white",
            borderRadius: 16,
            boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
            overflow: "hidden",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: 12,
              fontWeight: 600,
              borderBottom: "1px solid #eee",
            }}
          >
            study_with_feruzbek — AI
          </div>
          <div
            style={{
              padding: 12,
              gap: 8,
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {messages.map((m, i) => (
              <div key={i} style={{ whiteSpace: "pre-wrap" }}>
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {m.role === "user" ? "You" : "Assistant"}
                </div>
                <div>{m.text}</div>
                {m.sources && m.sources.length > 0 && (
                  <ul style={{ marginTop: 6 }}>
                    {m.sources.map((s, j) => (
                      <li key={j}>
                        <a
                          href={s}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-blue-600"
                        >
                          {s}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {loading && <div>Thinking…</div>}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: 12,
              borderTop: "1px solid #eee",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about this site…"
              className="flex-1 border rounded px-3 py-2"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading}
              className="bg-black text-white rounded px-3 py-2 disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWidget;
