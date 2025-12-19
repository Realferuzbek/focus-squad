"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  StudentTask,
  TaskCalendar,
  TaskCalendarEvent as PersistedEvent,
} from "@/lib/taskSchedulerTypes";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  List as ListIcon,
  MoreHorizontal,
} from "lucide-react";
import { generateHabitInstances } from "@/lib/taskSchedulerHabits";

const START_HOUR = 1;
const END_HOUR = 24;
const TIME_GUTTER_W = 72; // px (tune to match Notion)
const ALLDAY_MIN_H = 28; // px (tune to match Notion)
const ALLDAY_PILL_H = 18;
const ALLDAY_PILL_GAP = 4;
const ALLDAY_ROW_PADDING = 4;
const HOUR_ROW_H = 64; // px (use existing if already close)

const START_MINUTES = START_HOUR * 60;
const END_MINUTES = END_HOUR * 60;
const GRID_TEMPLATE_COLUMNS = `${TIME_GUTTER_W}px repeat(7, minmax(0, 1fr))`;
const GRID_HEIGHT_PX = (END_HOUR - START_HOUR) * HOUR_ROW_H;
const GRID_COLUMNS_STYLE: React.CSSProperties = {
  gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
};
const MIN_DURATION_MINUTES = 30;
const GRID_SNAP_MINUTES = 15;
const QUICK_CREATE_DURATION_MINUTES = 60;
const QUICK_CREATE_MAX_LOOKAHEAD_DAYS = 30;
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const EVENT_COLORS = ["#9b7bff", "#f472b6", "#22d3ee", "#34d399", "#facc15"];
const DEFAULT_CALENDAR_COLOR = EVENT_COLORS[0];

type CalendarEvent = {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  isAllDay: boolean;
  color: string;
  taskId: string | null;
  calendarId: string | null;
  description: string | null;
  eventKind: PersistedEvent["eventKind"] | "habit";
  readOnly?: boolean;
  isDraft?: boolean;
  isVirtual?: boolean;
};

type TimedRange = {
  startISO: string;
  endISO: string;
};

type MinuteRange = {
  start: number;
  end: number;
};

type EditorState = {
  id: string | null;
  title: string;
  startISO: string;
  endISO: string;
  isAllDay: boolean;
  position: { x: number; y: number };
  taskId: string | null;
  calendarId: string | null;
  description: string;
  lastTimedRange: TimedRange | null;
};

type CalendarEventInput = {
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  taskId: string | null;
  calendarId?: string | null;
  description?: string | null;
};

type CalendarCreatePayload = {
  name: string;
  color: string;
};

type CalendarPatchPayload = Partial<
  Pick<TaskCalendar, "name" | "color" | "isDefault" | "isVisible" | "sortOrder">
>;

type SurfaceView = "planner" | "calendar";

type TaskSchedulerCalendarProps = {
  events: PersistedEvent[];
  tasks: StudentTask[];
  loading?: boolean;
  calendars: TaskCalendar[];
  calendarsLoading?: boolean;
  onCreateCalendar: (input: CalendarCreatePayload) => Promise<void>;
  onUpdateCalendar: (
    calendarId: string,
    patch: CalendarPatchPayload,
  ) => Promise<void>;
  onDeleteCalendar: (calendarId: string) => Promise<void>;
  activeCalendarId?: string | null;
  onActiveCalendarChange?: (calendarId: string | null) => void;
  onCreateEvent: (input: CalendarEventInput) => Promise<void>;
  onUpdateEvent: (eventId: string, input: CalendarEventInput) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  focusTaskId?: string | null;
  onRequestFocusClear?: () => void;
};

type SelectionState = {
  dayIndex: number;
  originMinutes: number;
  currentMinutes: number;
  anchor: { x: number; y: number };
};

type ResizeState = {
  eventId: string;
  dayIndex: number;
  edge: "start" | "end";
};

function getStartOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameWeek(a: Date, b: Date) {
  return getStartOfWeek(a).getTime() === getStartOfWeek(b).getTime();
}

function createDateWithMinutes(day: Date, minutes: number) {
  const next = new Date(day);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(minutes);
  return next;
}

function getMinutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function clampMinutes(value: number) {
  return Math.max(START_MINUTES, Math.min(END_MINUTES, value));
}

function snapToIncrement(minutes: number, increment = GRID_SNAP_MINUTES) {
  return Math.round(minutes / increment) * increment;
}

function ceilToIncrement(minutes: number, increment = GRID_SNAP_MINUTES) {
  return Math.ceil(minutes / increment) * increment;
}

function minutesToPixels(minutes: number) {
  const relative = clampMinutes(minutes) - START_MINUTES;
  return (relative / 60) * HOUR_ROW_H;
}

