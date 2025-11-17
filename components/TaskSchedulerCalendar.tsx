"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;
const START_MINUTES = DAY_START_HOUR * 60;
const END_MINUTES = (DAY_END_HOUR + 1) * 60;
const HOUR_HEIGHT = 60;
const MIN_DURATION_MINUTES = 30;
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const EVENT_COLORS = ["#9b7bff", "#f472b6", "#22d3ee", "#34d399", "#facc15"];

type CalendarEvent = {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  color: string;
};

type EditorState = {
  id: string | null;
  title: string;
  startISO: string;
  endISO: string;
  position: { x: number; y: number };
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
  return (relative / 60) * HOUR_HEIGHT;
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
  const first = new Date(monthReference.getFullYear(), monthReference.getMonth(), 1);
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

function generateInitialEvents(weekStart: Date): CalendarEvent[] {
  const monday = addDays(weekStart, 1);
  monday.setHours(9, 0, 0, 0);
  const mondayEnd = new Date(monday);
  mondayEnd.setHours(11, 0, 0, 0);

  const wednesday = addDays(weekStart, 3);
  wednesday.setHours(14, 0, 0, 0);
  const wednesdayEnd = new Date(wednesday);
  wednesdayEnd.setHours(15, 30, 0, 0);

  return [
    {
      id: "sample-focus",
      title: "Deep work sprint",
      startISO: monday.toISOString(),
      endISO: mondayEnd.toISOString(),
      color: EVENT_COLORS[0],
    },
    {
      id: "sample-review",
      title: "Essay revision",
      startISO: wednesday.toISOString(),
      endISO: wednesdayEnd.toISOString(),
      color: EVENT_COLORS[1],
    },
  ];
}

export default function TaskSchedulerCalendar() {
  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    getStartOfWeek(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [miniCalendarCollapsed, setMiniCalendarCollapsed] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    generateInitialEvents(getStartOfWeek(new Date())),
  );
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(
    null,
  );
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
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

  const hours = useMemo(
    () =>
      Array.from(
        { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
        (_, index) => DAY_START_HOUR + index,
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
    const minutes =
      START_MINUTES + ratio * (END_MINUTES - START_MINUTES);
    return clampMinutes(minutes);
  }

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
              return { ...evt, startISO: nextStart.toISOString() };
            }
            const startMinutes = getMinutesFromDate(new Date(evt.startISO));
            const nextMinutes = clampMinutes(
              Math.max(minutes, startMinutes + MIN_DURATION_MINUTES),
            );
            const nextEnd = createDateWithMinutes(day, nextMinutes);
            return { ...evt, endISO: nextEnd.toISOString() };
          }),
        );
      }
    }

    function handleMouseUp() {
      if (selectionState) {
        finalizeSelection(selectionState);
        setSelectionState(null);
      }
      if (resizeState) {
        setResizeState(null);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectionState, resizeState]);

  function finalizeSelection(selection: SelectionState) {
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
      position: anchor,
    });
  }

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
    dayIndex: number,
  ) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    openEditor({
      id: calendarEvent.id,
      title: calendarEvent.title,
      startISO: calendarEvent.startISO,
      endISO: calendarEvent.endISO,
      position: { x: rect.right + 12, y: rect.top },
    });
  }

  function updateEditorField(field: "title" | "startISO" | "endISO", value: string) {
    setEditorState((prev) =>
      prev ? { ...prev, [field]: value } : prev,
    );
  }

  function handleTimeChange(field: "start" | "end", value: string) {
    if (!editorState) return;
    const base = new Date(
      field === "start" ? editorState.startISO : editorState.endISO,
    );
    const [hours, minutes] = value.split(":").map((part) => parseInt(part, 10));
    base.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
    const nextISO = base.toISOString();
    if (field === "start") {
      updateEditorField("startISO", nextISO);
    } else {
      updateEditorField("endISO", nextISO);
    }
  }

  function handleSaveEvent() {
    if (!editorState) return;
    const { id, endISO, startISO, title } = editorState;
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (end.getTime() <= start.getTime()) {
      alert("End time must be after the start time.");
      return;
    }

    setEvents((prev) => {
      const payload: CalendarEvent = {
        id: id ?? (crypto?.randomUUID?.() ?? `evt-${Date.now()}`),
        title: title.trim() || "Untitled block",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        color: id
          ? prev.find((event) => event.id === id)?.color ?? EVENT_COLORS[0]
          : EVENT_COLORS[prev.length % EVENT_COLORS.length],
      };

      const nextEvents = id
        ? prev.map((event) => (event.id === id ? payload : event))
        : [...prev, payload];

      return nextEvents.sort(
        (a, b) =>
          new Date(a.startISO).getTime() - new Date(b.startISO).getTime(),
      );
    });

    closeEditor();
  }

  function handleDeleteEvent() {
    if (!editorState?.id) {
      closeEditor();
      return;
    }
    setEvents((prev) =>
      prev.filter((event) => event.id !== editorState.id),
    );
    closeEditor();
  }

  return (
    <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-[#141425] via-[#0d0d18] to-[#08080f] p-6 text-white">
      <div className="flex flex-col gap-6 xl:flex-row">
        <aside className="w-full xl:w-80">
          <p className="text-xs uppercase tracking-[0.45em] text-white/40">
            Scheduling
          </p>
          <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{monthReference.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              <button
                type="button"
                onClick={() => setMiniCalendarCollapsed((prev) => !prev)}
                className="rounded-full border border-white/20 p-1 text-white/70 transition hover:border-white/50"
                aria-label="Toggle mini calendar"
              >
                <span
                  className={`inline-block transition-transform ${
                    miniCalendarCollapsed ? "-rotate-90" : "-rotate-0"
                  }`}
                >
                  ˅
                </span>
              </button>
            </div>

            {!miniCalendarCollapsed && (
              <div className="mt-3">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.2em] text-white/40">
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
                        className={`grid grid-cols-7 gap-1 rounded-2xl px-1 py-0.5 ${
                          isActiveWeek ? "bg-white/5" : ""
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
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition ${
                                isSelected
                                  ? "bg-gradient-to-br from-[#ff5ddd] via-[#b157ff] to-[#8a5bff] text-white"
                                  : "text-white/70"
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
          </div>

          <div className="mt-6 rounded-3xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-zinc-400">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">
              Internal calendars
            </p>
            <p className="mt-2 text-sm">
              Learning, Uni Applications, and clubs will live here soon.
            </p>
          </div>
        </aside>

        <section className="flex-1 rounded-3xl border border-white/10 bg-[#090912] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                Week view
              </p>
              <h2 className="text-2xl font-semibold">{monthLabel}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                className="flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-white/80"
              >
                Week
                <span className="text-xs text-white/50">▾</span>
              </button>
              <button
                type="button"
                onClick={handleTabToday}
                className="rounded-full border border-white/20 px-4 py-1.5 text-white transition hover:border-white/50"
              >
                Today
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  className="rounded-full border border-white/20 p-2 text-lg text-white/80 transition hover:border-white/50"
                  aria-label="Previous week"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  className="rounded-full border border-white/20 p-2 text-lg text-white/80 transition hover:border-white/50"
                  aria-label="Next week"
                >
                  →
                </button>
              </div>
              <div className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#8a5bff] to-[#ff5ddd] text-xs font-semibold uppercase tracking-widest">
                You
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="grid grid-cols-7 gap-0 border-b border-white/10 text-center text-sm text-white/70">
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="pb-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      isSameDay(day, new Date()) ? "text-white" : "text-white/80"
                    }`}
                  >
                    {day.getDate()}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-1 flex">
              <div className="w-16 pr-3 text-right text-xs text-white/40">
                {hours.map((hour) => (
                  <div
                    key={`label-${hour}`}
                    style={{ height: HOUR_HEIGHT }}
                    className="relative"
                  >
                    <span className="absolute -top-2 right-0">
                      {formatHourLabel(hour)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative flex-1 overflow-hidden">
                <div className="grid h-full grid-cols-7 border-l border-white/10 text-xs">
                  {weekDays.map((day, columnIndex) => {
                    const todaysEvents = events.filter((event) =>
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
                        className="relative border-r border-white/5 last:border-r-0"
                        style={{
                          height:
                            ((END_MINUTES - START_MINUTES) / 60) * HOUR_HEIGHT,
                        }}
                        onMouseDown={(event) =>
                          handleDayPointerDown(columnIndex, event)
                        }
                      >
                        {hours.map((_, hourIndex) => (
                          <div
                            key={`line-${columnIndex}-${hourIndex}`}
                            className="absolute left-0 right-0 border-b border-white/5"
                            style={{ top: (hourIndex + 1) * HOUR_HEIGHT }}
                          />
                        ))}

                        {showNow && (
                          <div
                            className="pointer-events-none absolute left-0 right-0"
                            style={{
                              top: minutesToPixels(nowMinutes),
                            }}
                          >
                            <span className="absolute -left-16 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                              {formatTimeString(now)}
                            </span>
                            <div className="h-px bg-gradient-to-r from-transparent via-rose-400 to-transparent" />
                          </div>
                        )}

                        {selectionPreview && (() => {
                          const previewTop = minutesToPixels(
                            selectionPreview.start,
                          );
                          const previewHeight = Math.max(
                            minutesToPixels(selectionPreview.end) - previewTop,
                            6,
                          );
                          return (
                            <div
                              className="pointer-events-none absolute left-2 right-2 rounded-2xl border border-white/30 bg-white/10"
                              style={{ top: previewTop, height: previewHeight }}
                            />
                          );
                        })()}

                        {todaysEvents.map((eventItem) => {
                          const start = new Date(eventItem.startISO);
                          const end = new Date(eventItem.endISO);
                          const top = minutesToPixels(getMinutesFromDate(start));
                          const height =
                            minutesToPixels(getMinutesFromDate(end)) - top;
                          return (
                            <div
                              key={eventItem.id}
                              data-event-block
                              className="absolute inset-x-2 rounded-2xl p-3 text-xs text-white shadow-lg"
                              style={{
                                top,
                                height: Math.max(
                                  height,
                                  (MIN_DURATION_MINUTES / 60) * HOUR_HEIGHT,
                                ),
                                backgroundColor: eventItem.color,
                              }}
                              onClick={(event) =>
                                handleEventClick(event, eventItem, columnIndex)
                              }
                            >
                              <div
                                className="absolute left-3 right-3 top-1 h-1 cursor-ns-resize rounded-full bg-white/60"
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
                                className="absolute bottom-1 left-3 right-3 h-1 cursor-ns-resize rounded-full bg-white/60"
                                onMouseDown={(event) =>
                                  handleResizeMouseDown(
                                    event,
                                    eventItem.id,
                                    columnIndex,
                                    "end",
                                  )
                                }
                              />
                              <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">
                                {formatTimeString(start)} –{" "}
                                {formatTimeString(end)}
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
            </div>
          </div>
        </section>
      </div>

      {editorState && (
        <div
          className="fixed z-50 rounded-2xl border border-white/20 bg-[#05050b] p-4 shadow-2xl"
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
                onChange={(event) => updateEditorField("title", event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Study session"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Start
                </label>
                <input
                  type="time"
                  value={formatInputTime(new Date(editorState.startISO))}
                  onChange={(event) => handleTimeChange("start", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-2 text-sm text-white outline-none focus:border-white/40"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                  End
                </label>
                <input
                  type="time"
                  value={formatInputTime(new Date(editorState.endISO))}
                  onChange={(event) => handleTimeChange("end", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 p-2 text-sm text-white outline-none focus:border-white/40"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleDeleteEvent}
              className="text-white/50 transition hover:text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={handleSaveEvent}
              className="rounded-xl bg-gradient-to-r from-[#8a5bff] via-[#b157ff] to-[#ff5ddd] px-4 py-2 font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
