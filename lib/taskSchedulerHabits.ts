import { HABIT_DEFAULT_DURATION_MINUTES, HABIT_DEFAULT_START_MINUTES } from "@/lib/taskSchedulerConstants";
import { StudentTask, resolveCategoryColor } from "@/lib/taskSchedulerTypes";

export type HabitInstance = {
  id: string;
  taskId: string;
  title: string;
  startISO: string;
  endISO: string;
  color: string;
  dateKey: string;
  durationMinutes: number;
};

type GenerateHabitOptions = {
  startDate: Date;
  endDate: Date;
};

function cloneDate(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function minutesFromISO(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function habitOccursOnDay(task: StudentTask, day: Date) {
  if (task.category !== "habit") return false;
  if (task.repeatRule === "none") return false;
  if (task.repeatUntil) {
    const until = new Date(task.repeatUntil);
    until.setHours(23, 59, 59, 999);
    if (day.getTime() > until.getTime()) return false;
  }

  const weekday = day.getDay(); // 0 = Sun
  if (task.repeatRule === "daily") return true;
  if (task.repeatRule === "weekdays") {
    return weekday >= 1 && weekday <= 5;
  }
  if (task.repeatRule === "custom_days") {
    if (!task.repeatDays || !task.repeatDays.length) return false;
    return task.repeatDays.includes(weekday);
  }
  return false;
}

export function generateHabitInstances(
  tasks: StudentTask[],
  options: GenerateHabitOptions,
) {
  const { startDate, endDate } = options;
  const start = cloneDate(startDate);
  const end = cloneDate(endDate);
  const days = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const instances: HabitInstance[] = [];

  tasks.forEach((task) => {
    if (task.category !== "habit" || task.repeatRule === "none") return;

    const startMinutes =
      minutesFromISO(task.scheduledStart) ?? HABIT_DEFAULT_START_MINUTES;
    const endMinutes =
      minutesFromISO(task.scheduledEnd) ??
      startMinutes + HABIT_DEFAULT_DURATION_MINUTES;
    const duration = Math.max(10, endMinutes - startMinutes);
    const color = resolveCategoryColor(task.category);

    for (let offset = 0; offset <= days; offset += 1) {
      const day = addDays(start, offset);
      if (!habitOccursOnDay(task, day)) continue;
      const startDateTime = new Date(day);
      startDateTime.setHours(0, 0, 0, 0);
      startDateTime.setMinutes(startMinutes);
      const endDateTime = new Date(day);
      endDateTime.setHours(0, 0, 0, 0);
      endDateTime.setMinutes(startMinutes + duration);
      instances.push({
        id: `habit-${task.id}-${dateKey(day)}`,
        taskId: task.id,
        title: task.title,
        startISO: startDateTime.toISOString(),
        endISO: endDateTime.toISOString(),
        color,
        dateKey: dateKey(day),
        durationMinutes: duration,
      });
    }
  });

  return instances;
}
