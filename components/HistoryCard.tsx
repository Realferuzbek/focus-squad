"use client";
import { useEffect, useState } from "react";

export default function HistoryCard() {
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/tasks?date=${date}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => {});
  }, [date]);
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <h2 className="font-bold mb-2">History</h2>
      <input
        aria-label="Pick date"
        type="date"
        className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring text-sm"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between border border-neutral-800 rounded-xl p-2"
          >
            <span>{t.content}</span>
            <span
              className={`text-xs px-2 py-1 rounded-full ${t.status === "completed" ? "bg-green-600/20 border border-green-700" : t.status === "not_done" ? "bg-red-600/20 border border-red-700" : "bg-neutral-800 border border-neutral-700"}`}
            >
              {t.status ?? "Pending"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
