// components/TaskPlannerSheet.tsx
"use client";

import { useEffect, useState } from "react";

export default function TaskPlannerSheet() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);

  async function refresh() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTodayTasks(data.tasks || []);
    setLocked(!!data.locked);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!text.trim()) return;
    setLoading(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: text.split("\n").map((s) => s.trim()).filter(Boolean) }),
    });
    setLoading(false);
    if (res.ok) {
      setText("");
      await refresh();
      setOpen(false);
    } else {
      const { error } = await res.json();
      alert(error || "Failed to save");
    }
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setOpen(true)}
          className="rounded-2xl p-4 bg-gradient-to-br from-[#23233b] to-[#15151f] text-white shadow-[0_10px_50px_rgba(120,80,255,.25)]">
          <div className="text-left">
            <div className="text-sm text-zinc-400">Task planner</div>
            <div className="text-lg font-semibold">Today</div>
            <div className="text-xs mt-2 text-zinc-500">{locked ? "🔒 Locked after 10:00" : "✍️ Add your plan"}</div>
          </div>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#101018] text-white p-6 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Plan your day</h2>
              <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">✕</button>
            </div>

            <p className="text-sm text-zinc-400 mb-3">
              Write each task on a new line. You won’t be able to add new tasks after 10:00 (Tashkent time).
            </p>

            <textarea
              className="w-full h-40 rounded-xl bg-black/40 border border-white/10 p-3 outline-none"
              placeholder="Study Algorithms\nFinish essay\n45 min English speaking"
              disabled={locked}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-zinc-500">Today’s tasks: {todayTasks.length}</div>
              <button
                disabled={locked || loading}
                onClick={save}
                className="rounded-xl px-5 py-2 bg-gradient-to-r from-[#8a5bff] via-[#b157ff] to-[#ff5ddd] font-semibold disabled:opacity-50">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