function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized}${suffix}`;
}

function formatTimeString(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDurationLabel(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours > 0 && remaining > 0) {
    return `${hours}h ${remaining}min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remaining}min`;
}

function mergeMinuteRanges(ranges: MinuteRange[]) {
  if (ranges.length <= 1) return ranges;
  const merged: MinuteRange[] = [];
  ranges.forEach((range) => {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      return;
    }
    last.end = Math.max(last.end, range.end);
  });
  return merged;
}

function buildMergedTimedRangesForDay(events: CalendarEvent[], day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const ranges: MinuteRange[] = [];

  events.forEach((eventItem) => {
    if (eventItem.isAllDay) return;
    const start = new Date(eventItem.startISO);
    const end = new Date(eventItem.endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (end <= dayStart || start >= dayEnd) return;
    const startMinutes = clampMinutes(
      isSameDay(start, day) ? getMinutesFromDate(start) : START_MINUTES,
    );
    const endMinutes = clampMinutes(
      isSameDay(end, day) ? getMinutesFromDate(end) : END_MINUTES,
    );
    if (endMinutes <= startMinutes) return;
    ranges.push({ start: startMinutes, end: endMinutes });
  });

  ranges.sort((a, b) => a.start - b.start);
  return mergeMinuteRanges(ranges);
}

function findNextAvailableSlot(
  events: CalendarEvent[],
  from: Date,
  durationMinutes: number,
  maxLookaheadDays = QUICK_CREATE_MAX_LOOKAHEAD_DAYS,
) {
  const baseDay = startOfDay(from);
  const initialCursor = clampMinutes(
    ceilToIncrement(getMinutesFromDate(from), GRID_SNAP_MINUTES),
  );

  for (let offset = 0; offset <= maxLookaheadDays; offset += 1) {
    const day = addDays(baseDay, offset);
    const ranges = buildMergedTimedRangesForDay(events, day);
    let cursor = offset === 0 ? initialCursor : START_MINUTES;
    cursor = clampMinutes(cursor);
    if (cursor + durationMinutes > END_MINUTES) {
      continue;
    }

    for (const range of ranges) {
      if (range.end <= cursor) continue;
      if (range.start - cursor >= durationMinutes) {
        return { day, startMinutes: cursor };
      }
      cursor = range.end;
      if (cursor + durationMinutes > END_MINUTES) {
        break;
      }
    }

    if (END_MINUTES - cursor >= durationMinutes) {
      return { day, startMinutes: cursor };
    }
  }

  return {
    day: addDays(baseDay, maxLookaheadDays + 1),
    startMinutes: START_MINUTES,
  };
}

function buildMonthMatrix(monthReference: Date) {
  const first = new Date(
    monthReference.getFullYear(),
    monthReference.getMonth(),
    1,
  );
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  const weeks: Array<Array<Date>> = [];
  for (let week = 0; week < 6; week++) {
    const row: Date[] = [];
    for (let day = 0; day < 7; day++) {
      row.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

function mapPersistedEvent(
  event: PersistedEvent,
  calendarColorById: Map<string, string>,
  fallbackColor: string,
  defaultCalendarId: string | null,
): CalendarEvent {
  const calendarId = event.calendarId ?? null;
  const colorSourceId = calendarId ?? defaultCalendarId;
  const color =
    (colorSourceId ? calendarColorById.get(colorSourceId) : null) ??
    fallbackColor;
  return {
    id: event.id,
    title: event.title,
    startISO: event.start,
    endISO: event.end,
    isAllDay: event.isAllDay ?? false,
    color,
    taskId: event.taskId ?? null,
    calendarId,
    description: event.description ?? null,
    eventKind: event.eventKind,
  };
}

function buildEventInput(event: CalendarEvent): CalendarEventInput {
  return {
    title: event.title,
    start: event.startISO,
    end: event.endISO,
    isAllDay: event.isAllDay,
    taskId: event.taskId,
    calendarId: event.calendarId,
    description: event.description,
  };
}

function pickCalendarColor(usedColors: Set<string>) {
  return EVENT_COLORS.find((color) => !usedColors.has(color)) ?? EVENT_COLORS[0];
}

export default function TaskSchedulerCalendar({
  events: persistedEvents,
  tasks,
  loading = false,
  calendars = [],
  calendarsLoading = false,
  onCreateCalendar,
  onUpdateCalendar,
  onDeleteCalendar,
  activeCalendarId = null,
  onActiveCalendarChange,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  focusTaskId = null,
  onRequestFocusClear,
}: TaskSchedulerCalendarProps) {
  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    getStartOfWeek(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [miniCalendarCollapsed, setMiniCalendarCollapsed] = useState(false);
  const [openCalendarMenuId, setOpenCalendarMenuId] = useState<string | null>(
    null,
  );
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState(DEFAULT_CALENDAR_COLOR);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editCalendarId, setEditCalendarId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"rename" | "color" | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_CALENDAR_COLOR);
  const [editError, setEditError] = useState<string | null>(null);
  const [calendarActionId, setCalendarActionId] = useState<string | null>(null);
  const [calendarDeleteError, setCalendarDeleteError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const eventsRef = useRef<CalendarEvent[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingResizeRef = useRef<CalendarEvent | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [calendarSelectOpen, setCalendarSelectOpen] = useState(false);
  const [calendarSelectActiveIndex, setCalendarSelectActiveIndex] = useState(0);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(
    null,
  );
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(
    null,
  );
  const [savingEvent, setSavingEvent] = useState(false);
  const [activeSurfaceTab, setActiveSurfaceTab] = useState<SurfaceView | null>(
    null,
  );
  const [surfaceTabsReady, setSurfaceTabsReady] = useState(false);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const surfaceButtonsRef = useRef<
    Record<SurfaceView, HTMLButtonElement | null>
  >({
    planner: null,
    calendar: null,
  });
  const calendarMenuRef = useRef<HTMLDivElement | null>(null);
  const calendarMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const calendarSelectRef = useRef<HTMLDivElement | null>(null);

  const activeCalendar = useMemo(
    () =>
      calendars.find((calendar) => calendar.id === activeCalendarId) ?? null,
    [activeCalendarId, calendars],
  );
  const defaultCalendar = useMemo(
    () => calendars.find((calendar) => calendar.isDefault) ?? null,
    [calendars],
  );
  const fallbackCalendar = useMemo(
    () => calendars[0] ?? null,
    [calendars],
  );
  const quickCreateCalendar = defaultCalendar ?? fallbackCalendar;
  const visibleCalendars = useMemo(
    () => calendars.filter((calendar) => calendar.isVisible),
    [calendars],
  );
  const defaultCalendarColor =
    (defaultCalendar ?? fallbackCalendar)?.color ?? DEFAULT_CALENDAR_COLOR;
  const defaultCalendarId = defaultCalendar?.id ?? null;
  const draftCalendar = useMemo(() => {
    if (activeCalendar && activeCalendar.isVisible) {
      return activeCalendar;
    }
    if (defaultCalendar && defaultCalendar.isVisible) {
      return defaultCalendar;
    }
    return visibleCalendars[0] ?? null;
  }, [activeCalendar, defaultCalendar, visibleCalendars]);
  const canCreateBlocks = !!draftCalendar;
  const visibleCalendarIds = useMemo(
    () => new Set(visibleCalendars.map((calendar) => calendar.id)),
    [visibleCalendars],
  );
  const calendarColorSet = useMemo(
    () => new Set(calendars.map((calendar) => calendar.color)),
    [calendars],
  );
  const calendarColorById = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar.color])),
    [calendars],
  );
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const editingCalendar = useMemo(
    () =>
      editCalendarId
        ? calendars.find((calendar) => calendar.id === editCalendarId) ?? null
        : null,
    [calendars, editCalendarId],
  );

  useEffect(() => {
    const mapped = persistedEvents.map((event) =>
      mapPersistedEvent(
        event,
        calendarColorById,
        defaultCalendarColor,
        defaultCalendarId,
      ),
    );
    setEvents(mapped);
    eventsRef.current = mapped;
  }, [calendarColorById, defaultCalendarColor, defaultCalendarId, persistedEvents]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const habitInstances = useMemo(() => {
    const weekEnd = addDays(visibleWeekStart, 6);
    return generateHabitInstances(tasks, {
      startDate: visibleWeekStart,
      endDate: weekEnd,
    });
  }, [tasks, visibleWeekStart]);

  const habitEvents = useMemo<CalendarEvent[]>(
    () =>
      habitInstances.map((instance) => ({
        id: instance.id,
        title: `${instance.title}`,
        startISO: instance.startISO,
        endISO: instance.endISO,
        isAllDay: false,
        color: instance.color,
        taskId: instance.taskId,
        calendarId: null,
        description: null,
        eventKind: "habit" as const,
        readOnly: true,
        isVirtual: true,
      })),
    [habitInstances],
  );

  const visibleEvents = useMemo(() => {
    return events.filter(
      (event) => !event.calendarId || visibleCalendarIds.has(event.calendarId),
    );
  }, [events, visibleCalendarIds]);

  const draftEvent = useMemo(() => {
    if (!editorState || editorState.id !== null) return null;
    const start = new Date(editorState.startISO);
    const end = new Date(editorState.endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    const color =
      (editorState.calendarId
        ? calendarColorById.get(editorState.calendarId)
        : null) ?? defaultCalendarColor;
    return {
      id: "__draft__",
      title: editorState.title.trim() ? editorState.title : "Untitled block",
      startISO: editorState.startISO,
      endISO: editorState.endISO,
      isAllDay: editorState.isAllDay,
      color,
      taskId: editorState.taskId,
      calendarId: editorState.calendarId,
      description: editorState.description.trim()
        ? editorState.description
        : null,
      eventKind: "manual" as const,
      readOnly: true,
      isDraft: true,
    };
  }, [calendarColorById, defaultCalendarColor, editorState]);

  const renderedEvents = useMemo(() => {
    const next = [...visibleEvents, ...habitEvents];
    if (draftEvent) {
      next.push(draftEvent);
    }
    return next;
  }, [draftEvent, habitEvents, visibleEvents]);
  const timedEvents = useMemo(
    () => renderedEvents.filter((event) => !event.isAllDay),
    [renderedEvents],
  );
  const allDayEvents = useMemo(
    () => renderedEvents.filter((event) => event.isAllDay),
    [renderedEvents],
  );
  const allDayEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    allDayEvents.forEach((event) => {
      const start = new Date(event.startISO);
      if (Number.isNaN(start.getTime())) return;
      const key = formatDateKey(start);
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    });
    map.forEach((eventsForDay) => {
      eventsForDay.sort((a, b) => a.startISO.localeCompare(b.startISO));
    });
    return map;
  }, [allDayEvents]);

  const toggleCalendarVisibility = useCallback(
    async (calendar: TaskCalendar) => {
      if (calendarActionId === calendar.id) return;
      setCalendarActionId(calendar.id);
      setCalendarDeleteError(null);
      try {
        await onUpdateCalendar(calendar.id, {
          isVisible: !calendar.isVisible,
        });
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to update calendar.",
        );
      } finally {
        setCalendarActionId(null);
      }
    },
    [calendarActionId, onUpdateCalendar],
  );

  useEffect(() => {
    if (!openCalendarMenuId) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (calendarMenuRef.current?.contains(target)) return;
      if (calendarMenuButtonRef.current?.contains(target)) return;
      setOpenCalendarMenuId(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenCalendarMenuId(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openCalendarMenuId]);

  useEffect(() => {
    if (!calendarSelectOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (calendarSelectRef.current?.contains(target)) return;
      setCalendarSelectOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCalendarSelectOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [calendarSelectOpen]);

  useEffect(() => {
    if (!editorState || calendars.length === 0 || calendarsLoading) {
      setCalendarSelectOpen(false);
    }
  }, [calendars.length, calendarsLoading, editorState]);

  useEffect(() => {
    if (
      openCalendarMenuId &&
      !calendars.some((calendar) => calendar.id === openCalendarMenuId)
    ) {
      setOpenCalendarMenuId(null);
    }
    if (
      editCalendarId &&
      !calendars.some((calendar) => calendar.id === editCalendarId)
    ) {
      setEditCalendarId(null);
      setEditMode(null);
      setEditError(null);
    }
  }, [calendars, editCalendarId, openCalendarMenuId]);

  function openCreatePanel() {
    setCreatePanelOpen(true);
    setCreateError(null);
    setCreateName(calendars.length === 0 ? "Study" : "");
    setCreateColor(pickCalendarColor(calendarColorSet));
    setEditCalendarId(null);
    setEditMode(null);
    setEditError(null);
    setOpenCalendarMenuId(null);
    setCalendarDeleteError(null);
  }

  function closeCreatePanel() {
    setCreatePanelOpen(false);
    setCreateError(null);
  }

  async function handleCreateCalendarSubmit() {
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError("Name is required.");
      return;
    }
    setCreatingCalendar(true);
    setCreateError(null);
    try {
      await onCreateCalendar({ name: trimmed, color: createColor });
      setCreatePanelOpen(false);
      setCreateName("");
      setCreateColor(pickCalendarColor(calendarColorSet));
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create calendar.",
      );
    } finally {
      setCreatingCalendar(false);
    }
  }

  function openEditPanel(calendar: TaskCalendar, mode: "rename" | "color") {
    setEditCalendarId(calendar.id);
    setEditMode(mode);
    setEditName(calendar.name);
    setEditColor(calendar.color);
    setEditError(null);
    setCreatePanelOpen(false);
    setOpenCalendarMenuId(null);
    setCalendarDeleteError(null);
  }

  function closeEditPanel() {
    setEditCalendarId(null);
    setEditMode(null);
    setEditError(null);
  }

  async function handleSaveCalendarEdit() {
    if (!editingCalendar || !editMode) return;
    if (calendarActionId === editingCalendar.id) return;
    if (editMode === "rename") {
      const trimmed = editName.trim();
      if (!trimmed) {
        setEditError("Name is required.");
        return;
      }
      if (trimmed === editingCalendar.name) {
        closeEditPanel();
        return;
      }
      setCalendarActionId(editingCalendar.id);
      setEditError(null);
      try {
        await onUpdateCalendar(editingCalendar.id, { name: trimmed });
        closeEditPanel();
      } catch (error) {
        setEditError(
          error instanceof Error ? error.message : "Failed to rename calendar.",
        );
      } finally {
        setCalendarActionId(null);
      }
      return;
    }
    if (editMode === "color") {
      if (editColor === editingCalendar.color) {
        closeEditPanel();
        return;
      }
      setCalendarActionId(editingCalendar.id);
      setEditError(null);
      try {
        await onUpdateCalendar(editingCalendar.id, { color: editColor });
        closeEditPanel();
      } catch (error) {
        setEditError(
          error instanceof Error ? error.message : "Failed to update color.",
        );
      } finally {
        setCalendarActionId(null);
      }
    }
  }

  async function handleSetDefault(calendar: TaskCalendar) {
    if (calendarActionId === calendar.id) return;
    setCalendarActionId(calendar.id);
    setCalendarDeleteError(null);
    setOpenCalendarMenuId(null);
    try {
      await onUpdateCalendar(calendar.id, { isDefault: true });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to set default calendar.",
      );
    } finally {
      setCalendarActionId(null);
    }
  }

  async function handleDeleteCalendar(calendar: TaskCalendar) {
    if (calendarActionId === calendar.id) return;
    setCalendarActionId(calendar.id);
    setCalendarDeleteError(null);
    setOpenCalendarMenuId(null);
    try {
      await onDeleteCalendar(calendar.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete calendar.";
      if (message.toLowerCase().includes("last calendar")) {
        setCalendarDeleteError({ id: calendar.id, message });
      } else {
        alert(message);
      }
    } finally {
      setCalendarActionId(null);
    }
  }

  function handleCalendarRowClick(calendar: TaskCalendar) {
    setOpenCalendarMenuId(null);
    setCalendarDeleteError(null);
    setEditCalendarId(null);
    setEditMode(null);
    onActiveCalendarChange?.(calendar.id);
  }

  function handleCalendarMenuToggle(
    calendarId: string,
    button: HTMLButtonElement,
  ) {
    setOpenCalendarMenuId((prev) =>
      prev === calendarId ? null : calendarId,
    );
    calendarMenuButtonRef.current = button;
    setCreatePanelOpen(false);
    setEditCalendarId(null);
    setEditMode(null);
    setEditError(null);
  }

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(visibleWeekStart, index);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  }, [visibleWeekStart]);
  const allDayRowHeight = useMemo(() => {
    const maxCount = weekDays.reduce((max, day) => {
      const count = allDayEventsByDate.get(formatDateKey(day))?.length ?? 0;
      return Math.max(max, count);
    }, 0);
    const stackedHeight =
      ALLDAY_ROW_PADDING * 2 +
      maxCount * ALLDAY_PILL_H +
      Math.max(0, maxCount - 1) * ALLDAY_PILL_GAP;
    return Math.max(ALLDAY_MIN_H, stackedHeight);
  }, [allDayEventsByDate, weekDays]);
  const weekDaysRef = useRef(weekDays);

  useEffect(() => {
    weekDaysRef.current = weekDays;
  }, [weekDays]);

  useEffect(() => {
    if (!weekDays.some((day) => isSameDay(day, selectedDate))) {
      setSelectedDate(weekDays[0]);
    }
  }, [weekDays, selectedDate]);

  useEffect(() => {
    if (!focusTaskId) return;
    const match = events.find((event) => event.taskId === focusTaskId);
    if (match) {
      const startDate = new Date(match.startISO);
      setVisibleWeekStart(getStartOfWeek(startDate));
      setSelectedDate(startDate);
      setHighlightedEventId(match.id);
      setTimeout(() => setHighlightedEventId(null), 2000);
    }
    if (onRequestFocusClear) {
      onRequestFocusClear();
    }
  }, [focusTaskId, events, onRequestFocusClear]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const container = root.parentElement;
    const topBar = container?.previousElementSibling as HTMLElement | null;
    if (!topBar) return;

    const buttons = Array.from(
      topBar.querySelectorAll('button[aria-label^="Switch to "]'),
    ) as HTMLButtonElement[];
    if (buttons.length === 0) return;

    const nextButtons: Record<SurfaceView, HTMLButtonElement | null> = {
      planner: null,
      calendar: null,
    };

    buttons.forEach((button) => {
      const label = button.getAttribute("aria-label")?.toLowerCase() ?? "";
      if (label.includes("planner")) {
        nextButtons.planner = button;
      } else if (label.includes("calendar")) {
        nextButtons.calendar = button;
      }
    });

    surfaceButtonsRef.current = nextButtons;
    setSurfaceTabsReady(!!(nextButtons.planner || nextButtons.calendar));

    const previousDisplay = topBar.style.display;
    topBar.style.display = "none";

    const updateActiveTab = () => {
      if (nextButtons.planner?.classList.contains("bg-white/10")) {
        setActiveSurfaceTab("planner");
      } else if (nextButtons.calendar?.classList.contains("bg-white/10")) {
        setActiveSurfaceTab("calendar");
      } else {
        setActiveSurfaceTab(null);
      }
    };

    updateActiveTab();

    const observer = new MutationObserver(updateActiveTab);
    buttons.forEach((button) => {
      observer.observe(button, {
        attributes: true,
        attributeFilter: ["class"],
      });
    });

    return () => {
      observer.disconnect();
      topBar.style.display = previousDisplay;
    };
  }, []);

  const hours = useMemo(
    () =>
      Array.from(
        { length: END_HOUR - START_HOUR },
        (_, index) => START_HOUR + index,
      ),
    [],
  );

  const monthReference = useMemo(() => {
    const next = new Date(selectedDate);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
  }, [selectedDate]);

  const miniCalendarWeeks = useMemo(
    () => buildMonthMatrix(monthReference),
    [monthReference],
  );

  const monthLabel = useMemo(() => {
    return visibleWeekStart.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [visibleWeekStart]);

  const gmtLabel = useMemo(() => {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const minutesLabel = minutes ? `:${`${minutes}`.padStart(2, "0")}` : "";
    return `GMT${sign}${hours}${minutesLabel}`;
  }, []);

  function handleSurfaceTabClick(surface: SurfaceView) {
    const button = surfaceButtonsRef.current[surface];
    if (!button) return;
    button.click();
    setActiveSurfaceTab(surface);
  }

  function handleTabToday() {
    const today = new Date();
    setVisibleWeekStart(getStartOfWeek(today));
    setSelectedDate(today);
  }

  function shiftWeek(offset: number) {
    setVisibleWeekStart((prev) => addDays(prev, offset * 7));
    setSelectedDate((prev) => addDays(prev, offset * 7));
  }

  function minutesFromPointer(dayIndex: number, clientY: number) {
    const column = columnRefs.current[dayIndex];
    if (!column) return START_MINUTES;
    const rect = column.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const minutes = START_MINUTES + ratio * (END_MINUTES - START_MINUTES);
    return clampMinutes(minutes);
  }

  const persistEventTiming = useCallback(
    async (eventItem: CalendarEvent) => {
      try {
        await onUpdateEvent(eventItem.id, buildEventInput(eventItem));
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to update the event.",
        );
      }
    },
    [onUpdateEvent],
  );

  function handleDayPointerDown(
    dayIndex: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if ((event.target as HTMLElement).closest("[data-event-block]")) return;
    if (!canCreateBlocks) return;
    event.preventDefault();
    const minutes = snapToIncrement(
      minutesFromPointer(dayIndex, event.clientY),
    );
    setSelectionState({
      dayIndex,
      originMinutes: minutes,
      currentMinutes: minutes,
      anchor: { x: event.clientX, y: event.clientY },
    });
  }

  const finalizeSelection = useCallback(
    (selection: SelectionState) => {
      if (!draftCalendar) return;
      const { anchor, currentMinutes, dayIndex, originMinutes } = selection;
      const startMinutes = clampMinutes(
        Math.min(originMinutes, currentMinutes),
      );
      let endMinutes = clampMinutes(Math.max(originMinutes, currentMinutes));
      if (endMinutes - startMinutes < MIN_DURATION_MINUTES) {
        endMinutes = clampMinutes(Math.min(startMinutes + 60, END_MINUTES));
      }
      const day = weekDaysRef.current[dayIndex];
      if (!day) return;
      const startDate = createDateWithMinutes(day, startMinutes);
      const endDate = createDateWithMinutes(day, endMinutes);
      openEditor({
        id: null,
        title: "",
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        isAllDay: false,
        position: anchor,
        taskId: null,
        calendarId: draftCalendar.id,
        description: "",
        lastTimedRange: {
          startISO: startDate.toISOString(),
          endISO: endDate.toISOString(),
        },
      });
    },
    [draftCalendar],
  );

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (selectionState) {
        const minutes = snapToIncrement(
          minutesFromPointer(selectionState.dayIndex, event.clientY),
        );
        setSelectionState((prev) =>
          prev ? { ...prev, currentMinutes: minutes } : prev,
        );
      } else if (resizeState) {
        const minutes = snapToIncrement(
          minutesFromPointer(resizeState.dayIndex, event.clientY),
        );
        let updatedEvent: CalendarEvent | null = null;
        setEvents((prev) =>
          prev.map((evt) => {
            if (evt.id !== resizeState.eventId) return evt;
            const day = weekDaysRef.current[resizeState.dayIndex];
            if (!day) return evt;
            if (resizeState.edge === "start") {
              const endMinutes = getMinutesFromDate(new Date(evt.endISO));
              const nextMinutes = clampMinutes(
                Math.min(minutes, endMinutes - MIN_DURATION_MINUTES),
              );
              const nextStart = createDateWithMinutes(day, nextMinutes);
              updatedEvent = { ...evt, startISO: nextStart.toISOString() };
              return updatedEvent;
            }
            const startMinutes = getMinutesFromDate(new Date(evt.startISO));
            const nextMinutes = clampMinutes(
              Math.max(minutes, startMinutes + MIN_DURATION_MINUTES),
            );
            const nextEnd = createDateWithMinutes(day, nextMinutes);
            updatedEvent = { ...evt, endISO: nextEnd.toISOString() };
            return updatedEvent;
          }),
        );
        if (updatedEvent) {
          pendingResizeRef.current = updatedEvent;
        }
      }
    }

    function handleMouseUp() {
      if (selectionState) {
        finalizeSelection(selectionState);
        setSelectionState(null);
      }
      if (resizeState) {
        const pending = pendingResizeRef.current
          ? pendingResizeRef.current
          : (eventsRef.current.find((evt) => evt.id === resizeState.eventId) ??
            null);
        pendingResizeRef.current = null;
        if (pending) {
          persistEventTiming(pending);
        }
        setResizeState(null);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectionState, resizeState, finalizeSelection, persistEventTiming]);

  function handleResizeMouseDown(
    event: React.MouseEvent,
    eventId: string,
    dayIndex: number,
    edge: "start" | "end",
  ) {
    event.stopPropagation();
    event.preventDefault();
    setResizeState({ eventId, dayIndex, edge });
  }

  function openEditor(state: EditorState) {
    const nextPosition = (() => {
      if (typeof window === "undefined") return state.position;
      const width = 280;
      const height = 320;
      return {
        x: Math.min(
          Math.max(state.position.x, 16),
          window.innerWidth - width - 16,
        ),
        y: Math.min(
          Math.max(state.position.y, 16),
          window.innerHeight - height - 16,
        ),
      };
    })();
    setEditorState({ ...state, position: nextPosition });
  }

  function closeEditor() {
    setEditorState(null);
  }

  function handleEventClick(
    event: React.MouseEvent<HTMLElement, MouseEvent>,
    calendarEvent: CalendarEvent,
  ) {
    event.stopPropagation();
    if (selectionState || resizeState) {
      setSelectionState(null);
      setResizeState(null);
      return;
    }
    if (calendarEvent.readOnly) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openEditor({
      id: calendarEvent.id,
      title: calendarEvent.title,
      startISO: calendarEvent.startISO,
      endISO: calendarEvent.endISO,
      isAllDay: calendarEvent.isAllDay,
      position: { x: rect.right + 12, y: rect.top },
      taskId: calendarEvent.taskId,
      calendarId: calendarEvent.calendarId,
      description: calendarEvent.description ?? "",
      lastTimedRange: calendarEvent.isAllDay
        ? null
        : {
            startISO: calendarEvent.startISO,
            endISO: calendarEvent.endISO,
          },
    });
  }

  function updateEditorField<K extends keyof EditorState>(
    field: K,
    value: EditorState[K],
  ) {
    setEditorState((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleAllDayToggle(nextValue: boolean) {
    setEditorState((prev) => {
      if (!prev || prev.isAllDay === nextValue) return prev;
      if (nextValue) {
        const startSource = new Date(prev.startISO);
        const baseDate = Number.isNaN(startSource.getTime())
          ? new Date()
          : startSource;
        const dayStart = startOfDay(baseDate);
        const nextDayStart = addDays(dayStart, 1);
        return {
          ...prev,
          isAllDay: true,
          startISO: dayStart.toISOString(),
          endISO: nextDayStart.toISOString(),
          lastTimedRange: {
            startISO: prev.startISO,
            endISO: prev.endISO,
          },
        };
      }
      const daySource = new Date(prev.startISO);
      const baseDate = Number.isNaN(daySource.getTime()) ? new Date() : daySource;
      const roundedMinutes = snapToIncrement(getMinutesFromDate(new Date()), 60);
      const startMinutes = Math.min(
        clampMinutes(roundedMinutes),
        END_MINUTES - 60,
      );
      const fallbackStart = createDateWithMinutes(baseDate, startMinutes);
      const fallbackEnd = createDateWithMinutes(baseDate, startMinutes + 60);
      const restored = prev.lastTimedRange ?? {
        startISO: fallbackStart.toISOString(),
        endISO: fallbackEnd.toISOString(),
      };
      return {
        ...prev,
        isAllDay: false,
        startISO: restored.startISO,
        endISO: restored.endISO,
        lastTimedRange: restored,
      };
    });
  }

  const handleTaskLinkChange = useCallback(
    (nextTaskId: string | null) => {
      setEditorState((prev) => {
        if (!prev) return prev;
        const nextTask = nextTaskId ? taskById.get(nextTaskId) : null;
        const nextTitle = nextTask ? nextTask.title : prev.title;
        return {
          ...prev,
          taskId: nextTaskId,
          title: nextTitle,
        };
      });
    },
    [taskById],
  );

  const ensureDraftEventFromQuickInput = useCallback(
    (seed: { title?: string; description?: string }) => {
      if (!quickCreateCalendar) return null;
      const now = new Date();
      const slot = findNextAvailableSlot(
        [...eventsRef.current, ...habitEvents],
        now,
        QUICK_CREATE_DURATION_MINUTES,
        QUICK_CREATE_MAX_LOOKAHEAD_DAYS,
      );
      const startDate = createDateWithMinutes(slot.day, slot.startMinutes);
      const endDate = createDateWithMinutes(
        slot.day,
        slot.startMinutes + QUICK_CREATE_DURATION_MINUTES,
      );
      return {
        id: null,
        title: seed.title ?? "",
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        isAllDay: false,
        position: { x: 16, y: 16 },
        taskId: null,
        calendarId: quickCreateCalendar.id,
        description: seed.description ?? "",
        lastTimedRange: {
          startISO: startDate.toISOString(),
          endISO: endDate.toISOString(),
        },
      };
    },
    [habitEvents, quickCreateCalendar],
  );

  const handleQuickInputChange = useCallback(
    (field: "title" | "description", value: string) => {
      const trimmed = value.trim();
      setEditorState((prev) => {
        if (!prev) {
          if (!trimmed) return prev;
          const draft = ensureDraftEventFromQuickInput(
            field === "title" ? { title: value } : { description: value },
          );
          return draft ?? prev;
        }
        const next = { ...prev, [field]: value };
        if (
          prev.id === null &&
          !next.title.trim() &&
          !next.description.trim()
        ) {
          return null;
        }
        return next;
      });
    },
    [ensureDraftEventFromQuickInput],
  );

  async function handleSaveEvent() {
    if (!editorState) return;
    const {
      id,
      endISO,
      startISO,
      title,
      taskId,
      calendarId,
      description,
      isAllDay,
    } = editorState;
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (end.getTime() <= start.getTime()) {
      alert("End time must be after the start time.");
      return;
    }
    const payload: CalendarEventInput = {
      title: title.trim() || "Untitled block",
      start: start.toISOString(),
      end: end.toISOString(),
      isAllDay,
      taskId,
      calendarId,
      description: description.trim() ? description.trim() : null,
    };
    setSavingEvent(true);
    try {
      if (id) {
        await onUpdateEvent(id, payload);
      } else {
        await onCreateEvent(payload);
      }
      closeEditor();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to save the event.",
      );
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteEvent() {
    if (!editorState?.id) {
      closeEditor();
      return;
    }
    try {
      await onDeleteEvent(editorState.id);
      closeEditor();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to delete the event.",
      );
    }
  }

  const today = new Date();
  const nowMinutes = getMinutesFromDate(today);
  const showNowIndicator =
    weekDays.some((day) => isSameDay(day, today)) &&
    nowMinutes >= START_MINUTES &&
    nowMinutes <= END_MINUTES;
  const editorCalendar = editorState?.calendarId
    ? calendars.find((calendar) => calendar.id === editorState.calendarId) ?? null
    : null;
  const editorCalendarColor = editorCalendar?.color ?? defaultCalendarColor;
  const panelDisabled = !editorState;
  const quickInputDisabled = !editorState && !quickCreateCalendar;
  const calendarSelectValue =
    calendars.length === 0 ? "" : editorState?.calendarId ?? "";
  const emptyCalendarLabel = editorState ? "No calendar" : "Select calendar";
  const selectedCalendar = editorState?.calendarId
    ? calendars.find((calendar) => calendar.id === editorState.calendarId) ??
      null
    : null;
  const calendarLabel = calendarsLoading
    ? "Loading calendars…"
    : calendars.length === 0
      ? "No calendars yet"
      : selectedCalendar?.name ?? emptyCalendarLabel;
  const calendarDropdownDisabled =
    panelDisabled || calendarsLoading || calendars.length === 0;
  const calendarSelectOptions = useMemo(() => {
    if (calendarDropdownDisabled) return [];
    const options: Array<{
      id: string | null;
      label: string;
      color: string | null;
      isEmpty: boolean;
    }> = [];
    if (calendarSelectValue === "") {
      options.push({
        id: null,
        label: emptyCalendarLabel,
        color: null,
        isEmpty: true,
      });
    }
    calendars.forEach((calendar) => {
      options.push({
        id: calendar.id,
        label: calendar.name,
        color: calendar.color,
        isEmpty: false,
      });
    });
    return options;
  }, [
    calendarDropdownDisabled,
    calendarSelectValue,
    calendars,
    emptyCalendarLabel,
  ]);
  const calendarSelectCurrentIndex = useMemo(() => {
    if (calendarSelectOptions.length === 0) return -1;
    if (calendarSelectValue === "") return 0;
    const index = calendarSelectOptions.findIndex(
      (option) => option.id === calendarSelectValue,
    );
    return index >= 0 ? index : 0;
  }, [calendarSelectOptions, calendarSelectValue]);

  useEffect(() => {
    if (!calendarSelectOpen) return;
    const nextIndex =
      calendarSelectCurrentIndex >= 0 ? calendarSelectCurrentIndex : 0;
    setCalendarSelectActiveIndex(nextIndex);
  }, [calendarSelectCurrentIndex, calendarSelectOpen]);

  function renderEventDetailsPanel() {
    const startDate = editorState ? new Date(editorState.startISO) : null;
    const endDate = editorState ? new Date(editorState.endISO) : null;
    const hasValidStart =
      !!startDate && !Number.isNaN(startDate.getTime());
    const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());
    const hasValidDates = hasValidStart && hasValidEnd;
    const durationMinutes =
      hasValidDates && startDate && endDate
        ? Math.max(
            0,
            Math.round((endDate.getTime() - startDate.getTime()) / 60000),
          )
        : 0;
    const dateLabel =
      hasValidDates && startDate
        ? startDate.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "Date";
    const startLabel =
      hasValidStart && startDate ? formatTimeString(startDate) : "--";
    const endLabel =
      hasValidEnd && endDate ? formatTimeString(endDate) : "--";
    const canEditTaskLink = !!editorState && editorState.id === null;
    const isAllDay = !!editorState?.isAllDay;
    const taskLabel = editorState?.taskId
      ? taskById.get(editorState.taskId)?.title ?? "Linked task"
      : "No task linked";
    function handleCalendarSelectKeyDown(
      event: React.KeyboardEvent<HTMLDivElement>,
    ) {
      if (calendarDropdownDisabled) return;
      if (!calendarSelectOpen) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setCalendarSelectOpen(true);
          setCalendarSelectActiveIndex(
            calendarSelectCurrentIndex >= 0
              ? calendarSelectCurrentIndex
              : 0,
          );
        }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setCalendarSelectActiveIndex((prev) => {
          const count = calendarSelectOptions.length;
          if (count === 0) return prev;
          const next = (prev + direction + count) % count;
          return next;
        });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const option = calendarSelectOptions[calendarSelectActiveIndex];
        if (!option) return;
        updateEditorField("calendarId", option.id ?? null);
        setCalendarSelectOpen(false);
        return;
      }
      if (event.key === "Escape") {
        setCalendarSelectOpen(false);
      }
    }

    return (
      <div className="flex min-h-0 flex-col gap-4 px-4 pb-6 pt-3">
        <input
          value={editorState?.title ?? ""}
          onChange={(event) =>
            handleQuickInputChange("title", event.target.value)
          }
          disabled={quickInputDisabled || !!editorState?.taskId}
          className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[15px] text-white/90 outline-none transition placeholder:text-white/35 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Title"
        />

        {isAllDay ? (
          <div
            className={`flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] ${
              panelDisabled ? "text-white/35" : "text-white/80"
            }`}
          >
            <span className="font-medium">All-day</span>
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] ${
              panelDisabled ? "text-white/35" : "text-white/80"
            }`}
          >
            <span className="font-medium">{startLabel}</span>
            <span className="text-white/30">-&gt;</span>
            <span className="font-medium">{endLabel}</span>
            <span className="ml-auto text-[12px] text-white/45">
              {hasValidDates ? formatDurationLabel(durationMinutes) : ""}
            </span>
          </div>
        )}

        <div
          className={`flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] ${
            panelDisabled ? "text-white/35" : "text-white/80"
          }`}
        >
          <span className="font-medium">All-day</span>
          <button
            type="button"
            onClick={() => handleAllDayToggle(!isAllDay)}
            disabled={panelDisabled}
            aria-pressed={isAllDay}
            className={`relative inline-flex h-5 w-9 items-center rounded-full border transition ${
              isAllDay
                ? "border-emerald-400/70 bg-emerald-400/30"
                : "border-white/15 bg-white/10"
            } ${panelDisabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                isAllDay ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div
          className={`text-[13px] ${
            panelDisabled ? "text-white/35" : "text-white/70"
          }`}
        >
          {hasValidDates ? dateLabel : "Date"}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Calendar
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                panelDisabled ? "bg-white/20" : ""
              }`}
              style={
                panelDisabled
                  ? undefined
                  : { backgroundColor: editorCalendarColor }
              }
            />
            <div
              className="relative w-full"
              ref={calendarSelectRef}
              onKeyDown={handleCalendarSelectKeyDown}
            >
              <button
                type="button"
                onClick={() =>
                  setCalendarSelectOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      setCalendarSelectActiveIndex(
                        calendarSelectCurrentIndex >= 0
                          ? calendarSelectCurrentIndex
                          : 0,
                      );
                    }
                    return next;
                  })
                }
                disabled={calendarDropdownDisabled}
                aria-haspopup="listbox"
                aria-expanded={calendarSelectOpen}
                className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/90 outline-none transition focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="truncate">{calendarLabel}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-white/60 transition ${
                    calendarSelectOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              {calendarSelectOpen && !calendarDropdownDisabled && (
                <div
                  role="listbox"
                  aria-label="Select calendar"
                  className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-white/10 bg-[#0b0b0f] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                >
                  {calendarSelectOptions.map((option, optionIndex) => {
                    const isSelected =
                      option.id === calendarSelectValue ||
                      (option.id === null && calendarSelectValue === "");
                    const isHighlighted =
                      optionIndex === calendarSelectActiveIndex;
                    const isActive = isSelected || isHighlighted;
                    return (
                      <button
                        key={option.id ?? "empty"}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() =>
                          setCalendarSelectActiveIndex(optionIndex)
                        }
                        onClick={() => {
                          updateEditorField("calendarId", option.id ?? null);
                          setCalendarSelectOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] transition ${
                          isActive
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            option.isEmpty ? "bg-white/20" : ""
                          }`}
                          style={
                            option.color
                              ? { backgroundColor: option.color }
                              : undefined
                          }
                        />
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Link to task
          </p>
          {canEditTaskLink ? (
            <select
              value={editorState?.taskId ?? ""}
              onChange={(event) =>
                handleTaskLinkChange(
                  event.target.value ? event.target.value : null,
                )
              }
              disabled={panelDisabled}
              className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/90 outline-none transition focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">No task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/70">
              {taskLabel}
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Notes
          </p>
          <textarea
            value={editorState?.description ?? ""}
            onChange={(event) =>
              handleQuickInputChange("description", event.target.value)
            }
            disabled={quickInputDisabled}
            rows={4}
            className="mt-2 w-full resize-none rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/90 outline-none transition placeholder:text-white/35 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add notes"
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
          <button
            type="button"
            onClick={handleDeleteEvent}
            disabled={savingEvent || panelDisabled}
            className="text-white/45 transition hover:text-white disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleSaveEvent}
            disabled={savingEvent || panelDisabled}
            className="rounded-md border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            {savingEvent ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="notion-calendar flex h-full min-h-0 w-full flex-col text-white"
    >
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#0f0f10]">
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)_288px]">
          <aside className="order-2 min-h-0 overflow-y-auto hide-scrollbar border-t border-white/10 bg-[#0f0f10] px-3 pb-2 pt-0 lg:order-1 lg:border-t-0 lg:border-r">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold leading-5 text-white/90">
                {monthReference.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-white/5 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleSurfaceTabClick("planner")}
                    disabled={!surfaceTabsReady}
                    aria-pressed={activeSurfaceTab === "planner"}
                    aria-label="Switch to Planner"
                    title="Planner"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] transition ${
                      activeSurfaceTab === "planner"
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    } ${surfaceTabsReady ? "" : "cursor-not-allowed opacity-50"}`}
                  >
                    <ListIcon className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSurfaceTabClick("calendar")}
                    disabled={!surfaceTabsReady}
                    aria-pressed={activeSurfaceTab === "calendar"}
                    aria-label="Switch to Calendar"
                    title="Calendar"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] transition ${
                      activeSurfaceTab === "calendar"
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    } ${surfaceTabsReady ? "" : "cursor-not-allowed opacity-50"}`}
                  >
                    <CalendarIcon className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMiniCalendarCollapsed((prev) => !prev)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
                  aria-label="Toggle mini calendar"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      miniCalendarCollapsed ? "-rotate-90" : "rotate-0"
                    }`}
                    aria-hidden
                  />
                </button>
              </div>
            </div>

            {!miniCalendarCollapsed && (
              <div className="mt-1">
                <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="mt-2 space-y-1">
                  {miniCalendarWeeks.map((week, weekIndex) => {
                    const isActiveWeek = week.some((day) =>
                      isSameWeek(day, visibleWeekStart),
                    );
                    return (
                      <div
                        key={`week-${weekIndex}`}
                        className={`grid grid-cols-7 gap-1 rounded-md p-1 ${
                          isActiveWeek ? "bg-white/[0.03]" : ""
                        }`}
                      >
                        {week.map((day) => {
                          const isCurrentMonth =
                            day.getMonth() === monthReference.getMonth();
                          const isSelected = isSameDay(day, selectedDate);
                          const isToday = isSameDay(day, new Date());
                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              onClick={() => {
                                setSelectedDate(day);
                                setVisibleWeekStart(getStartOfWeek(day));
                              }}
                              className={`relative flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-medium transition ${
                                isSelected
                                  ? "bg-white/15 text-white"
                                  : "text-white/70 hover:bg-white/[0.06]"
                              } ${!isCurrentMonth ? "opacity-40" : ""}`}
                              aria-label={`Select ${day.toDateString()}`}
                            >
                              <span
                                className={`relative ${
                                  isToday && !isSelected
                                    ? "before:absolute before:-left-1 before:-top-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-rose-400"
                                    : ""
                                }`}
                              >
                                {day.getDate()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                  Calendars
                </p>
                <button
                  type="button"
                  onClick={openCreatePanel}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  + Create
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {calendarsLoading ? (
                  <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/50">
                    Loading calendars…
                  </div>
                ) : calendars.length === 0 ? (
                  <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-3 text-[13px] text-white/60">
                    <p>No calendars yet</p>
                    <button
                      type="button"
                      onClick={openCreatePanel}
                      className="mt-2 w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-white/15"
                    >
                      + Create calendar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {calendars.map((calendar) => {
                      const isHidden = !calendar.isVisible;
                      const isActive = calendar.id === activeCalendarId;
                      const isMenuOpen = openCalendarMenuId === calendar.id;
                      const isEditing = editCalendarId === calendar.id;
                      const isBusy = calendarActionId === calendar.id;
                      const showDeleteError =
                        calendarDeleteError?.id === calendar.id;
                      return (
                        <div key={calendar.id}>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCalendarRowClick(calendar)}
                              className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] leading-5 transition ${
                                isActive
                                  ? "bg-white/[0.06] text-white"
                                  : "hover:bg-white/[0.03]"
                              } ${isHidden ? "text-white/40" : "text-white/80"}`}
                              aria-pressed={isActive}
                            >
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: calendar.color }}
                              />
                              <span className="min-w-0 truncate">
                                {calendar.name}
                              </span>
                              {calendar.isDefault && (
                                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-white/60">
                                  Default
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void toggleCalendarVisibility(calendar);
                                }}
                                aria-pressed={calendar.isVisible}
                                aria-label={`${
                                  calendar.isVisible ? "Hide" : "Show"
                                } ${calendar.name}`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isBusy}
                              >
                                {calendar.isVisible ? (
                                  <Eye className="h-4 w-4" aria-hidden />
                                ) : (
                                  <EyeOff className="h-4 w-4" aria-hidden />
                                )}
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleCalendarMenuToggle(
                                      calendar.id,
                                      event.currentTarget,
                                    );
                                  }}
                                  aria-expanded={isMenuOpen}
                                  aria-haspopup="menu"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={isBusy}
                                >
                                  <MoreHorizontal
                                    className="h-4 w-4"
                                    aria-hidden
                                  />
                                </button>
                                {isMenuOpen && (
                                  <div
                                    ref={calendarMenuRef}
                                    className="absolute right-0 top-9 z-30 w-40 rounded-md border border-white/10 bg-[#0f0f10] py-1 text-[12px] shadow-lg"
                                    role="menu"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditPanel(calendar, "rename")
                                      }
                                      className="flex w-full items-center px-3 py-2 text-left text-white/80 transition hover:bg-white/[0.05] hover:text-white"
                                      role="menuitem"
                                    >
                                      Rename
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditPanel(calendar, "color")
                                      }
                                      className="flex w-full items-center px-3 py-2 text-left text-white/80 transition hover:bg-white/[0.05] hover:text-white"
                                      role="menuitem"
                                    >
                                      Change color
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleSetDefault(calendar)}
                                      className="flex w-full items-center px-3 py-2 text-left text-white/80 transition hover:bg-white/[0.05] hover:text-white"
                                      role="menuitem"
                                    >
                                      Set default
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDeleteCalendar(calendar)
                                      }
                                      className="flex w-full items-center px-3 py-2 text-left text-rose-200 transition hover:bg-rose-500/10 hover:text-rose-100"
                                      role="menuitem"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {showDeleteError && (
                            <p className="mt-1 pl-8 text-[11px] text-rose-300">
                              {calendarDeleteError?.message}
                            </p>
                          )}
                          {isEditing && editMode && (
                            <div className="mt-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                                  {editMode === "rename"
                                    ? "Rename calendar"
                                    : "Change color"}
                                </p>
                                <button
                                  type="button"
                                  onClick={closeEditPanel}
                                  className="text-[11px] text-white/50 transition hover:text-white"
                                >
                                  Close
                                </button>
                              </div>
                              {editMode === "rename" ? (
                                <div className="mt-2 space-y-2">
                                  <input
                                    value={editName}
                                    onChange={(event) =>
                                      setEditName(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void handleSaveCalendarEdit();
                                      }
                                    }}
                                    className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/90 outline-none transition placeholder:text-white/35 focus:border-white/30"
                                    placeholder="Calendar name"
                                  />
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {EVENT_COLORS.map((color) => {
                                    const isSelected = editColor === color;
                                    return (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() => setEditColor(color)}
                                        className={`h-6 w-6 rounded-full border transition ${
                                          isSelected
                                            ? "border-white ring-2 ring-white/60"
                                            : "border-white/10 hover:border-white/40"
                                        }`}
                                        style={{ backgroundColor: color }}
                                        aria-label={`Select ${color}`}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                              {editError && (
                                <p className="mt-2 text-[11px] text-rose-300">
                                  {editError}
                                </p>
                              )}
                              <div className="mt-3 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={closeEditPanel}
                                  className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/60 transition hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveCalendarEdit()}
                                  disabled={
                                    calendarActionId === calendar.id ||
                                    (editMode === "rename" &&
                                      !editName.trim())
                                  }
                                  className="rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {createPanelOpen && (
                  <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                        Create calendar
                      </p>
                      <button
                        type="button"
                        onClick={closeCreatePanel}
                        className="text-[11px] text-white/50 transition hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      <input
                        value={createName}
                        onChange={(event) => setCreateName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateCalendarSubmit();
                          }
                        }}
                        className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-white/90 outline-none transition placeholder:text-white/35 focus:border-white/30"
                        placeholder="Calendar name"
                      />
                    </div>
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                        Color
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {EVENT_COLORS.map((color) => {
                          const isSelected = createColor === color;
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setCreateColor(color)}
                              className={`h-6 w-6 rounded-full border transition ${
                                isSelected
                                  ? "border-white ring-2 ring-white/60"
                                  : "border-white/10 hover:border-white/40"
                              }`}
                              style={{ backgroundColor: color }}
                              aria-label={`Select ${color}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    {createError && (
                      <p className="mt-2 text-[11px] text-rose-300">
                        {createError}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeCreatePanel}
                        className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/60 transition hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCreateCalendarSubmit()}
                        disabled={creatingCalendar || !createName.trim()}
                        className="rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {creatingCalendar ? "Creating…" : "Create"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="order-1 flex min-h-0 min-w-0 flex-col lg:order-2">
            <header className="flex h-10 items-center justify-between gap-2 border-b border-white/10 px-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">{monthLabel}</h2>
                {loading && (
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] tracking-[0.25em] text-white/60">
                    Syncing…
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-sm">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-white/70 transition hover:bg-white/5 hover:text-white"
                >
                  Week <ChevronDown className="h-4 w-4 text-white/50" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={handleTabToday}
                  className="h-8 rounded-md px-2 text-[13px] text-white/70 transition hover:bg-white/5 hover:text-white"
                >
                  Today
                </button>
                <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => shiftWeek(-1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition hover:bg-white/5 hover:text-white"
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftWeek(1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition hover:bg-white/5 hover:text-white"
                    aria-label="Next week"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </header>

            <div className="calendar-scroll flex-1 min-h-0 overscroll-contain overflow-x-hidden overflow-y-auto bg-[#0f0f10]">
              <div className="sticky top-0 z-20 bg-[#0f0f10]">
                <div
                  className="grid border-b border-white/10 bg-[#0f0f10]"
                  style={GRID_COLUMNS_STYLE}
                >
                  <div className="flex items-center justify-end border-r border-white/10 pr-3 text-[10px] font-medium text-white/40">
                    {gmtLabel}
                  </div>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, today);
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex items-center border-r border-white/10 px-2 py-1 last:border-r-0 ${
                          isToday ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 leading-none">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                            {day.toLocaleDateString(undefined, {
                              weekday: "short",
                            })}
                          </span>
                          <span
                            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-semibold ${
                              isToday
                                ? "bg-rose-500 text-white shadow-sm"
                                : isSelected
                                  ? "bg-white/10 text-white"
                                  : "text-white/70"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="grid border-b border-white/10 bg-[#0f0f10]"
                  style={{ ...GRID_COLUMNS_STYLE, height: allDayRowHeight }}
                >
                  <div className="allday-label flex h-full items-center justify-center whitespace-nowrap border-r border-white/10 text-[11px] font-medium text-white/40">
                    All-day
                  </div>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, today);
                    const dayKey = formatDateKey(day);
                    const dayEvents = allDayEventsByDate.get(dayKey) ?? [];
                    return (
                      <div
                        key={`all-day-${day.toISOString()}`}
                        className={`h-full border-r border-white/10 last:border-r-0 ${
                          isToday ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <div className="flex h-full flex-col gap-1 px-2 py-1">
                          {dayEvents.map((eventItem) => {
                            const isHighlighted =
                              highlightedEventId === eventItem.id;
                            const isDraft = !!eventItem.isDraft;
                            return (
                              <button
                                key={eventItem.id}
                                type="button"
                                data-event-block
                                onClick={(event) =>
                                  handleEventClick(event, eventItem)
                                }
                                className={`group flex items-center rounded-md px-2 text-[11px] font-medium text-white/90 transition hover:text-white ${
                                  isHighlighted ? "ring-2 ring-white" : ""
                                } ${isDraft ? "border border-dashed border-white/40 opacity-80" : ""}`}
                                style={{
                                  height: ALLDAY_PILL_H,
                                  backgroundImage: `linear-gradient(135deg, ${eventItem.color}, rgba(0,0,0,0.35))`,
                                }}
                                title={eventItem.title}
                              >
                                <span className="truncate">
                                  {eventItem.title || "Untitled block"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="relative grid min-h-[520px] bg-[#0f0f10]"
                style={GRID_COLUMNS_STYLE}
              >
                {showNowIndicator && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20"
                    style={{ top: minutesToPixels(nowMinutes) }}
                  >
                    <div
                      className="absolute top-0 flex items-center justify-end pr-3"
                      style={{
                        width: TIME_GUTTER_W,
                        transform: "translateY(-50%)",
                      }}
                    >
                      <span className="inline-flex h-5 items-center rounded-full bg-rose-500 px-2 text-[10px] font-semibold text-white shadow-sm">
                        {formatTimeString(today)}
                      </span>
                    </div>
                    <div
                      className="absolute top-0 h-px bg-rose-400/80"
                      style={{ left: TIME_GUTTER_W, right: 0 }}
                    />
                  </div>
                )}
                {calendars.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <p className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] text-white/60">
                      Create your first calendar to start planning.
                    </p>
                  </div>
                )}
                <div
                  className="relative border-r border-white/10 bg-[#0f0f10] pr-3 text-right text-[10px] text-white/45"
                  style={{ height: GRID_HEIGHT_PX }}
                >
                  {hours.map((hour) => (
                    <div
                      key={`label-${hour}`}
                      style={{ height: HOUR_ROW_H }}
                      className="flex items-center justify-end"
                    >
                      <span className="tabular-nums">
                        {formatHourLabel(hour)}
                      </span>
                    </div>
                  ))}
                  {hours.map((_, hourIndex) => (
                    <div
                      key={`gutter-line-${hourIndex}`}
                      className="pointer-events-none absolute left-0 right-0 border-t border-white/5"
                      style={{ top: (hourIndex + 1) * HOUR_ROW_H }}
                    />
                  ))}
                </div>

                {weekDays.map((day, columnIndex) => {
                  const todaysEvents = timedEvents.filter((event) =>
                    isSameDay(new Date(event.startISO), day),
                  );
                  const selectionPreview =
                    selectionState && selectionState.dayIndex === columnIndex
                      ? {
                          start: Math.min(
                            selectionState.originMinutes,
                            selectionState.currentMinutes,
                          ),
                          end: Math.max(
                            selectionState.originMinutes,
                            selectionState.currentMinutes,
                          ),
                        }
                      : null;
                  const isCurrentDay = isSameDay(day, today);

                  return (
                    <div
                      key={day.toISOString()}
                      ref={(node) => {
                        columnRefs.current[columnIndex] = node;
                      }}
                      className={`relative border-r border-white/10 last:border-r-0 text-xs ${
                        isCurrentDay ? "bg-white/[0.02]" : ""
                      }`}
                      style={{ height: GRID_HEIGHT_PX }}
                      onMouseDown={(event) =>
                        handleDayPointerDown(columnIndex, event)
                      }
                    >
                      {hours.map((_, hourIndex) => (
                        <div
                          key={`line-${columnIndex}-${hourIndex}`}
                          className="absolute left-0 right-0 border-t border-white/5"
                          style={{ top: (hourIndex + 1) * HOUR_ROW_H }}
                        />
                      ))}

                      {selectionPreview &&
                        (() => {
                          const previewTop = minutesToPixels(
                            selectionPreview.start,
                          );
                          const previewHeight = Math.max(
                            minutesToPixels(selectionPreview.end) - previewTop,
                            6,
                          );
                          return (
                            <div
                              className="pointer-events-none absolute left-2 right-2 rounded-md border border-white/20 bg-white/5"
                              style={{
                                top: previewTop,
                                height: previewHeight,
                              }}
                            />
                          );
                        })()}

                      {todaysEvents.map((eventItem) => {
                        const start = new Date(eventItem.startISO);
                        const end = new Date(eventItem.endISO);
                        const top = minutesToPixels(getMinutesFromDate(start));
                        const height =
                          minutesToPixels(getMinutesFromDate(end)) - top;
                        const isLinked = !!eventItem.taskId;
                        const isHighlighted = highlightedEventId === eventItem.id;
                        const isHabit = eventItem.eventKind === "habit";
                        const isDraft = !!eventItem.isDraft;
                        const isReadOnly =
                          isHabit || !!eventItem.readOnly || isDraft;
                        const autoplan = eventItem.eventKind === "auto_plan";
                        return (
                          <div
                            key={eventItem.id}
                            data-event-block
                            className={`group absolute inset-x-2 rounded-md border border-white/10 px-2 py-2 text-[12px] text-white/95 transition-colors ${
                              isLinked && !isReadOnly ? "border-white/30" : ""
                            } ${isHighlighted ? "ring-2 ring-white" : ""} ${
                              isReadOnly ? "opacity-80" : ""
                            } ${isDraft ? "border-dashed border-white/40" : ""} hover:border-white/20`}
                            style={{
                              top,
                              height: Math.max(
                                height,
                                (MIN_DURATION_MINUTES / 60) * HOUR_ROW_H,
                              ),
                              backgroundImage: `linear-gradient(135deg, ${eventItem.color}, rgba(0,0,0,0.35))`,
                            }}
                            onClick={(event) =>
                              handleEventClick(event, eventItem)
                            }
                          >
                            {isLinked && !isReadOnly && (
                              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white/70" />
                            )}
                            {!isReadOnly && (
                              <>
                                <div
                                  className="absolute left-3 right-3 top-1 h-0.5 cursor-ns-resize rounded-full bg-white/70 opacity-0 transition-opacity group-hover:opacity-100"
                                  onMouseDown={(event) =>
                                    handleResizeMouseDown(
                                      event,
                                      eventItem.id,
                                      columnIndex,
                                      "start",
                                    )
                                  }
                                />
                                <div
                                  className="absolute bottom-1 left-3 right-3 h-0.5 cursor-ns-resize rounded-full bg-white/70 opacity-0 transition-opacity group-hover:opacity-100"
                                  onMouseDown={(event) =>
                                    handleResizeMouseDown(
                                      event,
                                      eventItem.id,
                                      columnIndex,
                                      "end",
                                    )
                                  }
                                />
                              </>
                            )}
                            {(autoplan || isHabit) && (
                              <p className="text-[10px] uppercase tracking-[0.3em] text-white/80">
                                {isHabit ? "Habit" : "Auto plan"}
                              </p>
                            )}
                            <p className="text-[11px] opacity-90">
                              {formatTimeString(start)} – {formatTimeString(end)}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {eventItem.title}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="order-3 min-h-0 overflow-y-auto hide-scrollbar border-t border-white/10 bg-[#0f0f10] lg:border-t-0 lg:border-l">
            {renderEventDetailsPanel()}
          </aside>
        </div>
      </div>
    </div>
  );
}
