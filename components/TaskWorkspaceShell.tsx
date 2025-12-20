
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TaskSchedulerCalendar from "@/components/TaskSchedulerCalendar";
import PlannerSidebar from "@/components/task-scheduler/PlannerSidebar";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  List as ListIcon,
  MoreHorizontal,
  Plus,
  Share2,
  Star,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrf-client";
import {
  StudentHabitRepeatRule,
  StudentTask,
  StudentTaskCategory,
  StudentTaskPriority,
  StudentTaskStatus,
  TaskCalendar,
  TaskCalendarEvent,
  TaskCalendarRecurrence,
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
type SelectedEntity =
  | { kind: "none" }
  | { kind: "task"; id: string }
  | { kind: "calendar"; id: string }
  | { kind: "privateItem"; id: string };
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

type HabitCompletion = {
  id: string;
  habitId: string;
  dateKey: string;
  completedAt: string;
};

type TaskUpdatePayload = Partial<{
  title: string;
  description: string | null;
  estimatedMinutes: number | null;
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
  isAllDay: boolean;
  taskId: string | null;
  calendarId?: string | null;
  description?: string | null;
  color?: string | null;
  recurrence?: TaskCalendarRecurrence | null;
};

type CalendarCreatePayload = {
  name: string;
  color: string;
};

type CalendarPatchPayload = Partial<
  Pick<TaskCalendar, "name" | "color" | "isDefault" | "isVisible" | "sortOrder">
>;

type RowSelectOption = {
  value: string;
  label: string;
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
    label: "Home",
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

const TASK_CATEGORY_OPTIONS: RowSelectOption[] = TASK_CATEGORIES.map(
  (category) => ({
    value: category,
    label: category[0].toUpperCase() + category.slice(1),
  }),
);

const TASK_PRIORITY_OPTIONS: RowSelectOption[] = TASK_PRIORITIES.map(
  (priority) => ({
    value: priority,
    label: priorityLabels[priority],
  }),
);

const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HABIT_COMPLETION_LOOKBACK_DAYS = 60;

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

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeHabitCompletionKey(habitId: string, dateKey: string) {
  return `${habitId}:${dateKey}`;
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

function formatTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatEventRange(event: TaskCalendarEvent) {
  if (event.isAllDay) return "All day";
  const start = formatTimeLabel(event.start);
  const end = formatTimeLabel(event.end);
  if (start && end) return `${start} - ${end}`;
  return start || end;
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
  const [habitCompletions, setHabitCompletions] = useState<HabitCompletion[]>(
    [],
  );
  const [habitCompletionsLoading, setHabitCompletionsLoading] = useState(true);
  const [habitCompletionSavingKeys, setHabitCompletionSavingKeys] = useState<
    Set<string>
  >(new Set());
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);
  const [calendarFocusTaskId, setCalendarFocusTaskId] = useState<string | null>(
    null,
  );
  const [taskView, setTaskView] = useState<TaskViewFilter>("all");
  const [repeatEditorTask, setRepeatEditorTask] = useState<StudentTask | null>(
    null,
  );
  const [autoPlanTarget, setAutoPlanTarget] = useState<StudentTask | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>({
    kind: "none",
  });

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedEntity({ kind: "task", id: taskId });
  }, []);

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
    if (activeSurface !== "planner") return;
    setActiveSection("home");
  }, [activeSurface]);

  useEffect(() => {
    if (activeSection !== "private") return;
    if (activePrivateItemId) return;
    if (privateItems.length === 0) return;
    setActivePrivateItemId(privateItems[0].id);
  }, [activeSection, activePrivateItemId, privateItems]);

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
  const todayLocalKey = useMemo(() => toLocalDateKey(today), [today]);
  const habitLookbackStart = useMemo(() => {
    const next = new Date(today);
    next.setDate(next.getDate() - (HABIT_COMPLETION_LOOKBACK_DAYS - 1));
    return next;
  }, [today]);
  const habitLookbackStartKey = useMemo(
    () => toLocalDateKey(habitLookbackStart),
    [habitLookbackStart],
  );
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

  useEffect(() => {
    loadHabitCompletions();
  }, [habitLookbackStartKey, todayLocalKey]);

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
  const habitInstancesTodayAll = useMemo(
    () =>
      generateHabitInstances(allTasks, {
        startDate: today,
        endDate: today,
      }),
    [allTasks, today],
  );
  const habitInstancesLookback = useMemo(
    () =>
      generateHabitInstances(allTasks, {
        startDate: habitLookbackStart,
        endDate: today,
      }),
    [allTasks, habitLookbackStart, today],
  );

  const habitTodayTaskIds = useMemo(
    () => new Set(activeHabitInstancesToday.map((instance) => instance.taskId)),
    [activeHabitInstancesToday],
  );
  const habitWeekTaskIds = useMemo(
    () => new Set(activeHabitInstancesWeek.map((instance) => instance.taskId)),
    [activeHabitInstancesWeek],
  );
  const habitTasksById = useMemo(
    () => new Map(allTasks.map((task) => [task.id, task])),
    [allTasks],
  );
  const habitTodayTasks = useMemo(() => {
    const seen = new Set<string>();
    const list: StudentTask[] = [];
    habitInstancesTodayAll.forEach((instance) => {
      if (seen.has(instance.taskId)) return;
      const task = habitTasksById.get(instance.taskId);
      if (!task) return;
      seen.add(instance.taskId);
      list.push(task);
    });
    return list;
  }, [habitInstancesTodayAll, habitTasksById]);
  const habitCompletionKeySet = useMemo(() => {
    const set = new Set<string>();
    habitCompletions.forEach((completion) => {
      set.add(makeHabitCompletionKey(completion.habitId, completion.dateKey));
    });
    return set;
  }, [habitCompletions]);
  const habitCompletionDatesById = useMemo(() => {
    const map = new Map<string, Set<string>>();
    habitCompletions.forEach((completion) => {
      if (!map.has(completion.habitId)) {
        map.set(completion.habitId, new Set());
      }
      map.get(completion.habitId)!.add(completion.dateKey);
    });
    return map;
  }, [habitCompletions]);
  const requiredHabitKeysById = useMemo(() => {
    const map = new Map<string, string[]>();
    habitInstancesLookback.forEach((instance) => {
      const existing = map.get(instance.taskId);
      if (!existing) {
        map.set(instance.taskId, [instance.dateKey]);
      } else if (!existing.includes(instance.dateKey)) {
        existing.push(instance.dateKey);
      }
    });
    map.forEach((keys) => keys.sort());
    return map;
  }, [habitInstancesLookback]);
  const habitStreaksById = useMemo(() => {
    const map = new Map<string, number>();
    habitTodayTasks.forEach((task) => {
      const requiredKeys = requiredHabitKeysById.get(task.id) ?? [];
      const completedKeys = habitCompletionDatesById.get(task.id) ?? new Set();
      let streak = 0;
      for (let index = requiredKeys.length - 1; index >= 0; index -= 1) {
        const key = requiredKeys[index];
        if (completedKeys.has(key)) {
          streak += 1;
        } else {
          streak = 0;
          break;
        }
      }
      map.set(task.id, streak);
    });
    return map;
  }, [habitCompletionDatesById, habitTodayTasks, requiredHabitKeysById]);
  const habitsTodayLoading = !allTasksLoaded || habitCompletionsLoading;

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

  const nextEvents = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setHours(horizon.getHours() + 24);
    return events
      .filter((event) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return false;
        }
        return end >= now && start <= horizon;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 3);
  }, [events]);

  const incompleteTasks = useMemo(
    () => allTasks.filter((task) => task.status !== "done"),
    [allTasks],
  );

  const topTasks = useMemo(
    () => incompleteTasks.slice(0, 3),
    [incompleteTasks],
  );

  const todayTaskIds = useMemo(() => {
    return new Set(
      incompleteTasks
        .filter((task) => {
          const dueToday = task.dueDate === todayKey;
          const createdToday = task.createdAt
            ? task.createdAt.slice(0, 10) === todayKey
            : false;
          return dueToday || createdToday;
        })
        .map((task) => task.id),
    );
  }, [incompleteTasks, todayKey]);

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
          event.taskId &&
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

  async function loadHabitCompletions() {
    setHabitCompletionsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: habitLookbackStartKey,
        endDate: todayLocalKey,
      });
      const res = await fetch(
        `/api/task-scheduler/habit-completions?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error("Failed to load habit completions");
      }
      const data = await res.json();
      const completions: HabitCompletion[] = data?.completions ?? [];
      setHabitCompletions(completions);
    } catch {
      setHabitCompletions([]);
    } finally {
      setHabitCompletionsLoading(false);
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

  function toggleHabitCompletionSaving(key: string, saving: boolean) {
    setHabitCompletionSavingKeys((prev) => {
      const next = new Set(prev);
      if (saving) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  async function handleHabitCompletionToggle(
    habitId: string,
    dateKey: string,
    nextCompleted: boolean,
  ) {
    const completionKey = makeHabitCompletionKey(habitId, dateKey);
    toggleHabitCompletionSaving(completionKey, true);
    setHabitCompletions((prev) => {
      const filtered = prev.filter(
        (completion) =>
          !(
            completion.habitId === habitId &&
            completion.dateKey === dateKey
          ),
      );
      if (!nextCompleted) return filtered;
      return [
        ...filtered,
        {
          id: `temp-${completionKey}`,
          habitId,
          dateKey,
          completedAt: new Date().toISOString(),
        },
      ];
    });

    try {
      if (nextCompleted) {
        const res = await csrfFetch("/api/task-scheduler/habit-completions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ habitId, dateKey }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to save completion");
        }
        const data = await res.json();
        if (data?.completion) {
          setHabitCompletions((prev) => {
            const filtered = prev.filter(
              (completion) =>
                !(
                  completion.habitId === habitId &&
                  completion.dateKey === dateKey
                ),
            );
            return [...filtered, data.completion];
          });
        } else {
          await loadHabitCompletions();
        }
      } else {
        const res = await csrfFetch("/api/task-scheduler/habit-completions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ habitId, dateKey }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to remove completion");
        }
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update habit completion",
      );
      loadHabitCompletions();
    } finally {
      toggleHabitCompletionSaving(completionKey, false);
    }
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

  async function handleDeleteTask(taskId: string) {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;
    toggleTaskSaving(taskId, true);
    try {
      const res = await csrfFetch(`/api/task-scheduler/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete task");
      }
      setAllTasks((prev) => prev.filter((task) => task.id !== taskId));
      setTasksByList((prev) => {
        const next: Record<string, StudentTask[]> = {};
        Object.entries(prev).forEach(([listId, listTasks]) => {
          next[listId] = listTasks.filter((task) => task.id !== taskId);
        });
        return next;
      });
      setEvents((prev) => prev.filter((event) => event.taskId !== taskId));
      setSelectedEntity((prev) =>
        prev.kind === "task" && prev.id === taskId ? { kind: "none" } : prev,
      );
      setCalendarFocusTaskId((prev) => (prev === taskId ? null : prev));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete task");
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

  function handleScheduleJump(task: StudentTask, calendarId?: string | null) {
    if (calendarId) {
      setActiveCalendarId(calendarId);
    }
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

  const handleSectionChange = useCallback((section: Section) => {
    setActiveSection(section);
  }, []);

  const handleSelectPrivateItem = useCallback(
    (id: string) => {
      setActivePrivateItemId(id);
    },
    [],
  );

  function renderHomeView() {
    return (
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-[#0c0c16] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                Today
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Your focus snapshot
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Keep an eye on what is scheduled next.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold">Next scheduled blocks</p>
            {eventsLoading ? (
              <p className="mt-3 text-sm text-white/60">
                Loading schedule...
              </p>
            ) : nextEvents.length > 0 ? (
              <div className="mt-3 space-y-2">
                {nextEvents.map((event) => {
                  const dateLabel = formatDateLabel(event.start);
                  const timeLabel = formatEventRange(event);
                  const meta = [dateLabel, timeLabel]
                    .filter(Boolean)
                    .join(" | ");
                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-white">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        {meta || "Scheduled block"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-white/60">
                No blocks scheduled yet.
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-[#0c0c16] p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                Top tasks
              </p>
              {!allTasksLoaded && (
                <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Loading...
                </span>
              )}
            </div>
            {!allTasksLoaded ? (
              <p className="mt-3 text-sm text-white/60">Loading tasks...</p>
            ) : topTasks.length > 0 ? (
              <div className="mt-3 space-y-2">
                {topTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {task.dueDate ? `Due ${task.dueDate}` : "No due date"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleScheduleJump(task)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/30 hover:text-white"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-white/60">
                No tasks yet.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0c0c16] p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">
              Habits today
            </p>
            {habitsTodayLoading ? (
              <p className="mt-3 text-sm text-white/60">Loading habits...</p>
            ) : habitTodayTasks.length > 0 ? (
              <div className="mt-3 space-y-2">
                {habitTodayTasks.map((task) => {
                  const completionKey = makeHabitCompletionKey(
                    task.id,
                    todayLocalKey,
                  );
                  return (
                    <HabitTodayRow
                      key={task.id}
                      task={task}
                      completed={habitCompletionKeySet.has(completionKey)}
                      streak={habitStreaksById.get(task.id) ?? 0}
                      disabled={habitCompletionSavingKeys.has(completionKey)}
                      onToggle={(nextCompleted) =>
                        handleHabitCompletionToggle(
                          task.id,
                          todayLocalKey,
                          nextCompleted,
                        )
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-white/60">
                No habits required today.
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  function renderPrivateView() {
    if (!activePrivateItem) {
      return (
        <section className="flex min-h-full flex-col items-center justify-center px-6 pb-12 pt-6 text-center text-white/60 sm:px-10 lg:px-12">
          <p className="text-lg font-medium">Select a private item</p>
          <p className="mt-2 text-sm">
            We’ll open a blank sheet so you can picture what’s coming.
          </p>
        </section>
      );
    }

    const privateTitle =
      listTitleDraft || activePrivateItem.title || "Untitled";

    return (
      <section className="min-h-full w-full px-6 pb-12 pt-6 sm:px-10 lg:px-12">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="truncate text-sm font-medium text-white/60">
                {privateTitle}
              </span>
            </div>
            <div className="flex items-center gap-1 text-white/50">
              <button
                type="button"
                className="rounded-md p-2 transition hover:bg-white/5 hover:text-white/70"
                aria-label="Share"
                title="Share"
              >
                <Share2 className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="rounded-md p-2 transition hover:bg-white/5 hover:text-white/70"
                aria-label="Favorite"
                title="Favorite"
              >
                <Star className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="rounded-md p-2 transition hover:bg-white/5 hover:text-white/70"
                aria-label="More options"
                title="More"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <input
            value={listTitleDraft || activePrivateItem.title || ""}
            onChange={(event) => setListTitleDraft(event.target.value)}
            onBlur={handleRenameList}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            disabled={savingListTitle}
            className="w-full max-w-[960px] rounded-md border border-transparent bg-transparent px-1 py-1 text-4xl font-semibold leading-tight text-white/85 outline-none transition focus:border-white/20 focus:bg-white/5"
          />

          {activePrivateItem.kind === "task_list" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="flex h-7 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
                >
                  <ListIcon className="h-4 w-4" aria-hidden />
                  Table
                  <ChevronDown
                    className="h-3.5 w-3.5 text-white/60"
                    aria-hidden
                  />
                </button>
              </div>
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
                onSelectTask={handleSelectTask}
                showViewTabs={false}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-5 text-sm text-white/60">
              Imagine checklists, task boards, and habit charts living here in a
              few updates. Use the left sidebar to add as many placeholder
              entries as you want so your structure is ready.
            </div>
          )}
        </div>
      </section>
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
    if (activeSection === "settings") return renderSettingsView();
    if (activeSection === "home") return renderHomeView();
    if (activeSection === "private") return renderPrivateView();
    return renderHomeView();
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
        <div className="flex h-[100dvh] flex-col overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 min-h-0">
            <div className="flex w-full flex-col gap-4 px-4 py-4 lg:h-full lg:flex-row">
              <aside className="min-h-0 lg:w-64 lg:shrink-0 lg:overflow-y-auto">
                <PlannerSidebar
                  navItems={navItems}
                  activeSection={activeSection}
                  onSectionChange={handleSectionChange}
                  activeSurface={activeSurface}
                  onSurfaceChange={setActiveSurface}
                  privateItems={privateItems}
                  privateLoading={privateLoading}
                  privateError={privateError}
                  activePrivateItemId={activePrivateItemId}
                  onSelectPrivateItem={handleSelectPrivateItem}
                  onAddPrivateItem={handleCreatePrivateItem}
                  kindMeta={kindMeta}
                  calendars={calendars}
                  calendarsLoading={calendarsLoading}
                  onCreateCalendar={handleCreateCalendar}
                  onUpdateCalendar={handleUpdateCalendar}
                  onDeleteCalendar={handleDeleteCalendar}
                  workspaceTitle="Workspace"
                />
              </aside>

              <main className="min-h-0 flex-1 lg:overflow-y-auto">
                {renderActiveSection()}
              </main>
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
  onSelectTask?: (taskId: string) => void;
  showViewTabs?: boolean;
};

const PRIVATE_TABLE_GRID =
  "grid-cols-[64px,minmax(240px,1.2fr),minmax(160px,1fr)]";

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
  onSelectTask,
  showViewTabs = true,
}: TaskListPaneProps) {
  const [draft, setDraft] = useState<TaskDraft>({ title: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const showToolbar = showViewTabs || loading;

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

  if (!showViewTabs) {
    return (
      <div className="flex flex-col gap-2">
        {loading && (
          <div className="flex justify-end">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Loading...
            </span>
          </div>
        )}
        <div className="overflow-x-auto overflow-y-visible [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
          <div className="min-w-[520px]">
            <div
              className={classNames(
                "grid items-center border-b border-white/10 px-2 py-2 text-[11px] font-medium text-white/50",
                PRIVATE_TABLE_GRID,
              )}
            >
              <div />
              <div className="flex h-full items-center gap-2 border-l border-white/10 pl-4">
                <span className="text-[10px] font-semibold text-white/40">
                  Aa
                </span>
                <span>Name</span>
              </div>
              <div className="flex h-full items-center border-l border-white/10 pl-4 text-white/40">
                + Add property
              </div>
            </div>
            <div className="divide-y divide-white/10">
              <div
                className={classNames(
                  "group grid items-center px-2 py-1.5 text-sm text-white/60 transition hover:bg-white/5",
                  PRIVATE_TABLE_GRID,
                )}
              >
                <div className="flex items-center pl-2">
                  <div className="pointer-events-none flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Plus className="h-3.5 w-3.5 text-white/60" aria-hidden />
                    <span
                      className="grid h-3.5 w-3.5 grid-cols-2 gap-[2px]"
                      aria-hidden
                    >
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                    </span>
                    <span className="h-4 w-4 rounded-sm border border-white/30 bg-black/20" />
                  </div>
                </div>
                <div className="flex h-full min-w-0 items-center gap-3 border-l border-white/10 pl-4">
                  <span className="h-4 w-full" aria-hidden />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    OPEN
                  </button>
                </div>
                <div className="h-full border-l border-white/10" />
              </div>
              {tasks.map((task) => (
                <NotionTaskRow
                  key={task.id}
                  task={task}
                  saving={savingTaskIds.has(task.id)}
                  onUpdate={onUpdateTask}
                  onSelect={() => onSelectTask?.(task.id)}
                />
              ))}
              <div
                className={classNames(
                  "group grid items-center px-2 py-1.5 text-sm text-white/60 transition hover:bg-white/5",
                  PRIVATE_TABLE_GRID,
                )}
              >
                <div className="pl-2" />
                <div className="flex h-full min-w-0 items-center border-l border-white/10 pl-4">
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ title: event.target.value })
                    }
                    placeholder="+ New page"
                    className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-1 text-sm text-white/80 outline-none transition placeholder:text-white/40 focus:border-white/10 focus:bg-white/5"
                  />
                </div>
                <div className="flex h-full items-center justify-end border-l border-white/10 pl-4">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className={classNames(
                      "rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 transition hover:border-white/30 hover:text-white/80 disabled:opacity-40",
                      "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                      creating && "opacity-100",
                    )}
                  >
                    {creating ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {createError && <p className="text-xs text-rose-300">{createError}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {showViewTabs && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
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
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium transition",
                    view === tab.id
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 text-white/60 hover:border-white/20 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {loading && (
            <span
              className={classNames(
                "text-[10px] uppercase tracking-[0.3em] text-white/40",
                showViewTabs && "ml-auto",
              )}
            >
              Loading...
            </span>
          )}
        </div>
      )}
      <div className="border border-white/10 bg-transparent">
        <div className="overflow-x-auto overflow-y-visible [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
          <div className="min-w-[780px]">
            <div className="grid grid-cols-[120px,1.5fr,140px,120px,140px,160px,160px,80px] gap-3 border-b border-white/10 bg-white/5 px-4 py-2 text-[11px] font-medium text-white/45">
              <span>Status</span>
              <span>Title</span>
              <span>Category</span>
              <span>Priority</span>
              <span>Due date</span>
              <span>Start</span>
              <span>End</span>
              <span className="text-center">Plan</span>
            </div>
            <div className="divide-y divide-white/10">
              {tasks.length === 0 && !loading ? (
                <div className="px-4 py-6 text-sm text-white/50">
                  No tasks yet. Add your first study mission below.
                </div>
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
                    onSelect={() => onSelectTask?.(task.id)}
                  />
                ))
              )}
              <div className="grid grid-cols-[120px,1.5fr,140px,120px,140px,160px,160px,80px] gap-3 px-4 py-2 text-sm text-white/60 transition hover:bg-white/5">
                <span className="text-xs font-medium text-white/40">
                  + New page
                </span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ title: event.target.value })}
                  placeholder="New page title..."
                  className="rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white/80 outline-none transition focus:border-white/20 focus:bg-white/5"
                />
                <span className="col-span-5 text-[11px] text-white/35">
                  Defaults: Assignment · Medium priority · Unscheduled
                </span>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-semibold text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    {creating ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {createError && <p className="text-xs text-rose-300">{createError}</p>}
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
  onSelect?: () => void;
};

type NotionTaskRowProps = {
  task: StudentTask;
  saving: boolean;
  onUpdate: (taskId: string, updates: TaskUpdatePayload) => Promise<void>;
  onSelect?: () => void;
};

type RowSelectProps = {
  value: string;
  options: RowSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

function RowSelect({ value, options, disabled, onChange }: RowSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-white/80 outline-none transition focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate text-left">
          {selectedOption?.label ?? "Select"}
        </span>
        <ChevronDown
          className={classNames(
            "h-4 w-4 text-white/60 transition",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && !disabled && options.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-2 max-h-56 overflow-auto rounded-md border border-white/10 bg-[#0b0b0f] p-1 text-xs shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={classNames(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition",
                  isSelected
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotionTaskRow({
  task,
  saving,
  onUpdate,
  onSelect,
}: NotionTaskRowProps) {
  const [title, setTitle] = useState(task.title);

  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  async function commitTitle() {
    if (title.trim() && title.trim() !== task.title) {
      await onUpdate(task.id, { title: title.trim() });
    } else {
      setTitle(task.title);
    }
  }

  const rowMuted = task.status === "done";

  return (
    <div
      onClick={onSelect}
      className={classNames(
        "group grid items-center px-2 py-1.5 text-sm text-white/80 transition hover:bg-white/5",
        PRIVATE_TABLE_GRID,
        rowMuted && "text-white/40",
        saving && "opacity-60",
      )}
    >
      <div className="flex items-center pl-2">
        <div className="pointer-events-none flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Plus className="h-3.5 w-3.5 text-white/60" aria-hidden />
          <span
            className="grid h-3.5 w-3.5 grid-cols-2 gap-[2px]"
            aria-hidden
          >
            <span className="h-1 w-1 rounded-full bg-white/35" />
            <span className="h-1 w-1 rounded-full bg-white/35" />
            <span className="h-1 w-1 rounded-full bg-white/35" />
            <span className="h-1 w-1 rounded-full bg-white/35" />
            <span className="h-1 w-1 rounded-full bg-white/35" />
            <span className="h-1 w-1 rounded-full bg-white/35" />
          </span>
          <span className="h-4 w-4 rounded-sm border border-white/30 bg-black/20" />
        </div>
      </div>
      <div className="flex h-full min-w-0 items-center gap-3 border-l border-white/10 pl-4">
        <input
          value={title}
          disabled={saving}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-1 text-sm font-medium text-white/80 outline-none transition focus:border-white/10 focus:bg-white/5"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 opacity-0 transition-opacity group-hover:opacity-100"
        >
          OPEN
        </button>
      </div>
      <div className="h-full border-l border-white/10 pl-4" />
    </div>
  );
}

function TaskRow({
  task,
  saving,
  onUpdate,
  onScheduleTask,
  onRepeat,
  onAutoPlan,
  onSelect,
}: TaskRowProps) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState<StudentTaskCategory>(task.category);
  const [priority, setPriority] = useState<StudentTaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [start, setStart] = useState(toDateTimeInput(task.scheduledStart));
  const [end, setEnd] = useState(toDateTimeInput(task.scheduledEnd));

  useEffect(() => {
    setTitle(task.title);
    setCategory(task.category);
    setPriority(task.priority);
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

  function handlePriorityChange(next: StudentTaskPriority) {
    setPriority(next);
    if (next !== task.priority) {
      onUpdate(task.id, { priority: next });
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
      onClick={onSelect}
      className={classNames(
        "grid cursor-pointer grid-cols-[120px,1.5fr,140px,120px,140px,160px,160px,80px] gap-3 px-4 py-2 text-sm text-white/90 transition hover:bg-white/5",
        rowMuted && "opacity-60",
      )}
    >
      <button
        type="button"
        disabled={saving}
        onClick={cycleStatus}
        className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-white/70 hover:border-white/40"
      >
        {statusLabels[task.status]}
      </button>
      <input
        value={title}
        disabled={saving}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        className="rounded-md border border-transparent bg-transparent px-2 py-1 font-medium text-white outline-none focus:border-white/30 focus:bg-white/5"
      />
      <div>
        <RowSelect
          value={category}
          options={TASK_CATEGORY_OPTIONS}
          disabled={saving}
          onChange={(nextValue) =>
            handleCategoryChange(nextValue as StudentTaskCategory)
          }
        />
        {task.category === "habit" && onRepeat && (
          <button
            type="button"
            onClick={onRepeat}
            className="mt-1 text-[11px] text-white/50 hover:text-white/70"
          >
            Repeat: {task.repeatRule === "none" ? "Off" : repeatDisplay}
          </button>
        )}
      </div>
      <RowSelect
        value={priority}
        options={TASK_PRIORITY_OPTIONS}
        disabled={saving}
        onChange={(nextValue) =>
          handlePriorityChange(nextValue as StudentTaskPriority)
        }
      />
      <input
        type="date"
        value={dueDate}
        disabled={saving}
        onChange={(event) => setDueDate(event.target.value)}
        onBlur={commitDueDate}
        className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 outline-none focus:border-white/40"
      />
      <input
        type="datetime-local"
        value={start}
        disabled={saving}
        onChange={(event) => setStart(event.target.value)}
        onBlur={() => {
          const nextEnd = start ? end : "";
          if (!start && end) {
            setEnd("");
          }
          commitScheduleChange(start, nextEnd);
        }}
        className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 outline-none focus:border-white/40"
      />
      <input
        type="datetime-local"
        value={end}
        disabled={saving}
        onChange={(event) => setEnd(event.target.value)}
        onBlur={() => commitScheduleChange(start, end)}
        className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 outline-none focus:border-white/40"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onScheduleTask(task)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          🗓️
        </button>
        {canAutoPlan && onAutoPlan && (
          <button
            type="button"
            onClick={onAutoPlan}
            disabled={saving}
            className={classNames(
              "rounded-md border px-2 py-1 text-sm transition disabled:opacity-50",
              task.autoPlanned
                ? "border-[#ff5ddd] bg-[#ff5ddd]/15 text-[#ff5ddd]"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
            )}
          >
            ⚡
          </button>
        )}
      </div>
    </div>
  );
}

type HabitTodayRowProps = {
  task: StudentTask;
  completed: boolean;
  streak: number;
  disabled: boolean;
  onToggle: (nextCompleted: boolean) => void;
};

function HabitTodayRow({
  task,
  completed,
  streak,
  disabled,
  onToggle,
}: HabitTodayRowProps) {
  const streakLabel = `${streak} day${streak === 1 ? "" : "s"}`;

  return (
    <div
      className={classNames(
        "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3",
        disabled && "opacity-60",
      )}
    >
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={completed}
          disabled={disabled}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-4 w-4 rounded border border-white/30 bg-black/40 text-emerald-300 accent-emerald-400"
        />
        <span
          className={classNames(
            "text-sm font-semibold text-white",
            completed && "text-white/50 line-through",
          )}
        >
          {task.title}
        </span>
      </label>
      <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
        {streakLabel}
      </span>
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

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

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
            aria-label="Close dialog"
            className="rounded-lg p-2 text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
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
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/40"
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

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

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
            aria-label="Close dialog"
            className="rounded-lg p-2 text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
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
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/40"
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
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/40"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-white/40">
            Earliest start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/40"
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
