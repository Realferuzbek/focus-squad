
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TaskSchedulerCalendar from "@/components/TaskSchedulerCalendar";
import { csrfFetch } from "@/lib/csrf-client";
import {
  StudentTask,
  StudentTaskPriority,
  StudentTaskStatus,
  TaskCalendarEvent,
  TaskPrivateItem,
  TaskPrivateItemKind,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/taskSchedulerTypes";

type Section = "home" | "private" | "settings";
type SurfaceView = "planner" | "calendar";

type TaskDraft = {
  title: string;
  category: string;
  priority: StudentTaskPriority;
  dueDate: string;
  scheduledStart: string;
  scheduledEnd: string;
};

type TaskUpdatePayload = Partial<{
  title: string;
  category: string | null;
  status: StudentTaskStatus;
  priority: StudentTaskPriority;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}>;

type CalendarEventInput = {
  title: string;
  start: string;
  end: string;
  taskId: string | null;
  color?: string | null;
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

const kindMeta: Record<
  TaskPrivateItemKind,
  { label: string; icon: string }
> = {
  page: { label: "Page", icon: "📄" },
  task_list: { label: "Task list", icon: "🗂️" },
};

const statusLabels: Record<StudentTaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const priorityLabels: Record<StudentTaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function toDateInput(value: string | null) {
  if (!value) return "";
  try {
    return value.slice(0, 10);
  } catch {
    return "";
  }
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const iso = date.toISOString();
  return iso.slice(0, 16);
}

function fromDateTimeInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
export default function TaskWorkspaceShell() {
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [activeSurface, setActiveSurface] = useState<SurfaceView>("planner");
  const [privateItems, setPrivateItems] = useState<TaskPrivateItem[]>([]);
  const [privateLoading, setPrivateLoading] = useState(true);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [activePrivateItemId, setActivePrivateItemId] = useState<string | null>(
    null,
  );
  const [listTitleDraft, setListTitleDraft] = useState("");
  const [savingListTitle, setSavingListTitle] = useState(false);
  const [tasksByList, setTasksByList] = useState<Record<string, StudentTask[]>>(
    {},
  );
  const [tasksLoadingMap, setTasksLoadingMap] = useState<Record<string, boolean>>(
    {},
  );
  const [taskSavingIds, setTaskSavingIds] = useState<Set<string>>(new Set());
  const [allTasks, setAllTasks] = useState<StudentTask[]>([]);
  const [allTasksLoaded, setAllTasksLoaded] = useState(false);
  const [events, setEvents] = useState<TaskCalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [calendarFocusTaskId, setCalendarFocusTaskId] = useState<string | null>(
    null,
  );

  const activePrivateItem = useMemo(() => {
    if (!activePrivateItemId) return null;
    return privateItems.find((item) => item.id === activePrivateItemId) ?? null;
  }, [activePrivateItemId, privateItems]);

  const activeTasks = useMemo(() => {
    if (!activePrivateItemId) return [];
    return tasksByList[activePrivateItemId] ?? [];
  }, [activePrivateItemId, tasksByList]);

  const tasksLoading = activePrivateItemId
    ? !!tasksLoadingMap[activePrivateItemId]
    : false;

  useEffect(() => {
    loadPrivateItems();
  }, []);

  useEffect(() => {
    loadAllTasks();
    loadEvents();
  }, []);

  useEffect(() => {
    if (activePrivateItemId && !tasksByList[activePrivateItemId]) {
      loadTasksFor(activePrivateItemId);
    }
  }, [activePrivateItemId, tasksByList, loadTasksFor]);

  useEffect(() => {
    setListTitleDraft(activePrivateItem?.title ?? "");
  }, [activePrivateItem]);

  const syncAllTasks = useCallback((tasks: StudentTask[]) => {
    if (!tasks.length) return;
    setAllTasks((prev) => {
      const map = new Map(prev.map((task) => [task.id, task]));
      for (const task of tasks) {
        map.set(task.id, task);
      }
      return Array.from(map.values());
    });
  }, []);

  function upsertEventInState(event: TaskCalendarEvent) {
    setEvents((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      map.set(event.id, event);
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
    });
  }

  function removeEventById(eventId: string) {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  }

  function removeEventByTask(taskId: string) {
    setEvents((prev) => prev.filter((event) => event.taskId !== taskId));
  }

  function handleLinkedEvent(event: TaskCalendarEvent | null, taskId: string) {
    if (event) {
      upsertEventInState(event);
    } else {
      removeEventByTask(taskId);
    }
  }

  async function loadPrivateItems() {
    setPrivateLoading(true);
    setPrivateError(null);
    try {
      const res = await fetch("/api/task-scheduler/private-items");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load private items");
      }
      const data = await res.json();
      const items: TaskPrivateItem[] = data?.items ?? [];
      setPrivateItems(items);
      setActivePrivateItemId((prev) => prev ?? items[0]?.id ?? null);
    } catch (error) {
      setPrivateError(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setPrivateLoading(false);
    }
  }

  async function loadAllTasks() {
    try {
      const res = await fetch("/api/task-scheduler/tasks");
      if (!res.ok) {
        throw new Error("Failed to load tasks");
      }
      const data = await res.json();
      const tasks: StudentTask[] = data?.tasks ?? [];
      setAllTasks(tasks);
      setAllTasksLoaded(true);
    } catch {
      setAllTasksLoaded(true);
    }
  }

  async function loadEvents() {
    setEventsLoading(true);
    try {
      const res = await fetch("/api/task-scheduler/calendar-events");
      if (!res.ok) {
        throw new Error("Failed to load events");
      }
      const data = await res.json();
      setEvents(data?.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  const loadTasksFor = useCallback(async (privateItemId: string) => {
    setTasksLoadingMap((prev) => ({ ...prev, [privateItemId]: true }));
    try {
      const res = await fetch(
        `/api/task-scheduler/private-items/${privateItemId}/tasks`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load tasks");
      }
      const data = await res.json();
      const tasks: StudentTask[] = data.tasks ?? [];
      setTasksByList((prev) => ({ ...prev, [privateItemId]: tasks }));
      if (tasks.length) {
        syncAllTasks(tasks);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load tasks");
    } finally {
      setTasksLoadingMap((prev) => ({ ...prev, [privateItemId]: false }));
    }
  }, [syncAllTasks]);

  function upsertTaskInState(task: StudentTask) {
    setTasksByList((prev) => {
      const listTasks = prev[task.privateItemId] ?? [];
      const index = listTasks.findIndex((t) => t.id === task.id);
      const nextTasks =
        index === -1
          ? [...listTasks, task]
          : listTasks.map((t) => (t.id === task.id ? task : t));
      return { ...prev, [task.privateItemId]: nextTasks };
    });
    syncAllTasks([task]);
  }

  function toggleTaskSaving(taskId: string, saving: boolean) {
    setTaskSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  async function handleCreatePrivateItem() {
    try {
      const res = await csrfFetch("/api/task-scheduler/private-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Untitled list", kind: "task_list" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to create list");
      }
      const data = await res.json();
      const item: TaskPrivateItem = data.item;
      setPrivateItems((prev) => [...prev, item]);
      setActivePrivateItemId(item.id);
      setListTitleDraft(item.title);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create list");
    }
  }

  async function handleRenameList() {
    if (!activePrivateItemId) return;
    const trimmed = listTitleDraft.trim();
    if (!trimmed || trimmed === activePrivateItem?.title) return;
    setSavingListTitle(true);
    try {
      const res = await csrfFetch(
        `/api/task-scheduler/private-items/${activePrivateItemId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to rename list");
      }
      const data = await res.json();
      setPrivateItems((prev) =>
        prev.map((item) => (item.id === activePrivateItemId ? data.item : item)),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to rename list");
      setListTitleDraft(activePrivateItem?.title ?? "");
    } finally {
      setSavingListTitle(false);
    }
  }

  async function handleCreateTask(draft: TaskDraft) {
    if (!activePrivateItemId) return;
    const payload = {
      title: draft.title,
      category: draft.category || null,
      priority: draft.priority,
      dueDate: draft.dueDate || null,
      scheduledStart: fromDateTimeInput(draft.scheduledStart),
      scheduledEnd: fromDateTimeInput(draft.scheduledEnd),
    };
    const res = await csrfFetch(
      `/api/task-scheduler/private-items/${activePrivateItemId}/tasks`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to create task");
    }
    const data = await res.json();
    upsertTaskInState(data.task as StudentTask);
    handleLinkedEvent(data.linkedEvent ?? null, data.task.id);
  }

  async function handleUpdateTask(taskId: string, updates: TaskUpdatePayload) {
    toggleTaskSaving(taskId, true);
    try {
      const payload = { ...updates } as Record<string, unknown>;
      if (updates.scheduledStart !== undefined) {
        payload.scheduledStart = updates.scheduledStart;
      }
      if (updates.scheduledEnd !== undefined) {
        payload.scheduledEnd = updates.scheduledEnd;
      }
      const res = await csrfFetch(`/api/task-scheduler/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to update task");
      }
      const data = await res.json();
      upsertTaskInState(data.task as StudentTask);
      handleLinkedEvent(data.linkedEvent ?? null, data.task.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      toggleTaskSaving(taskId, false);
    }
  }

  async function handleCreateEvent(input: CalendarEventInput) {
    const res = await csrfFetch("/api/task-scheduler/calendar-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to create event");
    }
    const data = await res.json();
    if (data.event) {
      upsertEventInState(data.event as TaskCalendarEvent);
    }
    if (data.task) {
      upsertTaskInState(data.task as StudentTask);
    }
  }

  async function handleUpdateEvent(eventId: string, input: CalendarEventInput) {
    const res = await csrfFetch(
      `/api/task-scheduler/calendar-events/${eventId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to update event");
    }
    const data = await res.json();
    if (data.event) {
      upsertEventInState(data.event as TaskCalendarEvent);
    }
    if (data.task) {
      upsertTaskInState(data.task as StudentTask);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    const res = await csrfFetch(
      `/api/task-scheduler/calendar-events/${eventId}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to delete event");
    }
    const data = await res.json();
    removeEventById(data?.deletedEventId ?? eventId);
    if (data.task) {
      upsertTaskInState(data.task as StudentTask);
    }
  }

  function handleScheduleJump(task: StudentTask) {
    setCalendarFocusTaskId(task.id);
    setActiveSurface("calendar");
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
              onClick={handleCreatePrivateItem}
              className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              + Add new
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {privateLoading ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                Loading your lists…
              </p>
            ) : privateError ? (
              <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {privateError}
              </p>
            ) : privateItems.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                Nothing here yet. Start a list to blueprint your study rituals.
              </p>
            ) : (
              privateItems.map((item) => {
                const active = activePrivateItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePrivateItemId(item.id)}
                    className={classNames(
                      "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                      active
                        ? "border-[#9b7bff] bg-[#1a1a2f]"
                        : "border-white/10 bg-transparent hover:border-white/30 hover:bg-white/5",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{kindMeta[item.kind].icon}</span>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                          {kindMeta[item.kind].label}
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
                    {kindMeta[activePrivateItem.kind].icon}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                      {kindMeta[activePrivateItem.kind].label}
                    </p>
                    <input
                      value={listTitleDraft}
                      onChange={(event) => setListTitleDraft(event.target.value)}
                      onBlur={handleRenameList}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      disabled={savingListTitle}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-semibold text-white outline-none focus:border-white/40"
                    />
                  </div>
                </div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/40">
                  {activeTasks.length} tasks
                </div>
              </div>

              {activePrivateItem.kind === "task_list" ? (
                <div className="mt-6">
                  <TaskListPane
                    tasks={activeTasks}
                    loading={tasksLoading}
                    onCreateTask={handleCreateTask}
                    onUpdateTask={handleUpdateTask}
                    onScheduleTask={handleScheduleJump}
                    savingTaskIds={taskSavingIds}
                  />
                </div>
              ) : (
                <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-zinc-400">
                  Imagine checklists, task boards, and habit charts living here
                  in a few updates. Use the left sidebar to add as many
                  placeholder entries as you want so your structure is ready.
                </div>
              )}
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
                  className={classNames(
                    "rounded-2xl border px-5 py-3 text-left transition",
                    isActive
                      ? "border-[#9b7bff] bg-white/10 text-white"
                      : "border-white/10 text-white/70 hover:border-white/30 hover:text-white",
                  )}
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
                          className={classNames(
                            "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                            active
                              ? "border-[#9b7bff] bg-[#171729]"
                              : "border-white/10 hover:border-white/30 hover:bg-white/5",
                          )}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <div>
                            <p className="text-sm font-semibold">{item.label}</p>
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
              <TaskSchedulerCalendar
                events={events}
                tasks={allTasks}
                loading={eventsLoading || !allTasksLoaded}
                onCreateEvent={handleCreateEvent}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                focusTaskId={calendarFocusTaskId}
                onRequestFocusClear={() => setCalendarFocusTaskId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
type TaskListPaneProps = {
  tasks: StudentTask[];
  loading: boolean;
  onCreateTask: (draft: TaskDraft) => Promise<void>;
  onUpdateTask: (taskId: string, updates: TaskUpdatePayload) => Promise<void>;
  onScheduleTask: (task: StudentTask) => void;
  savingTaskIds: Set<string>;
};

function TaskListPane({
  tasks,
  loading,
  onCreateTask,
  onUpdateTask,
  onScheduleTask,
  savingTaskIds,
}: TaskListPaneProps) {
  const [draft, setDraft] = useState<TaskDraft>({
    title: "",
    category: "",
    priority: "medium",
    dueDate: "",
    scheduledStart: "",
    scheduledEnd: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    if (!draft.title.trim()) {
      setCreateError("Title is required");
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      await onCreateTask(draft);
      setDraft({
        title: "",
        category: "",
        priority: "medium",
        dueDate: "",
        scheduledStart: "",
        scheduledEnd: "",
      });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to add");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Student tasks</h4>
        {loading && (
          <span className="text-xs uppercase tracking-[0.3em] text-white/40">
            Loading…
          </span>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[780px] space-y-2">
          <div className="grid grid-cols-[120px,1.5fr,1fr,120px,140px,160px,160px,64px] gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/50">
            <span>Status</span>
            <span>Title</span>
            <span>Category</span>
            <span>Priority</span>
            <span>Due date</span>
            <span>Start</span>
            <span>End</span>
            <span className="text-center">Plan</span>
          </div>

          {tasks.length === 0 && !loading ? (
            <p className="rounded-xl border border-dashed border-white/15 bg-transparent px-4 py-6 text-sm text-zinc-400">
              No tasks yet. Add your first study mission below.
            </p>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onUpdate={onUpdateTask}
                onScheduleTask={onScheduleTask}
                saving={savingTaskIds.has(task.id)}
              />
            ))
          )}

          <div className="grid grid-cols-[120px,1.5fr,1fr,120px,140px,160px,160px,64px] gap-3 rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-3 text-sm text-white/80">
            <span className="text-xs uppercase tracking-[0.3em] text-white/40">
              New
            </span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="Write essay outline"
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
            />
            <input
              value={draft.category}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, category: event.target.value }))
              }
              placeholder="uni"
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
            />
            <select
              value={draft.priority}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  priority: event.target.value as StudentTaskPriority,
                }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, dueDate: event.target.value }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
            />
            <input
              type="datetime-local"
              value={draft.scheduledStart}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  scheduledStart: event.target.value,
                }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
            />
            <input
              type="datetime-local"
              value={draft.scheduledEnd}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  scheduledEnd: event.target.value,
                }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-[#8a5bff] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {createError && (
            <p className="text-xs text-rose-300">{createError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

type TaskRowProps = {
  task: StudentTask;
  saving: boolean;
  onUpdate: (taskId: string, updates: TaskUpdatePayload) => Promise<void>;
  onScheduleTask: (task: StudentTask) => void;
};

function TaskRow({ task, saving, onUpdate, onScheduleTask }: TaskRowProps) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category ?? "");
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [start, setStart] = useState(toDateTimeInput(task.scheduledStart));
  const [end, setEnd] = useState(toDateTimeInput(task.scheduledEnd));

  useEffect(() => {
    setTitle(task.title);
    setCategory(task.category ?? "");
    setDueDate(toDateInput(task.dueDate));
    setStart(toDateTimeInput(task.scheduledStart));
    setEnd(toDateTimeInput(task.scheduledEnd));
  }, [task]);

  async function commitTitle() {
    if (title.trim() && title.trim() !== task.title) {
      await onUpdate(task.id, { title: title.trim() });
    } else {
      setTitle(task.title);
    }
  }

  async function commitCategory() {
    if ((category || null) !== (task.category ?? "")) {
      await onUpdate(task.id, { category: category || null });
    }
  }

  async function commitDueDate() {
    const normalized = dueDate || null;
    if (normalized !== (task.dueDate ?? null)) {
      await onUpdate(task.id, { dueDate: normalized });
    }
  }

  async function commitScheduleChange(nextStart: string, nextEnd: string) {
    const startIso = nextStart ? fromDateTimeInput(nextStart) : null;
    const endIso = nextEnd ? fromDateTimeInput(nextEnd) : null;
    await onUpdate(task.id, {
      scheduledStart: startIso,
      scheduledEnd: endIso,
    });
  }

  const rowMuted = task.status === "done";

  return (
    <div
      className={classNames(
        "grid grid-cols-[120px,1.5fr,1fr,120px,140px,160px,160px,64px] gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm",
        rowMuted && "opacity-60",
      )}
    >
      <select
        value={task.status}
        disabled={saving}
        onChange={(event) =>
          onUpdate(task.id, {
            status: event.target.value as StudentTaskStatus,
          })
        }
        className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs uppercase tracking-[0.2em] text-white outline-none focus:border-white/40"
      >
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </select>
      <input
        value={title}
        disabled={saving}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
      />
      <input
        value={category}
        disabled={saving}
        onChange={(event) => setCategory(event.target.value)}
        onBlur={commitCategory}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
      />
      <select
        value={task.priority}
        disabled={saving}
        onChange={(event) =>
          onUpdate(task.id, {
            priority: event.target.value as StudentTaskPriority,
          })
        }
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
      >
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priorityLabels[priority]}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        disabled={saving}
        onChange={(event) => setDueDate(event.target.value)}
        onBlur={commitDueDate}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
      />
      <input
        type="datetime-local"
        value={start}
        disabled={saving}
        onChange={(event) => setStart(event.target.value)}
        onBlur={() => {
          if (!start) {
            setEnd("");
          }
          commitScheduleChange(start, end);
        }}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
      />
      <input
        type="datetime-local"
        value={end}
        disabled={saving}
        onChange={(event) => setEnd(event.target.value)}
        onBlur={() => commitScheduleChange(start, end)}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
      />
      <button
        type="button"
        onClick={() => onScheduleTask(task)}
        className="rounded-full border border-white/20 bg-white/10 text-lg text-white/80 transition hover:bg-white/20"
      >
        🗓️
      </button>
    </div>
  );
}
