"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  StudentTask,
  TaskCalendarEvent as PersistedEvent,
} from "@/lib/taskSchedulerTypes";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  Link2,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { TASK_DAILY_MINUTES_LIMIT } from "@/lib/taskSchedulerConstants";
import {
  generateHabitInstances,
  type HabitInstance,
} from "@/lib/taskSchedulerHabits";

const START_HOUR = 1;
const END_HOUR = 24;
const TIME_GUTTER_W = 72; // px (tune to match Notion)
const ALLDAY_H = 32; // px (tune to match Notion)
const HOUR_ROW_H = 64; // px (use existing if already close)

const START_MINUTES = START_HOUR * 60;
const END_MINUTES = END_HOUR * 60;
const GRID_TEMPLATE_COLUMNS = `${TIME_GUTTER_W}px repeat(7, minmax(0, 1fr))`;
const GRID_HEIGHT_PX = (END_HOUR - START_HOUR) * HOUR_ROW_H;
const GRID_COLUMNS_STYLE: React.CSSProperties = {
  gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
};
const MIN_DURATION_MINUTES = 30;
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const EVENT_COLORS = ["#9b7bff", "#f472b6", "#22d3ee", "#34d399", "#facc15"];

type CalendarEvent = {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  color: string;
  taskId: string | null;
  eventKind: PersistedEvent["eventKind"] | "habit";
  readOnly?: boolean;
  isVirtual?: boolean;
};

type EditorState = {
  id: string | null;
  title: string;
  startISO: string;
  endISO: string;
  position: { x: number; y: number };
  taskId: string | null;
  color: string;
};

type CalendarEventInput = {
  title: string;
  start: string;
  end: string;
  taskId: string | null;
  color?: string | null;
};

