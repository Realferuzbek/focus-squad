"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  StudentTask,
  StudentTaskStatus,
  TaskEstimateMinutes,
  TaskCalendar,
  TASK_ESTIMATE_MINUTES,
  TASK_STATUSES,
} from "@/lib/taskSchedulerTypes";
import { normalizeEstimateOption } from "@/lib/taskSchedulerValidation";

type SelectedEntity =
  | { kind: "none" }
  | { kind: "task"; id: string }
  | { kind: "calendar"; id: string }
  | { kind: "privateItem"; id: string };

type TaskUpdatePayload = Partial<
  Pick<StudentTask, "title" | "description" | "estimatedMinutes" | "status">
>;

type PlannerInspectorProps = {
  selectedEntity: SelectedEntity;
  tasks: StudentTask[];
  calendars: TaskCalendar[];
  calendarsLoading: boolean;
  taskSavingIds?: Set<string>;
  onUpdateTask: (taskId: string, updates: TaskUpdatePayload) => Promise<void>;
  onScheduleTask: (task: StudentTask, calendarId?: string | null) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
};

type MenuOption = {
  value: string;
  label: string;
  color?: string | null;
};

const STATUS_LABELS: Record<StudentTaskStatus, string> = {
  planned: "Planned",
  active: "Active",
  in_progress: "In Progress",
  not_started: "Not Started",
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getDefaultCalendarId(calendars: TaskCalendar[]) {
  return (
    calendars.find((calendar) => calendar.isDefault)?.id ??
    calendars[0]?.id ??
    null
  );
}

function InspectorSelect({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  options: MenuOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
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
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.3em] text-white/40">
        {label}
      </p>
      <div className="relative" ref={wrapperRef}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled || options.length === 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedOption?.color && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selectedOption.color }}
                aria-hidden
              />
            )}
            <span className="truncate">
              {selectedOption?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown
            className={classNames(
              "h-4 w-4 shrink-0 text-white/60 transition",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {open && !disabled && options.length > 0 && (
          <div
            role="listbox"
            className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-[#0b0b0f] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
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
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition",
                    isSelected
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {option.color && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color }}
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlannerInspector({
  selectedEntity,
  tasks,
  calendars,
  calendarsLoading,
  taskSavingIds,
  onUpdateTask,
  onScheduleTask,
  onDeleteTask,
}: PlannerInspectorProps) {
  const selectedTask = useMemo(() => {
    if (selectedEntity.kind !== "task") return null;
    return tasks.find((task) => task.id === selectedEntity.id) ?? null;
  }, [selectedEntity, tasks]);

  const [titleDraft, setTitleDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<StudentTaskStatus>("planned");
  const [estimateDraft, setEstimateDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [calendarSelections, setCalendarSelections] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    if (!selectedTask) return;
    setTitleDraft(selectedTask.title ?? "");
    setStatusDraft(selectedTask.status ?? "planned");
    setEstimateDraft(
      typeof selectedTask.estimatedMinutes === "number"
        ? String(selectedTask.estimatedMinutes)
        : "",
    );
    setNotesDraft(selectedTask.description ?? "");
  }, [selectedTask]);

  const defaultCalendarId = useMemo(
    () => getDefaultCalendarId(calendars),
    [calendars],
  );

  const resolvedCalendarId = useMemo(() => {
    if (!selectedTask) return defaultCalendarId;
    const stored = calendarSelections[selectedTask.id] ?? null;
    const candidate = stored ?? defaultCalendarId;
    if (!candidate) return null;
    const exists = calendars.some((calendar) => calendar.id === candidate);
    return exists ? candidate : defaultCalendarId;
  }, [calendarSelections, calendars, defaultCalendarId, selectedTask]);

  const isSaving = selectedTask
    ? taskSavingIds?.has(selectedTask.id) ?? false
    : false;

  const statusOptions = useMemo<MenuOption[]>(
    () =>
      TASK_STATUSES.map((status) => ({
        value: status,
        label: STATUS_LABELS[status],
      })),
    [],
  );

  const calendarOptions = useMemo<MenuOption[]>(
    () =>
      calendars.map((calendar) => ({
        value: calendar.id,
        label: calendar.name,
        color: calendar.color,
      })),
    [calendars],
  );

  async function commitTitle() {
    if (!selectedTask) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(selectedTask.title);
      return;
    }
    if (trimmed === selectedTask.title) return;
    await onUpdateTask(selectedTask.id, { title: trimmed });
  }

  async function commitEstimate() {
    if (!selectedTask) return;
    const trimmed = estimateDraft.trim();
    if (!trimmed) {
      if (selectedTask.estimatedMinutes !== null) {
        await onUpdateTask(selectedTask.id, { estimatedMinutes: null });
      }
      return;
    }
    const normalized = normalizeEstimateOption(trimmed, TASK_ESTIMATE_MINUTES);
    if (normalized === null) {
      setEstimateDraft(
        typeof selectedTask.estimatedMinutes === "number"
          ? String(selectedTask.estimatedMinutes)
          : "",
      );
      return;
    }
    const nextValue = normalized as TaskEstimateMinutes;
    if (nextValue === selectedTask.estimatedMinutes) return;
    await onUpdateTask(selectedTask.id, { estimatedMinutes: nextValue });
  }

  async function commitNotes() {
    if (!selectedTask) return;
    const normalized = notesDraft.trim();
    const nextValue = normalized ? notesDraft : null;
    const currentValue = selectedTask.description ?? null;
    if (nextValue === currentValue) return;
    await onUpdateTask(selectedTask.id, { description: nextValue });
  }

  function handleStatusChange(value: string) {
    if (!selectedTask) return;
    const nextStatus = value as StudentTaskStatus;
    setStatusDraft(nextStatus);
    if (nextStatus !== selectedTask.status) {
      onUpdateTask(selectedTask.id, { status: nextStatus });
    }
  }

  function handleCalendarChange(value: string) {
    if (!selectedTask) return;
    setCalendarSelections((prev) => ({ ...prev, [selectedTask.id]: value }));
  }

  function handleSchedule() {
    if (!selectedTask) return;
    onScheduleTask(selectedTask, resolvedCalendarId ?? null);
  }

  function handleSetActive() {
    if (!selectedTask || selectedTask.status === "active") return;
    setStatusDraft("active");
    onUpdateTask(selectedTask.id, { status: "active" });
  }

  async function handleDelete() {
    if (!selectedTask || !onDeleteTask) return;
    await onDeleteTask(selectedTask.id);
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0c0c16] p-5">
      <p className="text-xs uppercase tracking-[0.35em] text-white/40">
        Inspector
      </p>
      {!selectedTask ? (
        <p className="mt-3 text-sm text-zinc-400">
          Select a task to edit details.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Title
            </p>
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              disabled={isSaving}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:opacity-60"
            />
          </div>

          {"status" in selectedTask && (
            <InspectorSelect
              label="Status"
              value={statusDraft}
              options={statusOptions}
              placeholder="Select status"
              disabled={isSaving}
              onChange={handleStatusChange}
            />
          )}

          {"estimatedMinutes" in selectedTask && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Estimate minutes
              </p>
              <input
                type="number"
                min={0}
                value={estimateDraft}
                onChange={(event) => setEstimateDraft(event.target.value)}
                onBlur={commitEstimate}
                disabled={isSaving}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:opacity-60"
              />
            </div>
          )}

          {"description" in selectedTask && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Notes
              </p>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                onBlur={commitNotes}
                rows={4}
                disabled={isSaving}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:opacity-60"
              />
            </div>
          )}

          <InspectorSelect
            label="Calendar"
            value={resolvedCalendarId}
            options={calendarOptions}
            placeholder={
              calendarsLoading
                ? "Loading calendars..."
                : calendars.length === 0
                  ? "No calendars"
                  : "Choose calendar"
            }
            disabled={calendarsLoading || calendars.length === 0}
            onChange={handleCalendarChange}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSchedule}
              disabled={isSaving}
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white disabled:opacity-50"
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={handleSetActive}
              disabled={isSaving || selectedTask.status === "active"}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              Set active
            </button>
            {onDeleteTask && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200 transition hover:border-rose-300/60 hover:text-rose-100 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
