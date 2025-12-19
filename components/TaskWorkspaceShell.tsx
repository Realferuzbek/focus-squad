
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TaskSchedulerCalendar from "@/components/TaskSchedulerCalendar";
import { Calendar as CalendarIcon, List as ListIcon } from "lucide-react";
import { csrfFetch } from "@/lib/csrf-client";
import {
  StudentHabitRepeatRule,
  StudentTask,
  StudentTaskCategory,
  StudentTaskPriority,
  StudentTaskStatus,
  TaskCalendar,
  TaskCalendarEvent,
  TaskPrivateItem,
  TaskPrivateItemKind,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_REPEAT_RULES,
  TASK_STATUSES,
} from "@/lib/taskSchedulerTypes";
import { generateHabitInstances } from "@/lib/taskSchedulerHabits";

type Section = "home" | "private" | "settings";
type SurfaceView = "planner" | "calendar";
type TaskViewFilter =
  | "all"
  | "assignments"
  | "exams"
  | "projects"
  | "habits"
  | "today"
  | "week";

type TaskDraft = {
  title: string;
};

type TaskUpdatePayload = Partial<{
  title: string;
  category: StudentTaskCategory;
  status: StudentTaskStatus;
  priority: StudentTaskPriority;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  repeatRule: StudentHabitRepeatRule;
  repeatDays: number[] | null;
  repeatUntil: string | null;
}>;

type AutoPlanConfig = {
  blockLength: number;
  maxMinutesPerDay: number;
  startDate: string;
  allowedDays: number[];
  replaceExisting: boolean;
};

type CalendarEventInput = {
  title: string;
  start: string;
  end: string;
  taskId: string | null;
  calendarId?: string | null;
  description?: string | null;
  color?: string | null;
};

type CalendarCreatePayload = {
  name: string;
  color: string;
};

type CalendarPatchPayload = Partial<
  Pick<TaskCalendar, "name" | "color" | "isDefault" | "isVisible" | "sortOrder">
>;

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

