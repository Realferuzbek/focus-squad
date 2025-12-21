
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TaskSchedulerCalendar from "@/components/TaskSchedulerCalendar";
import PlannerSidebar from "@/components/task-scheduler/PlannerSidebar";
import NotesInbox, { type NoteEntry } from "@/components/notes/NotesInbox";
import {
  Calendar as CalendarIcon,
  Check,
  Circle,
  List as ListIcon,
  Search,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrf-client";
import {
  HabitScheduleType,
  HabitStatus,
  StudentHabit,
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
  TaskPrivateListType,
  HABIT_SCHEDULE_TYPES,
  HABIT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/taskSchedulerTypes";
import { generateHabitInstances } from "@/lib/taskSchedulerHabits";

type Section = "home" | "notes" | "private" | "settings";
type SurfaceView = "planner" | "calendar";

type PlannerViewFilter = "today" | "next" | "projects" | "done";
type HabitViewFilter = "today" | "week" | "all";

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
  subject: string | null;
  resourceUrl: string | null;
  estimatedMinutes: number | null;
  category: StudentTaskCategory;
  status: StudentTaskStatus;
  priority: StudentTaskPriority;
  dueDate: string | null;
  dueAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  repeatRule: StudentHabitRepeatRule;
  repeatDays: number[] | null;
  repeatUntil: string | null;
}>;

type HabitUpdatePayload = Partial<{
  name: string;
  scheduleType: HabitScheduleType;
  scheduleDays: number[] | null;
  status: HabitStatus;
  target: number | null;
  notes: string | null;
  resourceUrl: string | null;
  startDate: string;
}>;


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
    id: "notes",
    label: "Notes",
    description: "Quick capture inbox",
    icon: "📝",
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
  page: { label: "PAGE", icon: "📄" },
  task_list: { label: "TASK LIST", icon: "🗂️" },
};

const statusLabels: Record<StudentTaskStatus, string> = {
  not_started: "To do",
  in_progress: "Doing",
  done: "Done",
};

const priorityLabels: Record<StudentTaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const SUBJECT_OPTIONS = ["Math", "IELTS", "Physics", "Other", "Projects"];

const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HABIT_COMPLETION_LOOKBACK_DAYS = 60;

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

