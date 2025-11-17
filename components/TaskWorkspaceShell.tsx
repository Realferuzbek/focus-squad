"use client";

import { useMemo, useState } from "react";
import TaskSchedulerCalendar from "@/components/TaskSchedulerCalendar";

type Section = "home" | "private" | "settings";
type PrivateItemType = "page" | "database";
type SurfaceView = "planner" | "calendar";

type PrivateItem = {
  id: string;
  title: string;
  type: PrivateItemType;
};

const navItems: Array<{
  id: Section;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    id: "home",
    label: "Home",
    description: "Student control center",
    icon: "🏠",
  },
  {
    id: "private",
    label: "Private",
    description: "Your personal pages",
    icon: "🔒",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Preferences & theme",
    icon: "⚙️",
  },
];

const initialPrivateItems: PrivateItem[] = [
  { id: "study-journal", title: "Study Journal", type: "page" },
  { id: "habit-grid", title: "Habit Grid", type: "database" },
];

const typeBadgeCopy: Record<PrivateItemType, string> = {
  page: "Page",
  database: "Database",
};

const typeIcons: Record<PrivateItemType, string> = {
  page: "📄",
  database: "📊",
};

const surfaceTabs: Array<{
  id: SurfaceView;
  label: string;
  detail: string;
}> = [
  {
    id: "planner",
    label: "Planner",
    detail: "Workspace style layout",
  },
  {
    id: "calendar",
    label: "Calendar",
    detail: "Time blocking grid",
  },
];

