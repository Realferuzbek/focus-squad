import { DateTime } from "luxon";
export const TASHKENT = "Asia/Tashkent";
export const nowTashkent = () => DateTime.now().setZone(TASHKENT);
export const todayTashkent = () => nowTashkent().toISODate()!;
export const getUzbekDateKey = (date: Date = new Date()) =>
  DateTime.fromJSDate(date).setZone(TASHKENT).toISODate()!;
export const isAfterTen = () =>
  nowTashkent().hour > 10 ||
  (nowTashkent().hour === 10 && nowTashkent().minute >= 0);
export const parseISOInTashkent = (s: string) =>
  DateTime.fromISO(s, { zone: TASHKENT });