type TaskSchedulerCalendarProps = {
  events: PersistedEvent[];
  tasks: StudentTask[];
  loading?: boolean;
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

function snapToIncrement(minutes: number, increment = 15) {
  return Math.round(minutes / increment) * increment;
}

function minutesToPixels(minutes: number) {
  const relative = clampMinutes(minutes) - START_MINUTES;
  return (relative / 60) * HOUR_ROW_H;
}

function dateKeyFromISO(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function eventDurationMinutes(event: CalendarEvent) {
  const start = new Date(event.startISO);
  const end = new Date(event.endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
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

function formatInputTime(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
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

function mapPersistedEvent(event: PersistedEvent): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    startISO: event.start,
    endISO: event.end,
    color: event.color ?? EVENT_COLORS[0],
    taskId: event.taskId ?? null,
    eventKind: event.eventKind,
  };
}

function buildEventInput(event: CalendarEvent): CalendarEventInput {
  return {
    title: event.title,
    start: event.startISO,
    end: event.endISO,
    taskId: event.taskId,
    color: event.color,
  };
}

function computeDailyMinutes(eventsList: CalendarEvent[]) {
  const map = new Map<string, number>();
  eventsList.forEach((event) => {
    const key = dateKeyFromISO(event.startISO);
    if (!key) return;
    const duration = eventDurationMinutes(event);
    if (duration <= 0) return;
    map.set(key, (map.get(key) ?? 0) + duration);
  });
  return map;
}

export default function TaskSchedulerCalendar({
  events: persistedEvents,
  tasks,
  loading = false,
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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const eventsRef = useRef<CalendarEvent[]>([]);
  const pendingResizeRef = useRef<CalendarEvent | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(
    null,
  );
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(
    null,
  );
  const [savingEvent, setSavingEvent] = useState(false);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    const mapped = persistedEvents.map(mapPersistedEvent);
    setEvents(mapped);
    eventsRef.current = mapped;
  }, [persistedEvents]);

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

  const habitEvents = useMemo(
    () =>
      habitInstances.map((instance) => ({
        id: instance.id,
        title: `${instance.title}`,
        startISO: instance.startISO,
        endISO: instance.endISO,
        color: instance.color,
        taskId: instance.taskId,
        eventKind: "habit" as const,
        readOnly: true,
        isVirtual: true,
      })),
    [habitInstances],
  );

  const renderedEvents = useMemo(
    () => [...events, ...habitEvents],
    [events, habitEvents],
  );

  const persistedDailyMinutes = useMemo(
    () => computeDailyMinutes(events),
    [events],
  );
  const habitDailyMinutes = useMemo(
    () => computeDailyMinutes(habitEvents),
    [habitEvents],
  );
  const combinedDailyMinutes = useMemo(() => {
    const combined = new Map(persistedDailyMinutes);
    habitDailyMinutes.forEach((value, key) => {
      combined.set(key, (combined.get(key) ?? 0) + value);
    });
    return combined;
  }, [persistedDailyMinutes, habitDailyMinutes]);

  const overloadedDayKeys = useMemo(() => {
    const keys = new Set<string>();
    combinedDailyMinutes.forEach((minutes, key) => {
      if (minutes > TASK_DAILY_MINUTES_LIMIT) {
        keys.add(key);
      }
    });
    return keys;
  }, [combinedDailyMinutes]);

  const getBaselineMinutesForDay = useCallback(
    (dayKey: string, excludeEventId?: string | null) => {
      let baseline = combinedDailyMinutes.get(dayKey) ?? 0;
      if (excludeEventId) {
        const match = events.find((evt) => evt.id === excludeEventId);
        if (match && dateKeyFromISO(match.startISO) === dayKey) {
          baseline -= eventDurationMinutes(match);
        }
      }
      return baseline;
    },
    [combinedDailyMinutes, events],
  );

  const confirmDailyOverload = useCallback(
    (dayKey: string, minutes: number, excludeEventId?: string | null) => {
      const baseline = getBaselineMinutesForDay(dayKey, excludeEventId);
      if (baseline + minutes <= TASK_DAILY_MINUTES_LIMIT) {
        return true;
      }
      const hours = (baseline / 60).toFixed(1);
      return window.confirm(
        `This day already has ~${hours}h planned. Add more time?`,
      );
    },
    [getBaselineMinutesForDay],
  );

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(visibleWeekStart, index);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  }, [visibleWeekStart]);
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
      const color = EVENT_COLORS[events.length % EVENT_COLORS.length];
      openEditor({
        id: null,
        title: "",
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        position: anchor,
        taskId: null,
        color,
      });
    },
    [events.length],
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
      const height = 230;
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
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    calendarEvent: CalendarEvent,
  ) {
    event.stopPropagation();
    if (selectionState || resizeState) {
      setSelectionState(null);
      setResizeState(null);
      return;
    }
    if (calendarEvent.readOnly) return;
    const rect = (
      event.currentTarget as HTMLDivElement
    ).getBoundingClientRect();
    openEditor({
      id: calendarEvent.id,
      title: calendarEvent.title,
      startISO: calendarEvent.startISO,
      endISO: calendarEvent.endISO,
      position: { x: rect.right + 12, y: rect.top },
      taskId: calendarEvent.taskId,
      color: calendarEvent.color,
    });
  }

  function handleLinkChange(taskId: string | null) {
    const linkedTask = taskId ? tasks.find((task) => task.id === taskId) : null;
    setEditorState((prev) =>
      prev
        ? {
            ...prev,
            taskId,
            title: linkedTask ? linkedTask.title : prev.title,
          }
        : prev,
    );
  }

  function updateEditorField<K extends keyof EditorState>(
    field: K,
    value: EditorState[K],
  ) {
    setEditorState((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleTimeChange(field: "start" | "end", value: string) {
    if (!editorState) return;
    const base = new Date(
      field === "start" ? editorState.startISO : editorState.endISO,
    );
    const [hours, minutes] = value.split(":").map((part) => parseInt(part, 10));
    base.setHours(
      Number.isNaN(hours) ? 0 : hours,
      Number.isNaN(minutes) ? 0 : minutes,
      0,
      0,
    );
    const nextISO = base.toISOString();
    if (field === "start") {
      updateEditorField("startISO", nextISO);
    } else {
      updateEditorField("endISO", nextISO);
    }
  }

  async function handleSaveEvent() {
    if (!editorState) return;
    const { id, endISO, startISO, title, taskId, color } = editorState;
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (end.getTime() <= start.getTime()) {
      alert("End time must be after the start time.");
      return;
    }
    const dayKey = dateKeyFromISO(start.toISOString());
    const durationMinutes = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    if (!confirmDailyOverload(dayKey, durationMinutes, id)) {
      return;
    }
    const payload: CalendarEventInput = {
      title: title.trim() || "Untitled block",
      start: start.toISOString(),
      end: end.toISOString(),
      taskId,
      color,
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

  return (
    <div className="notion-calendar flex h-full min-h-0 w-full flex-col text-white">
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#0f0f10]">
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)_288px]">
          <aside className="order-2 min-h-0 overflow-y-auto hide-scrollbar border-t border-white/10 bg-[#0f0f10] px-3 py-2 lg:order-1 lg:border-t-0 lg:border-r">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Link2 className="h-4 w-4 text-white/40" aria-hidden />
                <p className="truncate text-[13px] font-semibold leading-5 text-white/85">
                  Scheduling
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/5 hover:text-white"
                onClick={() => {}}
                aria-label="Toggle scheduling visibility"
              >
                <Eye className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-2">
              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
                <Users className="h-4 w-4 text-white/35" aria-hidden />
                <input
                  className="w-full bg-transparent text-[13px] leading-5 text-white/80 outline-none placeholder:text-white/40"
                  placeholder="Meet with…"
                />
              </div>
            </div>

            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold leading-5 text-white/90">
                  {monthReference.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
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

              {!miniCalendarCollapsed && (
                <div className="mt-3">
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
                            const miniDateKey = day.toISOString().slice(0, 10);
                            const overloadedMini =
                              overloadedDayKeys.has(miniDateKey);
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
                                {overloadedMini && (
                                  <span className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-rose-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                Google Calendar
              </p>
              <div className="mt-1 space-y-0.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] leading-5 text-white/70 transition hover:bg-white/[0.03] hover:text-white"
                  onClick={() => {}}
                >
                  <Plus className="h-4 w-4 text-white/40" aria-hidden />
                  <span>Add calendar account</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] leading-5 text-white/70 transition hover:bg-white/[0.03] hover:text-white"
                  onClick={() => {}}
                >
                  <Database className="h-4 w-4 text-white/40" aria-hidden />
                  <span>Add Notion database</span>
                </button>
              </div>
            </div>
          </aside>

          <section className="order-1 flex min-h-0 min-w-0 flex-col lg:order-2">
            <header className="flex h-11 items-center justify-between gap-2 border-b border-white/10 px-3">
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
                  <div className="flex items-center justify-end border-r border-white/10 pr-3 text-[11px] font-medium text-white/30">
                    &nbsp;
                  </div>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex items-center border-r border-white/10 px-2 py-1.5 last:border-r-0 ${
                          isToday ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <div className="flex flex-col leading-tight">
                          <span className="text-[11px] font-medium text-white/50">
                            {day.toLocaleDateString(undefined, {
                              weekday: "short",
                            })}
                          </span>
                          <span
                            className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[15px] font-semibold ${
                              isSelected
                                ? "bg-sky-500/25 text-sky-100"
                                : isToday
                                  ? "text-white"
                                  : "text-white/80"
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
                  style={{ ...GRID_COLUMNS_STYLE, height: ALLDAY_H }}
                >
                  <div className="allday-label flex h-full items-center justify-center whitespace-nowrap border-r border-white/10 text-[11px] font-medium text-white/40">
                    All-day
                  </div>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={`all-day-${day.toISOString()}`}
                        className={`h-full border-r border-white/10 last:border-r-0 ${
                          isToday ? "bg-white/[0.02]" : ""
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="grid min-h-[520px] bg-[#0f0f10]" style={GRID_COLUMNS_STYLE}>
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
                  const todaysEvents = renderedEvents.filter((event) =>
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
                  const isCurrentDay = isSameDay(day, new Date());
                  const now = new Date();
                  const nowMinutes = getMinutesFromDate(now);
                  const showNow =
                    isCurrentDay &&
                    nowMinutes >= START_MINUTES &&
                    nowMinutes <= END_MINUTES;

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

                      {showNow && (
                        <div
                          className="pointer-events-none absolute left-0 right-0"
                          style={{
                            top: minutesToPixels(nowMinutes),
                          }}
                        >
                          <span
                            className="absolute rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                            style={{ left: -TIME_GUTTER_W }}
                          >
                            {formatTimeString(now)}
                          </span>
                          <div className="h-px bg-rose-400/70" />
                        </div>
                      )}

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
                        const readOnly = eventItem.eventKind === "habit";
                        const autoplan = eventItem.eventKind === "auto_plan";
                        return (
                          <div
                            key={eventItem.id}
                            data-event-block
                            className={`group absolute inset-x-2 rounded-md border border-white/10 px-2 py-2 text-[12px] text-white/95 transition-colors ${
                              isLinked && !readOnly ? "border-white/30" : ""
                            } ${isHighlighted ? "ring-2 ring-white" : ""} ${
                              readOnly ? "opacity-80" : ""
                            } hover:border-white/20`}
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
                            {isLinked && !readOnly && (
                              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white/70" />
                            )}
                            {!readOnly && (
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
                            {(autoplan || readOnly) && (
                              <p className="text-[10px] uppercase tracking-[0.3em] text-white/80">
                                {readOnly ? "Habit" : "Auto plan"}
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

          <aside className="order-3 min-h-0 overflow-y-auto hide-scrollbar border-t border-white/10 bg-[#0f0f10] px-3 py-2 lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
              <Search className="h-4 w-4 text-white/35" aria-hidden />
              <input
                className="w-full bg-transparent text-[13px] leading-5 text-white/80 outline-none placeholder:text-white/40"
                placeholder="Search"
              />
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                Useful shortcuts
              </p>
              <div className="mt-2 space-y-0.5">
                {[
                  { label: "Command menu", keys: "Ctrl + K" },
                  { label: "Toggle calendar sidebar", keys: "Ctrl + Alt + K" },
                  { label: "Go to date", keys: "G" },
                  { label: "All keyboard shortcuts", keys: "?" },
                ].map((item) => {
                  const keyParts = item.keys
                    .split("+")
                    .map((part) => part.trim())
                    .filter(Boolean);

                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] leading-5 text-white/80 hover:bg-white/[0.03]"
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/60">
                        {keyParts.map((part, index) => (
                          <span
                            key={`${part}-${index}`}
                            className="inline-flex items-center gap-1"
                          >
                            {index > 0 && (
                              <span className="text-white/25">+</span>
                            )}
                            <kbd>{part}</kbd>
                          </span>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {editorState && (
        <div
          className="fixed z-50 rounded-lg border border-white/15 bg-[#111112] p-4 shadow-xl"
          style={{
            left: editorState.position.x,
            top: editorState.position.y,
            width: 280,
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editorState.id ? "Edit block" : "New block"}
            </h3>
            <button
              type="button"
              onClick={closeEditor}
              className="text-white/60 transition hover:text-white"
              aria-label="Close editor"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                Title
              </label>
              <input
                value={editorState.title}
                onChange={(event) =>
                  updateEditorField("title", event.target.value)
                }
                disabled={!!editorState.taskId}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-white outline-none focus:border-white/30"
                placeholder="Study session"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                Link to task
              </label>
              <select
                value={editorState.taskId ?? ""}
                onChange={(event) =>
                  handleLinkChange(event.target.value || null)
                }
                className="mt-1 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="">Not linked</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Start
                </label>
                <input
                  type="time"
                  value={formatInputTime(new Date(editorState.startISO))}
                  onChange={(event) =>
                    handleTimeChange("start", event.target.value)
                  }
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                  End
                </label>
                <input
                  type="time"
                  value={formatInputTime(new Date(editorState.endISO))}
                  onChange={(event) =>
                    handleTimeChange("end", event.target.value)
                  }
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleDeleteEvent}
              disabled={savingEvent}
              className="text-white/50 transition hover:text-white disabled:opacity-40"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={handleSaveEvent}
              disabled={savingEvent}
              className="rounded-md border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              {savingEvent ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