const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function getStartOfWeek(date: Date) {
  const next = new Date(date);
  const day = (next.getDay() + 6) % 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - day);
  return next;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function intersectsDayRange(
  startISO: string | null,
  endISO: string | null,
  day: Date,
) {
  if (!startISO || !endISO) return false;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

function intersectsRange(
  startISO: string | null,
  endISO: string | null,
  rangeStart: Date,
  rangeEnd: Date,
) {
  if (!startISO || !endISO) return false;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= rangeEnd && end >= rangeStart;
}

function buildTaskEventDateMap(events: TaskCalendarEvent[]) {
  const map = new Map<string, Set<string>>();
  events.forEach((event) => {
    if (!event.taskId) return;
    const dateKey = event.start.slice(0, 10);
    if (!map.has(event.taskId)) {
      map.set(event.taskId, new Set());
    }
    map.get(event.taskId)!.add(dateKey);
  });
  return map;
}

function getDefaultCalendarId(calendars: TaskCalendar[]) {
  return (
    calendars.find((calendar) => calendar.isDefault)?.id ??
    calendars[0]?.id ??
    null
  );
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
  const [calendars, setCalendars] = useState<TaskCalendar[]>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(true);
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);
  const [calendarFocusTaskId, setCalendarFocusTaskId] = useState<string | null>(
    null,
  );
  const [taskView, setTaskView] = useState<TaskViewFilter>("all");
  const [repeatEditorTask, setRepeatEditorTask] = useState<StudentTask | null>(
    null,
  );
  const [autoPlanTarget, setAutoPlanTarget] = useState<StudentTask | null>(null);

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

  const loadTasksFor = useCallback(
    async (privateItemId: string) => {
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
    },
    [syncAllTasks],
  );

  useEffect(() => {
    loadPrivateItems();
  }, []);

  useEffect(() => {
    loadAllTasks();
    loadEvents();
    loadCalendars();
  }, []);

  useEffect(() => {
    if (activePrivateItemId && !tasksByList[activePrivateItemId]) {
      loadTasksFor(activePrivateItemId);
    }
  }, [activePrivateItemId, tasksByList, loadTasksFor]);

  useEffect(() => {
    if (calendars.length === 0) {
      if (activeCalendarId !== null) {
        setActiveCalendarId(null);
      }
      return;
    }
    const hasActive =
      activeCalendarId &&
      calendars.some((calendar) => calendar.id === activeCalendarId);
    if (!hasActive) {
      setActiveCalendarId(getDefaultCalendarId(calendars));
    }
  }, [activeCalendarId, calendars]);

  const taskEventDates = useMemo(
    () => buildTaskEventDateMap(events),
    [events],
  );

  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const weekStart = useMemo(() => getStartOfWeek(today), [today]);
  const weekEnd = useMemo(() => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 6);
    return next;
  }, [weekStart]);
  const weekDateKeys = useMemo(() => {
    return Array.from({ length: 7 }, (_value, index) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + index);
      return toDateKey(day);
    });
  }, [weekStart]);

  const activeHabitInstancesToday = useMemo(
    () =>
      generateHabitInstances(activeTasks, {
        startDate: today,
        endDate: today,
      }),
    [activeTasks, today],
  );
  const activeHabitInstancesWeek = useMemo(
    () =>
      generateHabitInstances(activeTasks, {
        startDate: weekStart,
        endDate: weekEnd,
      }),
    [activeTasks, weekStart, weekEnd],
  );

  const habitTodayTaskIds = useMemo(
    () => new Set(activeHabitInstancesToday.map((instance) => instance.taskId)),
    [activeHabitInstancesToday],
  );
  const habitWeekTaskIds = useMemo(
    () => new Set(activeHabitInstancesWeek.map((instance) => instance.taskId)),
    [activeHabitInstancesWeek],
  );

  const tasksWithEventsToday = useMemo(() => {
    const set = new Set<string>();
    taskEventDates.forEach((dates, taskId) => {
      if (dates.has(todayKey)) {
        set.add(taskId);
      }
    });
    return set;
  }, [taskEventDates, todayKey]);

  const tasksWithEventsWeek = useMemo(() => {
    const set = new Set<string>();
    taskEventDates.forEach((dates, taskId) => {
      for (const key of weekDateKeys) {
        if (dates.has(key)) {
          set.add(taskId);
          break;
        }
      }
    });
    return set;
  }, [taskEventDates, weekDateKeys]);

  const weekDateKeySet = useMemo(
    () => new Set(weekDateKeys),
    [weekDateKeys],
  );

  const filteredTasks = useMemo(() => {
    return activeTasks.filter((task) => {
      switch (taskView) {
        case "assignments":
          return task.category === "assignment";
        case "exams":
          return task.category === "exam";
        case "projects":
          return task.category === "project";
        case "habits":
          return task.category === "habit";
        case "today": {
          const dueToday = task.dueDate === todayKey;
          const scheduledToday = intersectsDayRange(
            task.scheduledStart,
            task.scheduledEnd,
            today,
          );
          return (
            dueToday ||
            scheduledToday ||
            tasksWithEventsToday.has(task.id) ||
            habitTodayTaskIds.has(task.id)
          );
        }
        case "week": {
          const dueThisWeek = task.dueDate
            ? weekDateKeySet.has(task.dueDate)
            : false;
          const scheduledThisWeek = intersectsRange(
            task.scheduledStart,
            task.scheduledEnd,
            weekStart,
            weekEnd,
          );
          return (
            dueThisWeek ||
            scheduledThisWeek ||
            tasksWithEventsWeek.has(task.id) ||
            habitWeekTaskIds.has(task.id)
          );
        }
        default:
          return true;
      }
    });
  }, [
    activeTasks,
    habitTodayTaskIds,
    habitWeekTaskIds,
    taskView,
    tasksWithEventsToday,
    tasksWithEventsWeek,
    today,
    todayKey,
    weekDateKeySet,
    weekEnd,
    weekStart,
  ]);

  useEffect(() => {
    setListTitleDraft(activePrivateItem?.title ?? "");
  }, [activePrivateItem]);

  function upsertEventInState(event: TaskCalendarEvent) {
    setEvents((prev) => {
      const filtered = prev.filter((existing) => {
        if (existing.id === event.id) {
          return false;
        }
        if (
          event.eventKind === "manual" &&
          existing.eventKind === "manual" &&
          existing.taskId === event.taskId
        ) {
          return false;
        }
        return true;
      });
      return [...filtered, event].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
    });
  }

  function removeEventById(eventId: string) {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  }

  function removeManualEventByTask(taskId: string) {
    setEvents((prev) =>
      prev.filter(
        (event) =>
          !(
            event.taskId === taskId &&
            event.eventKind === "manual"
          ),
      ),
    );
  }

  function handleLinkedEvent(event: TaskCalendarEvent | null, taskId: string) {
    if (event) {
      upsertEventInState(event);
    } else {
      removeManualEventByTask(taskId);
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

  async function loadCalendars() {
    setCalendarsLoading(true);
    try {
      const res = await fetch("/api/task-scheduler/calendars");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load calendars");
      }
      const data = await res.json();
      const nextCalendars: TaskCalendar[] = data?.calendars ?? [];
      setCalendars(nextCalendars);
    } catch {
      setCalendars([]);
    } finally {
      setCalendarsLoading(false);
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
      category: "assignment",
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

  async function handleCreateCalendar(input: CalendarCreatePayload) {
    const res = await csrfFetch("/api/task-scheduler/calendars", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to create calendar");
    }
    const data = await res.json();
    if (data.calendar) {
      const created = data.calendar as TaskCalendar;
      setCalendars((prev) => {
        const next = [...prev, created];
        if (created.isDefault) {
          return next.map((calendar) =>
            calendar.id === created.id
              ? created
              : { ...calendar, isDefault: false },
          );
        }
        return next;
      });
      setActiveCalendarId((prev) => prev ?? created.id);
    }
  }

  async function handleUpdateCalendar(
    calendarId: string,
    patch: CalendarPatchPayload,
  ) {
    const res = await csrfFetch(
      `/api/task-scheduler/calendars/${calendarId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to update calendar");
    }
    const data = await res.json();
    if (data.calendar) {
      const updated = data.calendar as TaskCalendar;
      setCalendars((prev) => {
        const next = prev.map((calendar) =>
          calendar.id === updated.id ? updated : calendar,
        );
        if (updated.isDefault) {
          return next.map((calendar) =>
            calendar.id === updated.id
              ? calendar
              : { ...calendar, isDefault: false },
          );
        }
        return next;
      });
    }
  }

  async function handleDeleteCalendar(calendarId: string) {
    const res = await csrfFetch(
      `/api/task-scheduler/calendars/${calendarId}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to delete calendar");
    }
    const data = await res.json();
    const deletedId = data?.deletedCalendarId ?? calendarId;
    const reassignedCalendarId =
      typeof data?.reassignedCalendarId === "string"
        ? data.reassignedCalendarId
        : null;
    setCalendars((prev) => {
      const remaining = prev.filter((calendar) => calendar.id !== deletedId);
      if (reassignedCalendarId) {
        return remaining.map((calendar) => ({
          ...calendar,
          isDefault: calendar.id === reassignedCalendarId,
        }));
      }
      return remaining;
    });
    setActiveCalendarId((prev) => {
      if (prev && prev !== deletedId) return prev;
      if (reassignedCalendarId) return reassignedCalendarId;
      return null;
    });
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

  async function handleHabitRepeatSave(
    taskId: string,
    payload: Pick<
      TaskUpdatePayload,
      "repeatRule" | "repeatDays" | "repeatUntil"
    >,
  ) {
    await handleUpdateTask(taskId, payload);
  }

  async function handleAutoPlanRun(
    task: StudentTask,
    config: AutoPlanConfig,
  ) {
    try {
      const res = await csrfFetch(
        `/api/task-scheduler/tasks/${task.id}/auto-plan`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(config),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to auto-plan study blocks");
      }
      const data = await res.json();
      const createdEvents = (data.createdEvents ??
        []) as TaskCalendarEvent[];
      setEvents((prev) => {
        const filtered = prev.filter(
          (event) =>
            !(
              event.taskId === task.id && event.eventKind === "auto_plan"
            ),
        );
        return [...filtered, ...createdEvents].sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        );
      });
      if (data.task) {
        upsertTaskInState(data.task as StudentTask);
      }
      if (typeof data.remainingBlocks === "number" && data.remainingBlocks > 0) {
        alert(
          `${data.remainingBlocks} study block(s) could not be scheduled before the deadline.`,
        );
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to auto-plan study blocks",
      );
    }
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
                    tasks={filteredTasks}
                    loading={tasksLoading}
                    onCreateTask={handleCreateTask}
                    onUpdateTask={handleUpdateTask}
                    onScheduleTask={handleScheduleJump}
                    savingTaskIds={taskSavingIds}
                    view={taskView}
                    onViewChange={setTaskView}
                    onRepeatRequest={setRepeatEditorTask}
                    onAutoPlanRequest={setAutoPlanTarget}
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
      {activeSurface === "calendar" ? (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0f0f10]">
          <div className="flex h-11 items-center border-b border-white/10 px-3">
            <div className="inline-flex items-center rounded-md border border-white/10 bg-white/5 p-0.5">
              {surfaceTabs.map((surface) => {
                const isActive = surface.id === activeSurface;
                return (
                  <button
                    key={surface.id}
                    type="button"
                    onClick={() => setActiveSurface(surface.id)}
                    className={classNames(
                      "inline-flex h-7 w-7 items-center justify-center rounded-[6px] transition",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white",
                    )}
                    aria-label={`Switch to ${surface.label}`}
                    title={surface.label}
                  >
                    {surface.id === "planner" ? (
                      <ListIcon className="h-4 w-4" aria-hidden />
                    ) : (
                      <CalendarIcon className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <TaskSchedulerCalendar
              events={events}
              tasks={allTasks}
              loading={eventsLoading || !allTasksLoaded}
              calendars={calendars}
              calendarsLoading={calendarsLoading}
              onCreateCalendar={handleCreateCalendar}
              onUpdateCalendar={handleUpdateCalendar}
              onDeleteCalendar={handleDeleteCalendar}
              activeCalendarId={activeCalendarId}
              onActiveCalendarChange={setActiveCalendarId}
              onCreateEvent={handleCreateEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              focusTaskId={calendarFocusTaskId}
              onRequestFocusClear={() => setCalendarFocusTaskId(null)}
            />
          </div>
        </div>
      ) : (
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
          </div>
        </div>
      )}

      {repeatEditorTask && (
        <HabitRepeatDialog
          task={repeatEditorTask}
          onClose={() => setRepeatEditorTask(null)}
          onSave={async (payload) => {
            await handleHabitRepeatSave(repeatEditorTask.id, payload);
            setRepeatEditorTask(null);
          }}
        />
      )}

      {autoPlanTarget && (
        <AutoPlanDialog
          task={autoPlanTarget}
          onClose={() => setAutoPlanTarget(null)}
          onSubmit={async (config) => {
            await handleAutoPlanRun(autoPlanTarget, config);
            setAutoPlanTarget(null);
          }}
        />
      )}
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
  view: TaskViewFilter;
  onViewChange: (view: TaskViewFilter) => void;
  onRepeatRequest: (task: StudentTask) => void;
  onAutoPlanRequest: (task: StudentTask) => void;
};

function TaskListPane({
  tasks,
  loading,
  onCreateTask,
  onUpdateTask,
  onScheduleTask,
  savingTaskIds,
  view,
  onViewChange,
  onRepeatRequest,
  onAutoPlanRequest,
}: TaskListPaneProps) {
  const [draft, setDraft] = useState<TaskDraft>({ title: "" });
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
      setDraft({ title: "" });
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
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {[
          { id: "all", label: "All" },
          { id: "assignments", label: "Assignments" },
          { id: "exams", label: "Exams" },
          { id: "projects", label: "Projects" },
          { id: "habits", label: "Habits" },
          { id: "today", label: "Today" },
          { id: "week", label: "This week" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onViewChange(tab.id as TaskViewFilter)}
            className={classNames(
              "rounded-full border px-3 py-1",
              view === tab.id
                ? "border-white bg-white/10 text-white"
                : "border-white/10 text-white/70 hover:border-white/30",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[780px] space-y-2">
          <div className="grid grid-cols-[120px,1.5fr,140px,120px,140px,160px,160px,80px] gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/50">
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
                onRepeat={() => onRepeatRequest(task)}
                onAutoPlan={() => onAutoPlanRequest(task)}
              />
            ))
          )}

          <div className="grid grid-cols-[120px,1.5fr,140px,120px,140px,160px,160px,80px] gap-3 rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-3 text-sm text-white/80">
            <span className="text-xs uppercase tracking-[0.3em] text-white/40">
              New
            </span>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ title: event.target.value })}
              placeholder="Add a task title…"
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
            />
            <span className="col-span-5 text-xs uppercase tracking-[0.3em] text-white/30">
              Defaults: Assignment · Medium priority · Unscheduled
            </span>
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
              >
                {creating ? "Adding…" : "Add"}
              </button>
            </div>
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
  onRepeat?: () => void;
  onAutoPlan?: () => void;
};

function TaskRow({
  task,
  saving,
  onUpdate,
  onScheduleTask,
  onRepeat,
  onAutoPlan,
}: TaskRowProps) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState<StudentTaskCategory>(task.category);
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [start, setStart] = useState(toDateTimeInput(task.scheduledStart));
  const [end, setEnd] = useState(toDateTimeInput(task.scheduledEnd));

  useEffect(() => {
    setTitle(task.title);
    setCategory(task.category);
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

  function handleCategoryChange(next: StudentTaskCategory) {
    setCategory(next);
    if (next !== task.category) {
      onUpdate(task.id, { category: next });
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
  const canAutoPlan =
    (task.category === "exam" || task.category === "project") &&
    !!task.dueDate &&
    !!task.estimatedMinutes;
  const repeatDisplay = useMemo(() => {
    switch (task.repeatRule) {
      case "daily":
        return "Daily";
      case "weekdays":
        return "Weekdays";
      case "custom_days":
        if (task.repeatDays?.length) {
          return task.repeatDays
            .map((day) =>
              day >= 0 && day <= 6 ? WEEKDAY_NAMES_SHORT[day] : null,
            )
            .filter(Boolean)
            .join(", ");
        }
        return "Custom";
      default:
        return "Off";
    }
  }, [task.repeatRule, task.repeatDays]);

  function cycleStatus() {
    const currentIndex = TASK_STATUSES.indexOf(task.status);
    const nextStatus =
      TASK_STATUSES[(currentIndex + 1) % TASK_STATUSES.length];
    onUpdate(task.id, { status: nextStatus });
  }

  return (
    <div
      className={classNames(
        "grid grid-cols-[120px,1.5fr,140px,120px,140px,160px,160px,80px] gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm",
        rowMuted && "opacity-60",
      )}
    >
      <button
        type="button"
        disabled={saving}
        onClick={cycleStatus}
        className="rounded-lg border border-white/20 bg-black/30 px-2 py-1 text-xs uppercase tracking-[0.2em] text-white hover:border-white/40"
      >
        {statusLabels[task.status]}
      </button>
      <input
        value={title}
        disabled={saving}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
      />
      <div>
        <select
          value={category}
          disabled={saving}
          onChange={(event) =>
            handleCategoryChange(event.target.value as StudentTaskCategory)
          }
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-white/40"
        >
          {TASK_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat[0].toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
        {task.category === "habit" && onRepeat && (
          <button
            type="button"
            onClick={onRepeat}
            className="mt-2 text-xs text-white/60 underline-offset-2 hover:underline"
          >
            Repeat: {task.repeatRule === "none" ? "Off" : repeatDisplay}
          </button>
        )}
      </div>
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onScheduleTask(task)}
          className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-lg text-white/80 transition hover:bg-white/20 disabled:opacity-50"
        >
          🗓️
        </button>
        {canAutoPlan && onAutoPlan && (
          <button
            type="button"
            onClick={onAutoPlan}
            disabled={saving}
            className={classNames(
              "rounded-full border px-3 py-2 text-lg transition disabled:opacity-50",
              task.autoPlanned
                ? "border-[#ff5ddd] bg-[#ff5ddd]/20 text-[#ff5ddd]"
                : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20",
            )}
          >
            ⚡
          </button>
        )}
      </div>
    </div>
  );
}

type HabitRepeatDialogProps = {
  task: StudentTask;
  onClose: () => void;
  onSave: (payload: {
    repeatRule: StudentHabitRepeatRule;
    repeatDays: number[] | null;
    repeatUntil: string | null;
  }) => Promise<void>;
};

function HabitRepeatDialog({
  task,
  onClose,
  onSave,
}: HabitRepeatDialogProps) {
  const [rule, setRule] = useState<StudentHabitRepeatRule>(task.repeatRule);
  const [days, setDays] = useState<number[]>(task.repeatDays ?? []);
  const [repeatUntil, setRepeatUntil] = useState(task.repeatUntil ?? "");
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((entry) => entry !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        repeatRule: rule,
        repeatDays:
          rule === "custom_days" ? (days.length ? days : null) : null,
        repeatUntil: repeatUntil || null,
      });
      onClose();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update habit repeat",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b16] p-6 text-sm text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Habit repeat</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Mode
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TASK_REPEAT_RULES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRule(option)}
                  className={classNames(
                    "rounded-xl border px-3 py-2 text-xs uppercase tracking-[0.2em]",
                    rule === option
                      ? "border-white bg-white/10"
                      : "border-white/10 text-white/70 hover:border-white/30",
                  )}
                >
                  {option.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          {rule === "custom_days" && (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Days
              </p>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {WEEKDAY_NAMES_SHORT.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={classNames(
                      "rounded-lg border px-2 py-1 text-xs",
                      days.includes(index)
                        ? "border-white bg-white/10"
                        : "border-white/10 text-white/50",
                    )}
                  >
                    {label[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Until
            </p>
            <input
              type="date"
              value={repeatUntil}
              onChange={(event) => setRepeatUntil(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type AutoPlanDialogProps = {
  task: StudentTask;
  onClose: () => void;
  onSubmit: (config: AutoPlanConfig) => Promise<void>;
};

function AutoPlanDialog({ task, onClose, onSubmit }: AutoPlanDialogProps) {
  const [blockLength, setBlockLength] = useState(
    task.autoBlockDurationMin || 50,
  );
  const [maxMinutes, setMaxMinutes] = useState(
    task.autoDailyMaxMinutes || 240,
  );
  const [startDate, setStartDate] = useState(
    task.autoStartDate ?? new Date().toISOString().slice(0, 10),
  );
  const [allowedDays, setAllowedDays] = useState<number[]>(
    task.autoAllowedDays ?? [1, 2, 3, 4, 5],
  );
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [saving, setSaving] = useState(false);

  function toggleAllowedDay(day: number) {
    setAllowedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((entry) => entry !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({
        blockLength,
        maxMinutesPerDay: maxMinutes,
        startDate,
        allowedDays,
        replaceExisting,
      });
      onClose();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to auto-plan blocks",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b16] p-6 text-sm text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Auto-plan study blocks</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white/40">
          {task.title}
        </p>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/40">
              Block length (min)
              <input
                type="number"
                min={20}
                max={180}
                value={blockLength}
                onChange={(event) => setBlockLength(Number(event.target.value))}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/40">
              Max minutes/day
              <input
                type="number"
                min={60}
                max={600}
                value={maxMinutes}
                onChange={(event) => setMaxMinutes(Number(event.target.value))}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/40">
            Earliest start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </label>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Days allowed
            </p>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {WEEKDAY_NAMES_SHORT.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleAllowedDay(index)}
                  className={classNames(
                    "rounded-lg border px-2 py-1 text-xs",
                    allowedDays.includes(index)
                      ? "border-white bg-white/10"
                      : "border-white/10 text-white/50",
                  )}
                >
                  {label[0]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/40">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
              className="h-4 w-4 rounded border border-white/30 bg-transparent"
            />
            Replace previous auto blocks
          </label>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-[#8a5bff] to-[#ff5ddd] px-4 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Planning…" : "Auto-plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
