"use client";
import { useState } from "react";

export default function LinkTelegram() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const onClick = async () => {
    try {
      setLoading(true);
      setCode(null);
      const res = await fetch("/api/link", {
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      if (data?.url) {
        // open the bot
        window.open(data.url, "_blank");
      }
      if (data?.code) {
        setCode(data.code);
      }
      if (!data?.url && !data?.code) {
        alert(
          "Could not prepare Telegram link. Please sign out/in and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white"
      >
        {loading ? "Preparing…" : "Link Telegram"}
      </button>
      {code && (
        <p className="text-sm text-neutral-300">
          If the bot didn’t reply, copy and send in Telegram:{" "}
          <code className="px-2 py-1 bg-black/40 rounded">{`/link ${code}`}</code>
        </p>
      )}
    </div>
  );
}