export default function TaskWorkspaceShell() {
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [activeSurface, setActiveSurface] =
    useState<SurfaceView>("planner");
  const [privateItems, setPrivateItems] = useState(initialPrivateItems);
  const [activePrivateItemId, setActivePrivateItemId] = useState<string | null>(
    initialPrivateItems[0]?.id ?? null,
  );
  const [untitledCount, setUntitledCount] = useState(1);

  const activePrivateItem = useMemo(
    () => privateItems.find((item) => item.id === activePrivateItemId) ?? null,
    [privateItems, activePrivateItemId],
  );

  function createNewPrivateItem() {
    const newId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `private-${Date.now()}-${Math.round(Math.random() * 9999)}`;

    const newItem: PrivateItem = {
      id: newId,
      title: `Untitled page ${untitledCount}`,
      type: "page",
    };

    setPrivateItems((prev) => [...prev, newItem]);
    setActivePrivateItemId(newId);
    setUntitledCount((count) => count + 1);
  }

  function renderHomeView() {
    return (
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1d1d30] via-[#121223] to-[#090912] p-8 shadow-[0_25px_70px_rgba(8,8,16,0.55)]">
        <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200/70">
          Welcome back
        </p>
        <h2 className="mt-3 text-3xl font-semibold">Student Control Center</h2>
        <p className="mt-3 max-w-2xl text-base text-zinc-300">
          Plan your study sessions, group projects, and personal rituals in one
          calm space. This dashboard will soon power streak tracking, calendar
          sync, and deep work reminders.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Workspace Shell",
              detail: "Just launched",
            },
            {
              title: "Private Boards",
              detail: "Add placeholder pages",
            },
            {
              title: "Settings",
              detail: "Prep for themes & automations",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200"
            >
              <p className="text-xs uppercase tracking-[0.28em] text-white/70">
                {item.detail}
              </p>
              <p className="mt-2 text-lg font-medium">{item.title}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPrivateView() {
    return (
      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <section className="rounded-3xl border border-white/10 bg-[#0c0c16] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                Private
              </p>
              <h3 className="mt-1 text-xl font-semibold">Personal boards</h3>
              <p className="text-sm text-zinc-400">
                Keep uni, routines, and habits under wraps.
              </p>
            </div>
            <button
              onClick={createNewPrivateItem}
              className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              + Add new
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {privateItems.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                Nothing here yet. Start a page to blueprint your study routines.
              </p>
            ) : (
              privateItems.map((item) => {
                const active = activePrivateItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePrivateItemId(item.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#9b7bff] bg-[#1a1a2f]"
                        : "border-white/10 bg-transparent hover:border-white/30 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{typeIcons[item.type]}</span>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                          {typeBadgeCopy[item.type]}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">Open</span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0c0c16] p-6">
          {activePrivateItem ? (
            <>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
                  {typeIcons[activePrivateItem.type]}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                    Placeholder {typeBadgeCopy[activePrivateItem.type]}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold">
                    {activePrivateItem.title}
                  </h3>
                </div>
              </div>
              <p className="mt-6 text-base text-zinc-300">
                This space will host all properties, databases, and timelines
                you define for <strong>{activePrivateItem.title}</strong>. For
                now it is a simple placeholder page so we can wire navigation,
                permissions, and future task syncing.
              </p>
              <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-zinc-400">
                Imagine checklists, task boards, and habit charts living here in
                a few updates. Use the left sidebar to add as many placeholder
                entries as you want so your structure is ready.
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-zinc-400">
              <p className="text-lg font-medium">Select a private item</p>
              <p className="mt-2 text-sm">
                We’ll open a blank sheet so you can picture what’s coming.
              </p>
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderSettingsView() {
    const settings = [
      {
        title: "General preferences",
        detail: "Daily cadence, focus windows, and reminders (coming soon).",
      },
      {
        title: "Theme",
        detail: "Light, dark, and midnight gradients are on the roadmap.",
      },
      {
        title: "Task connections",
        detail: "Calendar sync + future automations will plug in here.",
      },
    ];

    return (
      <div className="rounded-3xl border border-white/10 bg-[#0c0c16] p-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">
            Settings
          </p>
          <h3 className="mt-1 text-2xl font-semibold">Customize soon</h3>
          <p className="text-sm text-zinc-400">
            Each card is a placeholder for future controls. No logic is wired
            yet—intentionally calm and minimal.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {settings.map((setting) => (
            <div
              key={setting.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                Placeholder
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {setting.title}
              </p>
              <p className="mt-2 text-sm text-zinc-400">{setting.detail}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderActiveSection() {
    if (activeSection === "home") return renderHomeView();
    if (activeSection === "private") return renderPrivateView();
    return renderSettingsView();
  }

  return (
    <div className="min-h-[100dvh] bg-[#05050b] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-10">
        <header className="rounded-[32px] border border-white/10 bg-gradient-to-r from-[#1f1f33] via-[#151524] to-[#0a0a14] p-6 shadow-[0_25px_70px_rgba(11,11,20,.55)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl">
                🎓
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.45em] text-fuchsia-200/80">
                  Workspace
                </p>
                <h1 className="mt-1 text-2xl font-semibold">
                  Study Workspace
                </h1>
                <p className="text-sm text-zinc-400">
                  Minimal shell for the Task Scheduler feature.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
              Built for calm focus. No calendar, tasks, or AI yet—just a home
              base to grow from.
            </div>
          </div>
        </header>

        <div className="mt-8">
          <div className="flex flex-wrap gap-3">
            {surfaceTabs.map((surface) => {
              const isActive = surface.id === activeSurface;
              return (
                <button
                  key={surface.id}
                  onClick={() => setActiveSurface(surface.id)}
                  className={`rounded-2xl border px-5 py-3 text-left transition ${
                    isActive
                      ? "border-[#9b7bff] bg-white/10 text-white"
                      : "border-white/10 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <p className="text-sm font-semibold">{surface.label}</p>
                  <p className="text-xs text-white/60">{surface.detail}</p>
                </button>
              );
            })}
          </div>

          {activeSurface === "planner" ? (
            <div className="mt-6 flex flex-1 flex-col gap-6 lg:flex-row">
              <nav className="w-full lg:w-64">
                <div className="rounded-3xl border border-white/10 bg-[#0c0c16] p-4">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                    Navigate
                  </p>
                  <div className="mt-4 space-y-2">
                    {navItems.map((item) => {
                      const active = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveSection(item.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                            active
                              ? "border-[#9b7bff] bg-[#171729]"
                              : "border-white/10 hover:border-white/30 hover:bg-white/5"
                          }`}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <div>
                            <p className="text-sm font-semibold">
                              {item.label}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </nav>

              <section className="flex-1">{renderActiveSection()}</section>
            </div>
          ) : (
            <div className="mt-6">
              <TaskSchedulerCalendar />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