function getTaskDueDate(task: StudentTask) {
  if (task.dueAt) {
    const date = new Date(task.dueAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (task.dueDate) {
    const date = new Date(`${task.dueDate}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function getTaskDueKey(task: StudentTask) {
  const date = getTaskDueDate(task);
  if (!date) return null;
  return toLocalDateKey(date);
}

function formatTaskDue(task: StudentTask) {
  const date = getTaskDueDate(task);
  if (!date) return "—";
  const dateLabel = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  if (task.dueAt) {
    const timeLabel = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateLabel} · ${timeLabel}`;
  }
  return dateLabel;
}

function isHabitScheduledOn(habit: StudentHabit, date: Date) {
  const startDate = new Date(habit.startDate);
  startDate.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  if (day < startDate) return false;

  const weekday = day.getDay();
  if (habit.scheduleType === "daily") return true;
  if (habit.scheduleType === "weekdays") {
    return weekday >= 1 && weekday <= 5;
  }
  if (habit.scheduleType === "custom") {
    return (habit.scheduleDays ?? []).includes(weekday);
  }
  return false;
}

function computeHabitStreak(
  habit: StudentHabit,
  completionDates: Set<string>,
  today: Date,
) {
  const startDate = new Date(habit.startDate);
  startDate.setHours(0, 0, 0, 0);
  const isPaused = habit.status === "paused";

  let anchorDate: Date | null = null;
  if (isPaused) {
    let latest: Date | null = null;
    completionDates.forEach((dateKey) => {
      const date = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      if (!latest || date > latest) latest = date;
    });
    anchorDate = latest;
  } else {
    anchorDate = new Date(today);
  }

  if (!anchorDate) return 0;
  anchorDate.setHours(0, 0, 0, 0);
  if (anchorDate < startDate) return 0;

  let cursor = new Date(anchorDate);
  if (!isPaused) {
    while (cursor >= startDate && !isHabitScheduledOn(habit, cursor)) {
      cursor.setDate(cursor.getDate() - 1);
    }
    if (cursor < startDate) return 0;
    const cursorKey = toLocalDateKey(cursor);
    if (!completionDates.has(cursorKey)) return 0;
  }

  let streak = 0;
  while (cursor >= startDate) {
    if (isHabitScheduledOn(habit, cursor)) {
      const key = toLocalDateKey(cursor);
      if (completionDates.has(key)) {
        streak += 1;
      } else {
        break;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function TaskWorkspaceShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isNotesRoute = pathname?.includes("/feature/notes") ?? false;
  const [activeSection, setActiveSection] = useState<Section>(
    isNotesRoute ? "notes" : "home",
  );
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
  const [plannerView, setPlannerView] = useState<PlannerViewFilter>("today");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSort, setTaskSort] = useState<"due" | "priority">("due");
  const [plannerPropertiesOpen, setPlannerPropertiesOpen] = useState(false);
  const [habitView, setHabitView] = useState<HabitViewFilter>("today");
  const [habitPropertiesOpen, setHabitPropertiesOpen] = useState(false);
  const [habitsByList, setHabitsByList] = useState<
    Record<string, StudentHabit[]>
  >({});
  const [habitsLoadingMap, setHabitsLoadingMap] = useState<
    Record<string, boolean>
  >({});
  const [habitSavingIds, setHabitSavingIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<NoteEntry | null>(null);
  const [convertTitle, setConvertTitle] = useState("");
  const [convertDueDate, setConvertDueDate] = useState("");
  const [convertSubject, setConvertSubject] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    actionLabel?: string;
    action?: () => void;
  } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTemplate, setCreateTemplate] =
    useState<TaskPrivateListType | null>(null);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [lastPlannerListId, setLastPlannerListId] = useState<string | null>(
    null,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const devSeededRef = useRef(false);

  const activePrivateItem = useMemo(() => {
    if (!activePrivateItemId) return null;
    return privateItems.find((item) => item.id === activePrivateItemId) ?? null;
  }, [activePrivateItemId, privateItems]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return allTasks.find((task) => task.id === selectedTaskId) ?? null;
  }, [allTasks, selectedTaskId]);

  const selectedHabit = useMemo(() => {
    if (!selectedHabitId) return null;
    for (const list of Object.values(habitsByList)) {
      const match = list.find((habit) => habit.id === selectedHabitId);
      if (match) return match;
    }
    return null;
  }, [habitsByList, selectedHabitId]);

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const handleSelectHabit = useCallback((habitId: string) => {
    setSelectedHabitId(habitId);
  }, []);

  const activeTasks = useMemo(() => {
    if (!activePrivateItemId) return [];
    return tasksByList[activePrivateItemId] ?? [];
  }, [activePrivateItemId, tasksByList]);

  const activeHabits = useMemo(() => {
    if (!activePrivateItemId) return [];
    return habitsByList[activePrivateItemId] ?? [];
  }, [activePrivateItemId, habitsByList]);

  const tasksLoading = activePrivateItemId
    ? !!tasksLoadingMap[activePrivateItemId]
    : false;

  const habitsLoading = activePrivateItemId
    ? !!habitsLoadingMap[activePrivateItemId]
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

  const loadHabitsFor = useCallback(async (privateItemId: string) => {
    setHabitsLoadingMap((prev) => ({ ...prev, [privateItemId]: true }));
    try {
      const res = await fetch(
        `/api/task-scheduler/private-items/${privateItemId}/habits`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load habits");
      }
      const data = await res.json();
      const habits: StudentHabit[] = data?.habits ?? [];
      setHabitsByList((prev) => ({ ...prev, [privateItemId]: habits }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load habits");
    } finally {
      setHabitsLoadingMap((prev) => ({ ...prev, [privateItemId]: false }));
    }
  }, []);

  useEffect(() => {
    loadPrivateItems();
  }, []);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    loadAllTasks();
    loadEvents();
    loadCalendars();
  }, []);

  useEffect(() => {
    if (activeSurface !== "planner") return;
    if (isNotesRoute) return;
    setActiveSection("home");
  }, [activeSurface, isNotesRoute]);

  useEffect(() => {
    if (isNotesRoute) {
      setActiveSection("notes");
      return;
    }
    if (activeSection === "notes") {
      setActiveSection("home");
    }
  }, [isNotesRoute]);

  useEffect(() => {
    if (isNotesRoute && activeSurface !== "planner") {
      setActiveSurface("planner");
    }
  }, [activeSurface, isNotesRoute]);

  useEffect(() => {
    if (activeSection !== "private") return;
    if (activePrivateItemId) return;
    if (privateItems.length === 0) return;
    setActivePrivateItemId(privateItems[0].id);
  }, [activeSection, activePrivateItemId, privateItems]);

  useEffect(() => {
    if (isNotesRoute) return;
    const targetId = searchParams.get("private");
    if (!targetId) return;
    if (!privateItems.some((item) => item.id === targetId)) return;
    setActivePrivateItemId(targetId);
    setActiveSection("private");
  }, [isNotesRoute, privateItems, searchParams]);

  useEffect(() => {
    if (!activePrivateItem) return;
    if (activePrivateItem.listType === "habit_tracker") {
      if (!habitsByList[activePrivateItem.id]) {
        loadHabitsFor(activePrivateItem.id);
      }
      return;
    }
    if (!tasksByList[activePrivateItem.id]) {
      loadTasksFor(activePrivateItem.id);
    }
  }, [activePrivateItem, habitsByList, tasksByList, loadHabitsFor, loadTasksFor]);

  useEffect(() => {
    if (activePrivateItem?.listType === "planner_tasks") {
      setLastPlannerListId(activePrivateItem.id);
    }
  }, [activePrivateItem]);

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

  useEffect(() => {
    if (isNotesRoute) return;
    const taskId = searchParams.get("task");
    if (!taskId || !activePrivateItemId) return;
    const listTasks = tasksByList[activePrivateItemId] ?? [];
    if (!listTasks.some((task) => task.id === taskId)) return;
    setSelectedTaskId(taskId);
  }, [isNotesRoute, searchParams, tasksByList, activePrivateItemId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      return toLocalDateKey(day);
    });
  }, [weekStart]);

  useEffect(() => {
    loadHabitCompletions();
  }, [habitLookbackStartKey, todayLocalKey]);

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
  const taskHabitStreaksById = useMemo(() => {
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

  const habitStreaksByHabitId = useMemo(() => {
    const map = new Map<string, number>();
    activeHabits.forEach((habit) => {
      const completed = habitCompletionDatesById.get(habit.id) ?? new Set();
      map.set(habit.id, computeHabitStreak(habit, completed, today));
    });
    return map;
  }, [activeHabits, habitCompletionDatesById, today]);

  const plannerTasks = useMemo(() => {
    const searchValue = taskSearch.trim().toLowerCase();
    const matchesSearch = (task: StudentTask) => {
      if (!searchValue) return true;
      return [
        task.title,
        task.subject ?? "",
        task.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    };

    const filtered = activeTasks.filter((task) => {
      if (!matchesSearch(task)) return false;
      const dueKey = getTaskDueKey(task);
      switch (plannerView) {
        case "today":
          return (
            task.status !== "done" && !!dueKey && dueKey === todayLocalKey
          );
        case "next":
          return (
            task.status !== "done" && !!dueKey && dueKey > todayLocalKey
          );
        case "projects":
          return (task.subject ?? "").trim().toLowerCase() === "projects";
        case "done":
          return task.status === "done";
        default:
          return true;
      }
    });

    const priorityWeight: Record<StudentTaskPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const sorted = [...filtered].sort((a, b) => {
      if (plannerView === "done") {
        const aDone = a.completedAt
          ? new Date(a.completedAt).getTime()
          : 0;
        const bDone = b.completedAt
          ? new Date(b.completedAt).getTime()
          : 0;
        return bDone - aDone;
      }
      if (taskSort === "priority") {
        return priorityWeight[a.priority] - priorityWeight[b.priority];
      }
      const aDue = getTaskDueDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDue = getTaskDueDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });

    return sorted;
  }, [
    activeTasks,
    plannerView,
    taskSearch,
    taskSort,
    todayLocalKey,
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
      if (
        items.length === 0 &&
        process.env.NODE_ENV === "development" &&
        !devSeededRef.current
      ) {
        devSeededRef.current = true;
        await fetch("/api/task-scheduler/dev-seed", { method: "POST" });
        await loadPrivateItems();
        await loadNotes();
        return;
      }
      setPrivateItems(items);
      setActivePrivateItemId((prev) => prev ?? items[0]?.id ?? null);
    } catch (error) {
      setPrivateError(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setPrivateLoading(false);
    }
  }

  async function loadNotes() {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const res = await fetch("/api/task-scheduler/notes");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load notes");
      }
      const data = await res.json();
      setNotes((data?.notes ?? []) as NoteEntry[]);
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setNotesLoading(false);
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
    setCreateModalOpen(true);
    setCreateTemplate(null);
    setCreateName("");
    setCreateError(null);
  }

  async function handleCreateListSubmit() {
    if (!createTemplate) {
      setCreateError("Choose a template.");
      return;
    }
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError("Name is required.");
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await csrfFetch("/api/task-scheduler/private-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          listType: createTemplate,
        }),
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
      setCreateModalOpen(false);
      if (createTemplate === "planner_tasks") {
        setLastPlannerListId(item.id);
      }
      if (isNotesRoute) {
        router.push(`/feature/tasks?private=${item.id}`);
      } else {
        setActiveSection("private");
      }
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create list",
      );
    } finally {
      setCreateSaving(false);
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

  async function handleUpdateHiddenColumns(nextHidden: string[]) {
    if (!activePrivateItemId) return;
    try {
      const res = await csrfFetch(
        `/api/task-scheduler/private-items/${activePrivateItemId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hiddenColumns: nextHidden }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to update properties");
      }
      const data = await res.json();
      setPrivateItems((prev) =>
        prev.map((item) =>
          item.id === activePrivateItemId ? data.item : item,
        ),
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to update properties",
      );
    }
  }

  async function handleCreateTask(draft: TaskDraft) {
    if (!activePrivateItemId) return;
    if (activePrivateItem?.listType !== "planner_tasks") return;
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

  function upsertHabitInState(habit: StudentHabit) {
    setHabitsByList((prev) => {
      const listHabits = prev[habit.listId] ?? [];
      const index = listHabits.findIndex((h) => h.id === habit.id);
      const nextHabits =
        index === -1
          ? [...listHabits, habit]
          : listHabits.map((h) => (h.id === habit.id ? habit : h));
      return { ...prev, [habit.listId]: nextHabits };
    });
  }

  function toggleHabitSaving(habitId: string, saving: boolean) {
    setHabitSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(habitId);
      else next.delete(habitId);
      return next;
    });
  }

  async function handleCreateHabit(name: string) {
    if (!activePrivateItemId) return;
    if (activePrivateItem?.listType !== "habit_tracker") return;
    const payload = {
      name,
      scheduleType: "daily",
    };
    const res = await csrfFetch(
      `/api/task-scheduler/private-items/${activePrivateItemId}/habits`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to create habit");
    }
    const data = await res.json();
    if (data?.habit) {
      upsertHabitInState(data.habit as StudentHabit);
    }
  }

  async function handleUpdateHabit(
    habitId: string,
    updates: HabitUpdatePayload,
  ) {
    toggleHabitSaving(habitId, true);
    try {
      const res = await csrfFetch(`/api/task-scheduler/habits/${habitId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to update habit");
      }
      const data = await res.json();
      if (data?.habit) {
        upsertHabitInState(data.habit as StudentHabit);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update habit");
    } finally {
      toggleHabitSaving(habitId, false);
    }
  }

  function replaceNoteInState(note: NoteEntry, tempId?: string) {
    setNotes((prev) => {
      if (tempId) {
        return prev.map((entry) => (entry.id === tempId ? note : entry));
      }
      const index = prev.findIndex((entry) => entry.id === note.id);
      if (index === -1) return [...prev, note];
      return prev.map((entry) => (entry.id === note.id ? note : entry));
    });
  }

  async function handleSendNote(text: string) {
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const tempNote: NoteEntry = {
      id: tempId,
      text,
      pinned: false,
      convertedTaskId: null,
      createdAt: now,
      updatedAt: now,
      pending: true,
    };
    setNotes((prev) => [...prev, tempNote]);
    try {
      const res = await csrfFetch("/api/task-scheduler/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to send note");
      }
      const data = await res.json();
      replaceNoteInState(data.note as NoteEntry, tempId);
    } catch (error) {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === tempId
            ? { ...note, pending: false, failed: true }
            : note,
        ),
      );
    }
  }

  async function handleRetryNote(note: NoteEntry) {
    setNotes((prev) =>
      prev.map((entry) =>
        entry.id === note.id
          ? { ...entry, pending: true, failed: false }
          : entry,
      ),
    );
    try {
      const res = await csrfFetch("/api/task-scheduler/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: note.text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to send note");
      }
      const data = await res.json();
      replaceNoteInState(data.note as NoteEntry, note.id);
    } catch (error) {
      setNotes((prev) =>
        prev.map((entry) =>
          entry.id === note.id
            ? { ...entry, pending: false, failed: true }
            : entry,
        ),
      );
    }
  }

  async function handleTogglePin(note: NoteEntry) {
    const nextPinned = !note.pinned;
    setNotes((prev) =>
      prev.map((entry) =>
        entry.id === note.id ? { ...entry, pinned: nextPinned } : entry,
      ),
    );
    try {
      const res = await csrfFetch(`/api/task-scheduler/notes/${note.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to update note");
      }
      const data = await res.json();
      replaceNoteInState(data.note as NoteEntry);
    } catch {
      setNotes((prev) =>
        prev.map((entry) =>
          entry.id === note.id ? { ...entry, pinned: note.pinned } : entry,
        ),
      );
    }
  }

  async function handleDeleteNote(note: NoteEntry) {
    try {
      const res = await csrfFetch(`/api/task-scheduler/notes/${note.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete note");
      }
      setNotes((prev) => prev.filter((entry) => entry.id !== note.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete note");
    }
  }

  function handleConvertRequest(note: NoteEntry) {
    const firstLine = note.text.split("\n")[0]?.trim() || "New task";
    setConvertTarget(note);
    setConvertTitle(firstLine);
    setConvertDueDate("");
    setConvertSubject("");
  }

  async function ensurePlannerList() {
    const existing =
      privateItems.find((item) => item.id === lastPlannerListId) ??
      privateItems.find((item) => item.listType === "planner_tasks") ??
      null;
    if (existing) {
      setLastPlannerListId(existing.id);
      return existing;
    }

    const res = await csrfFetch("/api/task-scheduler/private-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Planner Tasks",
        listType: "planner_tasks",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to create Planner list");
    }
    const data = await res.json();
    const item: TaskPrivateItem = data.item;
    setPrivateItems((prev) => [...prev, item]);
    setLastPlannerListId(item.id);
    return item;
  }

  async function handleConvertConfirm() {
    if (!convertTarget) return;
    const trimmedTitle = convertTitle.trim();
    if (!trimmedTitle) return;
    try {
      const plannerList = await ensurePlannerList();
      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        description: convertTarget.text,
      };
      if (convertSubject.trim()) {
        payload.subject = convertSubject.trim();
      }
      if (convertDueDate) {
        payload.dueDate = convertDueDate;
      }
      const res = await csrfFetch(
        `/api/task-scheduler/private-items/${plannerList.id}/tasks`,
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
      if (data?.task) {
        upsertTaskInState(data.task as StudentTask);
      }
      const taskId = data?.task?.id as string | undefined;
      const patchRes = await csrfFetch(
        `/api/task-scheduler/notes/${convertTarget.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ convertedTaskId: taskId ?? null }),
        },
      );
      if (patchRes.ok) {
        const patchData = await patchRes.json();
        replaceNoteInState(patchData.note as NoteEntry);
      }
      setToast({
        message: "Added to Planner Tasks",
        actionLabel: "Open",
        action: () => {
          if (!taskId) return;
          router.push(`/feature/tasks?private=${plannerList.id}&task=${taskId}`);
        },
      });
      setConvertTarget(null);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to convert note",
      );
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

  const handleSectionChange = useCallback(
    (section: Section) => {
      if (section === "notes") {
        if (!isNotesRoute) {
          router.push("/feature/notes");
        }
        if (activeSurface !== "planner") {
          setActiveSurface("planner");
        }
        setActiveSection("notes");
        return;
      }
      if (isNotesRoute) {
        router.push("/feature/tasks");
      }
      setActiveSection(section);
    },
    [activeSurface, isNotesRoute, router],
  );

  const handleSelectPrivateItem = useCallback(
    (id: string) => {
      if (isNotesRoute) {
        router.push(`/feature/tasks?private=${id}`);
        return;
      }
      setActivePrivateItemId(id);
      setActiveSection("private");
    },
    [isNotesRoute, router],
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
                          {task.dueDate || task.dueAt
                            ? `Due ${formatTaskDue(task)}`
                            : "No due date"}
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
                      streak={taskHabitStreaksById.get(task.id) ?? 0}
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

  function renderNotesView() {
    return (
      <section className="min-h-full w-full px-6 pb-12 pt-6 sm:px-10 lg:px-12">
        <div className="mx-auto flex h-full max-w-[760px] flex-col">
          {notesError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {notesError}
            </div>
          )}
          <NotesInbox
            notes={notes}
            loading={notesLoading}
            onSend={handleSendNote}
            onRetry={handleRetryNote}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteNote}
            onConvert={handleConvertRequest}
          />
        </div>
      </section>
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

    const isPlannerList = activePrivateItem.listType === "planner_tasks";
    const isHabitList = activePrivateItem.listType === "habit_tracker";
    const hiddenColumns = activePrivateItem.hiddenColumns ?? [];
    const habitsForView =
      habitView === "today"
        ? activeHabits.filter((habit) => isHabitScheduledOn(habit, today))
        : activeHabits;

    return (
      <section className="min-h-full w-full px-6 pb-12 pt-6 sm:px-10 lg:px-12">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
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
            <span className="text-xs uppercase tracking-[0.3em] text-white/40">
              {isHabitList ? "PRIVATE / HABITS" : "PRIVATE / TASKS"}
            </span>
          </div>

          {activePrivateItem.kind !== "task_list" ? (
            <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-5 text-sm text-white/60">
              Imagine checklists, task boards, and habit charts living here in a
              few updates. Use the left sidebar to add as many placeholder
              entries as you want so your structure is ready.
            </div>
          ) : isPlannerList ? (
            <PlannerTasksPanel
              tasks={plannerTasks}
              loading={tasksLoading}
              view={plannerView}
              onViewChange={setPlannerView}
              search={taskSearch}
              onSearchChange={setTaskSearch}
              sort={taskSort}
              onSortChange={setTaskSort}
              hiddenColumns={hiddenColumns}
              onHiddenColumnsChange={handleUpdateHiddenColumns}
              propertiesOpen={plannerPropertiesOpen}
              onPropertiesToggle={setPlannerPropertiesOpen}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onSelectTask={handleSelectTask}
              savingIds={taskSavingIds}
            />
          ) : (
            <HabitTrackerPanel
              habits={habitsForView}
              allHabits={activeHabits}
              loading={habitsLoading}
              view={habitView}
              onViewChange={setHabitView}
              hiddenColumns={hiddenColumns}
              onHiddenColumnsChange={handleUpdateHiddenColumns}
              propertiesOpen={habitPropertiesOpen}
              onPropertiesToggle={setHabitPropertiesOpen}
              completionKeySet={habitCompletionKeySet}
              streaksById={habitStreaksByHabitId}
              savingCompletionKeys={habitCompletionSavingKeys}
              weekDateKeys={weekDateKeys}
              todayKey={todayLocalKey}
              todayDate={today}
              onToggleCompletion={handleHabitCompletionToggle}
              onCreateHabit={handleCreateHabit}
              onUpdateHabit={handleUpdateHabit}
              onSelectHabit={handleSelectHabit}
              savingIds={habitSavingIds}
            />
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
    if (activeSection === "notes") return renderNotesView();
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
      {createModalOpen && (
        <CreateListModal
          template={createTemplate}
          name={createName}
          error={createError}
          saving={createSaving}
          onClose={() => setCreateModalOpen(false)}
          onSelect={(template) => {
            setCreateTemplate(template);
            setCreateName(
              template === "habit_tracker" ? "Habit Tracker" : "Planner Tasks",
            );
          }}
          onNameChange={setCreateName}
          onSubmit={handleCreateListSubmit}
        />
      )}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          saving={taskSavingIds.has(selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleUpdateTask}
        />
      )}
      {selectedHabit && (
        <HabitDetailsModal
          habit={selectedHabit}
          saving={habitSavingIds.has(selectedHabit.id)}
          onClose={() => setSelectedHabitId(null)}
          onUpdate={handleUpdateHabit}
        />
      )}
      {convertTarget && (
        <ConvertNoteModal
          title={convertTitle}
          dueDate={convertDueDate}
          subject={convertSubject}
          onTitleChange={setConvertTitle}
          onDueDateChange={setConvertDueDate}
          onSubjectChange={setConvertSubject}
          onClose={() => setConvertTarget(null)}
          onSubmit={handleConvertConfirm}
        />
      )}
      {toast && (
        <ToastBanner
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.action}
          onClose={() => setToast(null)}
        />
      )}
      <SubjectDatalist />
    </div>
  );
}

type ColumnMeta = {
  key: string;
  label: string;
  width: string;
  locked?: boolean;
};

const TASK_TABLE_COLUMNS: ColumnMeta[] = [
  // Keep the primary name column always visible to match existing table patterns.
  { key: "name", label: "Name", width: "minmax(240px,1.6fr)", locked: true },
  { key: "status", label: "Status", width: "130px" },
  { key: "due", label: "Due date", width: "180px" },
  { key: "subject", label: "Subject", width: "160px" },
  { key: "priority", label: "Priority", width: "120px" },
  { key: "estimate", label: "Est. minutes", width: "120px" },
  { key: "resource", label: "Resource", width: "minmax(180px,1fr)" },
  { key: "notes", label: "Notes", width: "minmax(200px,1.2fr)" },
];

const HABIT_TABLE_COLUMNS: ColumnMeta[] = [
  // Keep the primary name column always visible to match existing table patterns.
  { key: "name", label: "Habit name", width: "minmax(220px,1.6fr)", locked: true },
  { key: "done", label: "Done today", width: "110px" },
  { key: "streak", label: "Streak", width: "90px" },
  { key: "schedule", label: "Schedule", width: "150px" },
  { key: "target", label: "Target", width: "100px" },
  { key: "notes", label: "Notes", width: "minmax(180px,1fr)" },
  { key: "resource", label: "Resource", width: "minmax(180px,1fr)" },
  { key: "start", label: "Start date", width: "130px" },
  { key: "status", label: "Status", width: "120px" },
];

const WEEKDAY_NAMES_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getVisibleColumns(columns: ColumnMeta[], hiddenColumns: string[]) {
  const hiddenSet = new Set(hiddenColumns);
  return columns.filter((column) => column.locked || !hiddenSet.has(column.key));
}

function buildGridTemplate(columns: ColumnMeta[], hiddenColumns: string[]) {
  return getVisibleColumns(columns, hiddenColumns)
    .map((column) => column.width)
    .join(" ");
}

function getDueDateInput(task: StudentTask) {
  if (task.dueDate) return task.dueDate;
  if (task.dueAt) {
    const date = new Date(task.dueAt);
    if (!Number.isNaN(date.getTime())) {
      return toLocalDateKey(date);
    }
  }
  return "";
}

function getDueTimeInput(task: StudentTask) {
  if (!task.dueAt) return "";
  const date = new Date(task.dueAt);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildDuePayload(dateValue: string, timeValue: string) {
  if (!dateValue) {
    return { dueDate: null, dueAt: null };
  }
  if (!timeValue) {
    return { dueDate: dateValue, dueAt: null };
  }
  const next = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(next.getTime())) {
    return { dueDate: dateValue, dueAt: null };
  }
  return { dueDate: dateValue, dueAt: next.toISOString() };
}

function formatScheduleSummary(habit: StudentHabit) {
  switch (habit.scheduleType) {
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "custom":
      return "Custom";
    default:
      return "Custom";
  }
}

function formatScheduleDetail(habit: StudentHabit) {
  if (habit.scheduleType !== "custom") {
    return formatScheduleSummary(habit);
  }
  const days = habit.scheduleDays ?? [];
  const labels = days
    .map((day) => WEEKDAY_NAMES_SHORT[day] ?? "")
    .filter(Boolean);
  if (!labels.length) return "Custom";
  return `Custom (${labels.join(", ")})`;
}

type PropertiesPanelProps = {
  columns: ColumnMeta[];
  hiddenColumns: string[];
  onChange: (nextHidden: string[]) => void;
};

function PropertiesPanel({
  columns,
  hiddenColumns,
  onChange,
}: PropertiesPanelProps) {
  const hiddenSet = new Set(hiddenColumns);

  function toggleColumn(key: string, locked?: boolean) {
    if (locked) return;
    const next = new Set(hiddenColumns);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0c16] p-4 text-xs">
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">
        Properties
      </p>
      <div className="mt-3 space-y-2">
        {columns.map((column) => {
          const visible = column.locked || !hiddenSet.has(column.key);
          return (
            <label
              key={column.key}
              className={classNames(
                "flex items-center gap-2",
                column.locked && "cursor-not-allowed text-white/40",
              )}
            >
              <input
                type="checkbox"
                checked={visible}
                disabled={column.locked}
                onChange={() => toggleColumn(column.key, column.locked)}
                className="h-3.5 w-3.5 rounded border border-white/20 bg-black/40 text-white/80"
              />
              <span>{column.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

type PlannerTasksPanelProps = {
  tasks: StudentTask[];
  loading: boolean;
  view: PlannerViewFilter;
  onViewChange: (view: PlannerViewFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: "due" | "priority";
  onSortChange: (value: "due" | "priority") => void;
  hiddenColumns: string[];
  onHiddenColumnsChange: (nextHidden: string[]) => void;
  propertiesOpen: boolean;
  onPropertiesToggle: (open: boolean) => void;
  onCreateTask: (draft: TaskDraft) => Promise<void>;
  onUpdateTask: (taskId: string, updates: TaskUpdatePayload) => Promise<void>;
  onSelectTask: (taskId: string) => void;
  savingIds: Set<string>;
};

function PlannerTasksPanel({
  tasks,
  loading,
  view,
  onViewChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  hiddenColumns,
  onHiddenColumnsChange,
  propertiesOpen,
  onPropertiesToggle,
  onCreateTask,
  onUpdateTask,
  onSelectTask,
  savingIds,
}: PlannerTasksPanelProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const visibleColumns = useMemo(
    () => getVisibleColumns(TASK_TABLE_COLUMNS, hiddenColumns),
    [hiddenColumns],
  );
  const gridTemplate = useMemo(
    () => buildGridTemplate(TASK_TABLE_COLUMNS, hiddenColumns),
    [hiddenColumns],
  );

  async function handleCreate() {
    if (creating) return;
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setCreateError("Name is required.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      await onCreateTask({ title: trimmed });
      setDraftTitle("");
      inputRef.current?.focus();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create task",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { id: "today", label: "Today" },
            { id: "next", label: "Next" },
            { id: "projects", label: "Projects" },
            { id: "done", label: "Done" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onViewChange(tab.id as PlannerViewFilter)}
              className={classNames(
                "rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                view === tab.id
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/10 text-white/50 hover:border-white/25 hover:bg-white/5 hover:text-white/80",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search tasks..."
              className="w-40 bg-transparent text-xs text-white/80 outline-none placeholder:text-white/40 md:w-56"
            />
          </div>
          <select
            value={sort}
            onChange={(event) =>
              onSortChange(event.target.value as "due" | "priority")
            }
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/80 outline-none"
          >
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
          </select>
          <button
            type="button"
            onClick={() => onPropertiesToggle(!propertiesOpen)}
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:border-white/30 hover:text-white"
          >
            Properties
          </button>
        </div>
      </div>

      {propertiesOpen && (
        <div className="flex justify-end">
          <PropertiesPanel
            columns={TASK_TABLE_COLUMNS}
            hiddenColumns={hiddenColumns}
            onChange={onHiddenColumnsChange}
          />
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0c0c16]">
        <div className="overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
          <div className="min-w-[980px]">
            <div
              className="grid h-11 items-center border-b border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {visibleColumns.map((column) => (
                <div key={column.key} className="flex h-full items-center px-3">
                  {column.label}
                </div>
              ))}
            </div>
            <div className="divide-y divide-white/10">
              {loading && tasks.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/50">
                  Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/50">
                  No tasks yet.
                </div>
              ) : (
                tasks.map((task) => (
                  <PlannerTaskRow
                    key={task.id}
                    task={task}
                    visibleColumns={visibleColumns}
                    gridTemplate={gridTemplate}
                    onUpdate={onUpdateTask}
                    onSelect={() => onSelectTask(task.id)}
                    isSaving={savingIds.has(task.id)}
                  />
                ))
              )}
              <div
                className="grid h-11 items-center text-sm text-white/60"
                style={{ gridTemplateColumns: gridTemplate }}
                onClick={() => inputRef.current?.focus()}
              >
                {visibleColumns.map((column) => {
                  if (column.key !== "name") {
                    return <div key={column.key} className="px-3" />;
                  }
                  return (
                    <div key={column.key} className="flex h-full items-center px-3">
                      <input
                        ref={inputRef}
                        value={draftTitle}
                        disabled={creating}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleCreate();
                          }
                        }}
                        placeholder="+ New task"
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white/80 outline-none transition placeholder:text-white/40 focus:border-white/20 focus:bg-white/5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {createError && <p className="text-xs text-rose-300">{createError}</p>}
    </div>
  );
}

type PlannerTaskRowProps = {
  task: StudentTask;
  visibleColumns: ColumnMeta[];
  gridTemplate: string;
  onUpdate: (taskId: string, updates: TaskUpdatePayload) => Promise<void>;
  onSelect: () => void;
  isSaving: boolean;
};

function PlannerTaskRow({
  task,
  visibleColumns,
  gridTemplate,
  onUpdate,
  onSelect,
  isSaving,
}: PlannerTaskRowProps) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<StudentTaskStatus>(task.status);
  const [priority, setPriority] = useState<StudentTaskPriority>(task.priority);
  const [subject, setSubject] = useState(task.subject ?? "");
  const [estimate, setEstimate] = useState(
    task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
      ? String(task.estimatedMinutes)
      : "",
  );
  const [resourceUrl, setResourceUrl] = useState(task.resourceUrl ?? "");
  const [dueDate, setDueDate] = useState(getDueDateInput(task));
  const [dueTime, setDueTime] = useState(getDueTimeInput(task));

  useEffect(() => {
    setTitle(task.title);
    setStatus(task.status);
    setPriority(task.priority);
    setSubject(task.subject ?? "");
    setEstimate(
      task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
        ? String(task.estimatedMinutes)
        : "",
    );
    setResourceUrl(task.resourceUrl ?? "");
    setDueDate(getDueDateInput(task));
    setDueTime(getDueTimeInput(task));
  }, [task]);

  async function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(task.title);
      return;
    }
    if (trimmed !== task.title) {
      await onUpdate(task.id, { title: trimmed });
    }
  }

  async function commitSubject() {
    const trimmed = subject.trim();
    const nextValue = trimmed ? trimmed : null;
    if ((task.subject ?? null) !== nextValue) {
      await onUpdate(task.id, { subject: nextValue });
    }
  }

  async function commitEstimate() {
    const trimmed = estimate.trim();
    const nextValue = trimmed ? Number(trimmed) : null;
    if (trimmed && Number.isNaN(nextValue)) {
      setEstimate(
        task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
          ? String(task.estimatedMinutes)
          : "",
      );
      return;
    }
    if ((task.estimatedMinutes ?? null) !== nextValue) {
      await onUpdate(task.id, { estimatedMinutes: nextValue });
    }
  }

  async function commitResource() {
    const trimmed = resourceUrl.trim();
    const nextValue = trimmed ? trimmed : null;
    if ((task.resourceUrl ?? null) !== nextValue) {
      await onUpdate(task.id, { resourceUrl: nextValue });
    }
  }

  async function commitDue() {
    const currentDate = getDueDateInput(task);
    const currentTime = getDueTimeInput(task);
    if (currentDate === dueDate && currentTime === dueTime) return;
    await onUpdate(task.id, buildDuePayload(dueDate, dueTime));
  }

  const notesPreview = task.description?.trim() || "No notes";

  return (
    <div
      className={classNames(
        "grid h-11 items-center text-sm text-white/80 transition hover:bg-white/5",
        task.status === "done" && "text-white/40",
        isSaving && "opacity-60",
      )}
      style={{ gridTemplateColumns: gridTemplate }}
      onClick={onSelect}
    >
      {visibleColumns.map((column) => {
        switch (column.key) {
          case "name":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <input
                  value={title}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={commitTitle}
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white/80 outline-none transition focus:border-white/20 focus:bg-white/5"
                />
              </div>
            );
          case "status":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <select
                  value={status}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const next = event.target.value as StudentTaskStatus;
                    setStatus(next);
                    if (next !== task.status) {
                      onUpdate(task.id, { status: next });
                    }
                  }}
                  className="h-8 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                >
                  {TASK_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {statusLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
            );
          case "due":
            return (
              <div key={column.key} className="flex h-full items-center gap-2 px-3">
                <input
                  type="date"
                  value={dueDate}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDueDate(next);
                    if (!next) {
                      setDueTime("");
                    }
                  }}
                  onBlur={commitDue}
                  className="h-8 rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                />
                <input
                  type="time"
                  value={dueTime}
                  disabled={isSaving || !dueDate}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setDueTime(event.target.value)}
                  onBlur={commitDue}
                  className="h-8 w-[88px] rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                />
              </div>
            );
          case "subject":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <input
                  list="subject-options"
                  value={subject}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setSubject(event.target.value)}
                  onBlur={commitSubject}
                  className="h-8 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                  placeholder="Subject"
                />
              </div>
            );
          case "priority":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <select
                  value={priority}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const next = event.target.value as StudentTaskPriority;
                    setPriority(next);
                    if (next !== task.priority) {
                      onUpdate(task.id, { priority: next });
                    }
                  }}
                  className="h-8 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                >
                  {TASK_PRIORITIES.map((option) => (
                    <option key={option} value={option}>
                      {priorityLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
            );
          case "estimate":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <input
                  type="number"
                  min={0}
                  value={estimate}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setEstimate(event.target.value)}
                  onBlur={commitEstimate}
                  className="h-8 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                />
              </div>
            );
          case "resource":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <input
                  value={resourceUrl}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setResourceUrl(event.target.value)}
                  onBlur={commitResource}
                  placeholder="https://"
                  className="h-8 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                />
              </div>
            );
          case "notes":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <span className="truncate text-xs text-white/50">
                  {notesPreview}
                </span>
              </div>
            );
          default:
            return <div key={column.key} className="px-3" />;
        }
      })}
    </div>
  );
}

type HabitTrackerPanelProps = {
  habits: StudentHabit[];
  allHabits: StudentHabit[];
  loading: boolean;
  view: HabitViewFilter;
  onViewChange: (view: HabitViewFilter) => void;
  hiddenColumns: string[];
  onHiddenColumnsChange: (nextHidden: string[]) => void;
  propertiesOpen: boolean;
  onPropertiesToggle: (open: boolean) => void;
  completionKeySet: Set<string>;
  streaksById: Map<string, number>;
  savingCompletionKeys: Set<string>;
  weekDateKeys: string[];
  todayKey: string;
  todayDate: Date;
  onToggleCompletion: (habitId: string, dateKey: string, next: boolean) => void;
  onCreateHabit: (name: string) => Promise<void>;
  onUpdateHabit: (habitId: string, updates: HabitUpdatePayload) => Promise<void>;
  onSelectHabit: (habitId: string) => void;
  savingIds: Set<string>;
};

function HabitTrackerPanel({
  habits,
  allHabits,
  loading,
  view,
  onViewChange,
  hiddenColumns,
  onHiddenColumnsChange,
  propertiesOpen,
  onPropertiesToggle,
  completionKeySet,
  streaksById,
  savingCompletionKeys,
  weekDateKeys,
  todayKey,
  todayDate,
  onToggleCompletion,
  onCreateHabit,
  onUpdateHabit,
  onSelectHabit,
  savingIds,
}: HabitTrackerPanelProps) {
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const visibleColumns = useMemo(
    () => getVisibleColumns(HABIT_TABLE_COLUMNS, hiddenColumns),
    [hiddenColumns],
  );
  const gridTemplate = useMemo(
    () => buildGridTemplate(HABIT_TABLE_COLUMNS, hiddenColumns),
    [hiddenColumns],
  );
  const weekDates = useMemo(
    () =>
      weekDateKeys.map((key) => {
        const date = new Date(`${key}T00:00:00`);
        return Number.isNaN(date.getTime()) ? new Date() : date;
      }),
    [weekDateKeys],
  );
  const rows = view === "week" ? allHabits : habits;

  async function handleCreate() {
    if (creating) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      setCreateError("Name is required.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      await onCreateHabit(trimmed);
      setDraftName("");
      inputRef.current?.focus();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create habit",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "Week" },
            { id: "all", label: "All habits" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onViewChange(tab.id as HabitViewFilter)}
              className={classNames(
                "rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                view === tab.id
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/10 text-white/50 hover:border-white/25 hover:bg-white/5 hover:text-white/80",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 justify-end">
          <button
            type="button"
            onClick={() => onPropertiesToggle(!propertiesOpen)}
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:border-white/30 hover:text-white"
          >
            Properties
          </button>
        </div>
      </div>

      {propertiesOpen && (
        <div className="flex justify-end">
          <PropertiesPanel
            columns={HABIT_TABLE_COLUMNS}
            hiddenColumns={hiddenColumns}
            onChange={onHiddenColumnsChange}
          />
        </div>
      )}

      {view === "week" ? (
        <div className="rounded-2xl border border-white/10 bg-[#0c0c16]">
          <div className="overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
            <div className="min-w-[820px]">
              <div className="grid h-11 grid-cols-[minmax(220px,1.5fr)_repeat(7,70px)_100px] items-center border-b border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                <div className="flex h-full items-center px-3">Habit</div>
                {WEEKDAY_NAMES_MON.map((label) => (
                  <div key={label} className="flex h-full items-center justify-center">
                    {label}
                  </div>
                ))}
                <div className="flex h-full items-center justify-center">Streak</div>
              </div>
              <div className="divide-y divide-white/10">
                {loading && rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-white/50">
                    Loading habits...
                  </div>
                ) : rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-white/50">
                    No habits yet.
                  </div>
                ) : (
                  rows.map((habit) => (
                    <div
                      key={habit.id}
                      className={classNames(
                        "grid h-11 grid-cols-[minmax(220px,1.5fr)_repeat(7,70px)_100px] items-center text-sm text-white/80 transition hover:bg-white/5",
                        habit.status === "paused" && "text-white/40",
                      )}
                      onClick={() => onSelectHabit(habit.id)}
                    >
                      <div className="flex h-full items-center px-3">
                        <span className="truncate">{habit.name}</span>
                      </div>
                      {weekDateKeys.map((dateKey, index) => {
                        const date = weekDates[index];
                        const completionKey = makeHabitCompletionKey(
                          habit.id,
                          dateKey,
                        );
                        const completed = completionKeySet.has(completionKey);
                        const saving = savingCompletionKeys.has(completionKey);
                        const scheduled = isHabitScheduledOn(habit, date);
                        const disabled =
                          saving || habit.status === "paused" || !scheduled;
                        return (
                          <div
                            key={dateKey}
                            className="flex h-full items-center justify-center"
                          >
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleCompletion(
                                  habit.id,
                                  dateKey,
                                  !completed,
                                );
                              }}
                              className={classNames(
                                "flex h-7 w-7 items-center justify-center rounded-full border text-white/70 transition",
                                completed
                                  ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                                  : "border-white/10 bg-black/20",
                                disabled && "opacity-40",
                              )}
                            >
                              {completed ? (
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              ) : (
                                <Circle className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex h-full items-center justify-center text-xs text-white/60">
                        {streaksById.get(habit.id) ?? 0}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#0c0c16]">
          <div className="overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
            <div className="min-w-[980px]">
              <div
                className="grid h-11 items-center border-b border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {visibleColumns.map((column) => (
                  <div key={column.key} className="flex h-full items-center px-3">
                    {column.label}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-white/10">
                {loading && rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-white/50">
                    Loading habits...
                  </div>
                ) : rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-white/50">
                    No habits yet.
                  </div>
                ) : (
                  rows.map((habit) => (
                    <HabitTableRow
                      key={habit.id}
                      habit={habit}
                      visibleColumns={visibleColumns}
                      gridTemplate={gridTemplate}
                      completionKeySet={completionKeySet}
                      streak={streaksById.get(habit.id) ?? 0}
                      savingCompletionKeys={savingCompletionKeys}
                      todayKey={todayKey}
                      todayDate={todayDate}
                      onToggleCompletion={onToggleCompletion}
                      onUpdate={onUpdateHabit}
                      onSelect={() => onSelectHabit(habit.id)}
                      isSaving={savingIds.has(habit.id)}
                    />
                  ))
                )}
                <div
                  className="grid h-11 items-center text-sm text-white/60"
                  style={{ gridTemplateColumns: gridTemplate }}
                  onClick={() => inputRef.current?.focus()}
                >
                  {visibleColumns.map((column) => {
                    if (column.key !== "name") {
                      return <div key={column.key} className="px-3" />;
                    }
                    return (
                      <div key={column.key} className="flex h-full items-center px-3">
                        <input
                          ref={inputRef}
                          value={draftName}
                          disabled={creating}
                          onChange={(event) => setDraftName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleCreate();
                            }
                          }}
                          placeholder="+ New habit"
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white/80 outline-none transition placeholder:text-white/40 focus:border-white/20 focus:bg-white/5"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {createError && <p className="text-xs text-rose-300">{createError}</p>}
    </div>
  );
}

type HabitTableRowProps = {
  habit: StudentHabit;
  visibleColumns: ColumnMeta[];
  gridTemplate: string;
  completionKeySet: Set<string>;
  streak: number;
  savingCompletionKeys: Set<string>;
  todayKey: string;
  todayDate: Date;
  onToggleCompletion: (habitId: string, dateKey: string, next: boolean) => void;
  onUpdate: (habitId: string, updates: HabitUpdatePayload) => Promise<void>;
  onSelect: () => void;
  isSaving: boolean;
};

function HabitTableRow({
  habit,
  visibleColumns,
  gridTemplate,
  completionKeySet,
  streak,
  savingCompletionKeys,
  todayKey,
  todayDate,
  onToggleCompletion,
  onUpdate,
  onSelect,
  isSaving,
}: HabitTableRowProps) {
  const [name, setName] = useState(habit.name);
  const [status, setStatus] = useState<HabitStatus>(habit.status);

  useEffect(() => {
    setName(habit.name);
    setStatus(habit.status);
  }, [habit]);

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(habit.name);
      return;
    }
    if (trimmed !== habit.name) {
      await onUpdate(habit.id, { name: trimmed });
    }
  }

  const completionKey = makeHabitCompletionKey(habit.id, todayKey);
  const doneToday = completionKeySet.has(completionKey);
  const saving = savingCompletionKeys.has(completionKey);
  const scheduledToday = isHabitScheduledOn(habit, todayDate);
  const disabledToggle =
    saving || habit.status === "paused" || !scheduledToday;
  const notesPreview = habit.notes?.trim() || "No notes";
  const resourcePreview = habit.resourceUrl?.trim() || "No link";

  return (
    <div
      className={classNames(
        "grid h-11 items-center text-sm text-white/80 transition hover:bg-white/5",
        habit.status === "paused" && "text-white/40",
        isSaving && "opacity-60",
      )}
      style={{ gridTemplateColumns: gridTemplate }}
      onClick={onSelect}
    >
      {visibleColumns.map((column) => {
        switch (column.key) {
          case "name":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <input
                  value={name}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={commitName}
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white/80 outline-none transition focus:border-white/20 focus:bg-white/5"
                />
              </div>
            );
          case "done":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <label
                  className={classNames(
                    "flex items-center gap-2 text-xs text-white/70",
                    disabledToggle && "opacity-50",
                  )}
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={doneToday}
                    disabled={disabledToggle}
                    onChange={(event) =>
                      onToggleCompletion(
                        habit.id,
                        todayKey,
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4 rounded border border-white/30 bg-black/40 text-emerald-300 accent-emerald-400"
                  />
                  {doneToday ? "Done" : "Not yet"}
                </label>
              </div>
            );
          case "streak":
            return (
              <div key={column.key} className="flex h-full items-center px-3 text-xs text-white/60">
                {streak}
              </div>
            );
          case "schedule":
            return (
              <div
                key={column.key}
                className="flex h-full items-center px-3 text-xs text-white/60"
                title={formatScheduleDetail(habit)}
              >
                {formatScheduleSummary(habit)}
              </div>
            );
          case "target":
            return (
              <div key={column.key} className="flex h-full items-center px-3 text-xs text-white/60">
                {habit.target ?? "-"}
              </div>
            );
          case "notes":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <span className="truncate text-xs text-white/50">
                  {notesPreview}
                </span>
              </div>
            );
          case "resource":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <span className="truncate text-xs text-white/50">
                  {resourcePreview}
                </span>
              </div>
            );
          case "start":
            return (
              <div key={column.key} className="flex h-full items-center px-3 text-xs text-white/60">
                {habit.startDate}
              </div>
            );
          case "status":
            return (
              <div key={column.key} className="flex h-full items-center px-3">
                <select
                  value={status}
                  disabled={isSaving}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const next = event.target.value as HabitStatus;
                    setStatus(next);
                    if (next !== habit.status) {
                      onUpdate(habit.id, { status: next });
                    }
                  }}
                  className="h-8 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-white/80 outline-none"
                >
                  {HABIT_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {option === "active" ? "Active" : "Paused"}
                    </option>
                  ))}
                </select>
              </div>
            );
          default:
            return <div key={column.key} className="px-3" />;
        }
      })}
    </div>
  );
}

type TaskDetailsModalProps = {
  task: StudentTask;
  saving: boolean;
  onClose: () => void;
  onUpdate: (taskId: string, updates: TaskUpdatePayload) => Promise<void>;
};

function TaskDetailsModal({ task, saving, onClose, onUpdate }: TaskDetailsModalProps) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<StudentTaskStatus>(task.status);
  const [priority, setPriority] = useState<StudentTaskPriority>(task.priority);
  const [subject, setSubject] = useState(task.subject ?? "");
  const [estimate, setEstimate] = useState(
    task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
      ? String(task.estimatedMinutes)
      : "",
  );
  const [resourceUrl, setResourceUrl] = useState(task.resourceUrl ?? "");
  const [notes, setNotes] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(getDueDateInput(task));
  const [dueTime, setDueTime] = useState(getDueTimeInput(task));

  useEffect(() => {
    setTitle(task.title);
    setStatus(task.status);
    setPriority(task.priority);
    setSubject(task.subject ?? "");
    setEstimate(
      task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
        ? String(task.estimatedMinutes)
        : "",
    );
    setResourceUrl(task.resourceUrl ?? "");
    setNotes(task.description ?? "");
    setDueDate(getDueDateInput(task));
    setDueTime(getDueTimeInput(task));
  }, [task]);

  async function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(task.title);
      return;
    }
    if (trimmed !== task.title) {
      await onUpdate(task.id, { title: trimmed });
    }
  }

  async function commitNotes() {
    const nextValue = notes.trim() ? notes : null;
    if ((task.description ?? null) !== nextValue) {
      await onUpdate(task.id, { description: nextValue });
    }
  }

  async function commitSubject() {
    const trimmed = subject.trim();
    const nextValue = trimmed ? trimmed : null;
    if ((task.subject ?? null) !== nextValue) {
      await onUpdate(task.id, { subject: nextValue });
    }
  }

  async function commitEstimate() {
    const trimmed = estimate.trim();
    const nextValue = trimmed ? Number(trimmed) : null;
    if (trimmed && Number.isNaN(nextValue)) {
      setEstimate(
        task.estimatedMinutes !== null && task.estimatedMinutes !== undefined
          ? String(task.estimatedMinutes)
          : "",
      );
      return;
    }
    if ((task.estimatedMinutes ?? null) !== nextValue) {
      await onUpdate(task.id, { estimatedMinutes: nextValue });
    }
  }

  async function commitResource() {
    const trimmed = resourceUrl.trim();
    const nextValue = trimmed ? trimmed : null;
    if ((task.resourceUrl ?? null) !== nextValue) {
      await onUpdate(task.id, { resourceUrl: nextValue });
    }
  }

  async function commitDue() {
    const currentDate = getDueDateInput(task);
    const currentTime = getDueTimeInput(task);
    if (currentDate === dueDate && currentTime === dueTime) return;
    await onUpdate(task.id, buildDuePayload(dueDate, dueTime));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0b16] p-6 text-sm text-white">
        <div className="flex items-center justify-between gap-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold text-white outline-none focus:border-white/20 focus:bg-white/5"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Status
            <select
              value={status}
              onChange={(event) => {
                const next = event.target.value as StudentTaskStatus;
                setStatus(next);
                if (next !== task.status) {
                  onUpdate(task.id, { status: next });
                }
              }}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            >
              {TASK_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Priority
            <select
              value={priority}
              onChange={(event) => {
                const next = event.target.value as StudentTaskPriority;
                setPriority(next);
                if (next !== task.priority) {
                  onUpdate(task.id, { priority: next });
                }
              }}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            >
              {TASK_PRIORITIES.map((option) => (
                <option key={option} value={option}>
                  {priorityLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Due date
            <div className="flex gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setDueDate(next);
                  if (!next) {
                    setDueTime("");
                  }
                }}
                onBlur={commitDue}
                className="h-9 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
              />
              <input
                type="time"
                value={dueTime}
                disabled={!dueDate}
                onChange={(event) => setDueTime(event.target.value)}
                onBlur={commitDue}
                className="h-9 w-32 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Subject
            <input
              list="subject-options"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              onBlur={commitSubject}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Est. minutes
            <input
              type="number"
              min={0}
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              onBlur={commitEstimate}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Resource
            <input
              value={resourceUrl}
              onChange={(event) => setResourceUrl(event.target.value)}
              onBlur={commitResource}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
        </div>
        <label className="mt-5 flex flex-col gap-1 text-xs text-white/50">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={commitNotes}
            rows={4}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        {saving && (
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-white/40">
            Saving...
          </p>
        )}
      </div>
    </div>
  );
}

type HabitDetailsModalProps = {
  habit: StudentHabit;
  saving: boolean;
  onClose: () => void;
  onUpdate: (habitId: string, updates: HabitUpdatePayload) => Promise<void>;
};

function HabitDetailsModal({
  habit,
  saving,
  onClose,
  onUpdate,
}: HabitDetailsModalProps) {
  const [name, setName] = useState(habit.name);
  const [scheduleType, setScheduleType] = useState<HabitScheduleType>(
    habit.scheduleType,
  );
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    habit.scheduleDays ?? [],
  );
  const [status, setStatus] = useState<HabitStatus>(habit.status);
  const [target, setTarget] = useState(
    habit.target !== null && habit.target !== undefined
      ? String(habit.target)
      : "",
  );
  const [notes, setNotes] = useState(habit.notes ?? "");
  const [resourceUrl, setResourceUrl] = useState(habit.resourceUrl ?? "");
  const [startDate, setStartDate] = useState(habit.startDate);

  useEffect(() => {
    setName(habit.name);
    setScheduleType(habit.scheduleType);
    setScheduleDays(habit.scheduleDays ?? []);
    setStatus(habit.status);
    setTarget(
      habit.target !== null && habit.target !== undefined
        ? String(habit.target)
        : "",
    );
    setNotes(habit.notes ?? "");
    setResourceUrl(habit.resourceUrl ?? "");
    setStartDate(habit.startDate);
  }, [habit]);

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(habit.name);
      return;
    }
    if (trimmed !== habit.name) {
      await onUpdate(habit.id, { name: trimmed });
    }
  }

  async function commitTarget() {
    const trimmed = target.trim();
    const nextValue = trimmed ? Number(trimmed) : null;
    if (trimmed && Number.isNaN(nextValue)) {
      setTarget(
        habit.target !== null && habit.target !== undefined
          ? String(habit.target)
          : "",
      );
      return;
    }
    if ((habit.target ?? null) !== nextValue) {
      await onUpdate(habit.id, { target: nextValue });
    }
  }

  async function commitNotes() {
    const nextValue = notes.trim() ? notes : null;
    if ((habit.notes ?? null) !== nextValue) {
      await onUpdate(habit.id, { notes: nextValue });
    }
  }

  async function commitResource() {
    const trimmed = resourceUrl.trim();
    const nextValue = trimmed ? trimmed : null;
    if ((habit.resourceUrl ?? null) !== nextValue) {
      await onUpdate(habit.id, { resourceUrl: nextValue });
    }
  }

  async function commitStartDate() {
    if (!startDate) {
      setStartDate(habit.startDate);
      return;
    }
    if (startDate !== habit.startDate) {
      await onUpdate(habit.id, { startDate });
    }
  }

  async function handleScheduleTypeChange(next: HabitScheduleType) {
    setScheduleType(next);
    if (next === "custom") {
      const nextDays = scheduleDays.length ? scheduleDays : [1, 2, 3, 4, 5];
      setScheduleDays(nextDays);
      await onUpdate(habit.id, {
        scheduleType: next,
        scheduleDays: nextDays,
      });
    } else {
      await onUpdate(habit.id, {
        scheduleType: next,
        scheduleDays: null,
      });
    }
  }

  async function toggleScheduleDay(day: number) {
    if (scheduleType !== "custom") return;
    if (scheduleDays.length === 1 && scheduleDays.includes(day)) return;
    const next = scheduleDays.includes(day)
      ? scheduleDays.filter((entry) => entry !== day)
      : [...scheduleDays, day].sort((a, b) => a - b);
    setScheduleDays(next);
    await onUpdate(habit.id, { scheduleDays: next });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0b16] p-6 text-sm text-white">
        <div className="flex items-center justify-between gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold text-white outline-none focus:border-white/20 focus:bg-white/5"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Schedule
            <select
              value={scheduleType}
              onChange={(event) =>
                handleScheduleTypeChange(event.target.value as HabitScheduleType)
              }
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            >
              {HABIT_SCHEDULE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option === "daily"
                    ? "Daily"
                    : option === "weekdays"
                      ? "Weekdays"
                      : "Custom"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Status
            <select
              value={status}
              onChange={(event) => {
                const next = event.target.value as HabitStatus;
                setStatus(next);
                if (next !== habit.status) {
                  onUpdate(habit.id, { status: next });
                }
              }}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            >
              {HABIT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option === "active" ? "Active" : "Paused"}
                </option>
              ))}
            </select>
          </label>
          {scheduleType === "custom" && (
            <div className="md:col-span-2">
              <p className="text-xs text-white/50">Custom days</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAY_NAMES_SHORT.map((label, index) => {
                  const selected = scheduleDays.includes(index);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleScheduleDay(index)}
                      className={classNames(
                        "rounded-lg border px-3 py-1 text-xs uppercase tracking-[0.2em]",
                        selected
                          ? "border-white bg-white/10 text-white"
                          : "border-white/10 text-white/50 hover:border-white/30 hover:text-white",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Target
            <input
              type="number"
              min={0}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              onBlur={commitTarget}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              onBlur={commitStartDate}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50 md:col-span-2">
            Resource
            <input
              value={resourceUrl}
              onChange={(event) => setResourceUrl(event.target.value)}
              onBlur={commitResource}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
        </div>
        <label className="mt-5 flex flex-col gap-1 text-xs text-white/50">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={commitNotes}
            rows={4}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        {saving && (
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-white/40">
            Saving...
          </p>
        )}
      </div>
    </div>
  );
}

type ConvertNoteModalProps = {
  title: string;
  dueDate: string;
  subject: string;
  onTitleChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function ConvertNoteModal({
  title,
  dueDate,
  subject,
  onTitleChange,
  onDueDateChange,
  onSubjectChange,
  onClose,
  onSubmit,
}: ConvertNoteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b16] p-6 text-sm text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Convert to task</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Title
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(event) => onDueDateChange(event.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">
            Subject
            <input
              list="subject-options"
              value={subject}
              onChange={(event) => onSubjectChange(event.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
            />
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
            onClick={onSubmit}
            className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20"
          >
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}

type CreateListModalProps = {
  template: TaskPrivateListType | null;
  name: string;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSelect: (template: TaskPrivateListType) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
};

function CreateListModal({
  template,
  name,
  error,
  saving,
  onClose,
  onSelect,
  onNameChange,
  onSubmit,
}: CreateListModalProps) {
  const templates: Array<{
    id: TaskPrivateListType;
    title: string;
    subtitle: string;
    icon: string;
  }> = [
    {
      id: "planner_tasks",
      title: "Planner Tasks",
      subtitle: "Assignments, exams, projects — organized.",
      icon: "🗂️",
    },
    {
      id: "habit_tracker",
      title: "Habit Tracker",
      subtitle: "Daily habits with real streaks.",
      icon: "🔥",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0b16] p-6 text-sm text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create new</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {templates.map((item) => {
            const isActive = template === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={classNames(
                  "rounded-2xl border p-4 text-left transition",
                  isActive
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-black/20 hover:border-white/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-base font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-2 w-full rounded-full bg-white/10" />
                  <div className="h-2 w-5/6 rounded-full bg-white/10" />
                  <div className="h-2 w-2/3 rounded-full bg-white/10" />
                </div>
              </button>
            );
          })}
        </div>
        {template && (
          <div className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-white/50">
              Name
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
              />
            </label>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="self-end rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      </div>
    </div>
  );
}

type ToastBannerProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
};

function ToastBanner({
  message,
  actionLabel,
  onAction,
  onClose,
}: ToastBannerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-[#0c0c16] px-4 py-3 text-sm text-white shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
      <span className="flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:border-white/40"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-white/50 hover:text-white"
      >
        Close
      </button>
    </div>
  );
}

function SubjectDatalist() {
  return (
    <datalist id="subject-options">
      {SUBJECT_OPTIONS.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
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
