// R0：稼働日（平日のみ。土日・日本の祝日は休み）の計算。
// 日付はすべて "YYYY-MM-DD" の文字列で扱う（DB の date 型と同じ。タイムゾーンでずれないように）。
// 内部の計算は UTC の 0 時として行う。
import holidayJp from "@holiday-jp/holiday_jp";

/** "YYYY-MM-DD" 形式の日付 */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 実在する日付の "YYYY-MM-DD" か */
export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toTime(date: IsoDate): number {
  if (!isIsoDate(date)) throw new RangeError(`日付の形式が正しくありません: ${date}`);
  return Date.parse(`${date}T00:00:00Z`);
}

function fromTime(time: number): IsoDate {
  return new Date(time).toISOString().slice(0, 10);
}

/** 暦日で n 日ずらす */
export function addDays(date: IsoDate, n: number): IsoDate {
  return fromTime(toTime(date) + n * DAY_MS);
}

/** 暦日の差（b − a） */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toTime(b) - toTime(a)) / DAY_MS);
}

/** ISO 曜日（月=1 … 日=7） */
export function isoWeekday(date: IsoDate): number {
  const day = new Date(toTime(date)).getUTCDay(); // 日=0
  return day === 0 ? 7 : day;
}

/** 日本の祝日名（祝日でなければ null）。振替休日・国民の休日を含む */
export function holidayName(date: IsoDate): string | null {
  toTime(date); // 形式チェック
  const holidays = holidayJp.holidays as Record<string, { name: string } | undefined>;
  return holidays[date]?.name ?? null;
}

export function isHoliday(date: IsoDate): boolean {
  return holidayName(date) !== null;
}

/** 稼働日か（土日・祝日でない） */
export function isWorkday(date: IsoDate): boolean {
  return isoWeekday(date) <= 5 && !isHoliday(date);
}

/** 休みの理由（稼働日なら null）。エラーメッセージ用 */
export function nonWorkdayReason(date: IsoDate): string | null {
  const wd = isoWeekday(date);
  if (wd === 6) return "土曜日";
  if (wd === 7) return "日曜日";
  return holidayName(date);
}

/** date より後の、最初の稼働日（date 自身は含まない） */
export function nextWorkday(date: IsoDate): IsoDate {
  let d = addDays(date, 1);
  while (!isWorkday(d)) d = addDays(d, 1);
  return d;
}

/** date より前の、最後の稼働日（date 自身は含まない） */
export function previousWorkday(date: IsoDate): IsoDate {
  let d = addDays(date, -1);
  while (!isWorkday(d)) d = addDays(d, -1);
  return d;
}

/** date が稼働日ならそのまま、休みなら次の稼働日 */
export function workdayOnOrAfter(date: IsoDate): IsoDate {
  return isWorkday(date) ? date : nextWorkday(date);
}

/** date が稼働日ならそのまま、休みなら直前の稼働日 */
export function workdayOnOrBefore(date: IsoDate): IsoDate {
  return isWorkday(date) ? date : previousWorkday(date);
}

/**
 * 稼働日で n 日ずらす。n が負なら前へ。n = 0 なら date をそのまま返す。
 * 例：金曜 + 1 = 翌月曜。土曜 + 1 = 月曜。
 */
export function addWorkdays(date: IsoDate, n: number): IsoDate {
  if (!Number.isInteger(n)) throw new RangeError(`稼働日数は整数で指定してください: ${n}`);
  let d = date;
  for (let i = 0; i < Math.abs(n); i++) {
    d = n > 0 ? nextWorkday(d) : previousWorkday(d);
  }
  return d;
}

/** start〜end（両端含む）の稼働日数。start > end なら 0 */
export function workdaysBetween(start: IsoDate, end: IsoDate): number {
  if (toTime(start) > toTime(end)) return 0;
  let count = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWorkday(d)) count++;
  }
  return count;
}

/**
 * date を含む週（月〜日）の「週の最終日」。
 * weekEndWeekday は ISO 曜日（既定は金曜 = 5）。その日が祝日なら直前の稼働日（R5）。
 */
export function weekEndDate(date: IsoDate, weekEndWeekday = 5): IsoDate {
  if (!Number.isInteger(weekEndWeekday) || weekEndWeekday < 1 || weekEndWeekday > 5) {
    throw new RangeError(`週の最終曜日は 1〜5（月〜金）で指定してください: ${weekEndWeekday}`);
  }
  const target = addDays(date, weekEndWeekday - isoWeekday(date));
  return workdayOnOrBefore(target);
}

/** 東京の「今日」 */
export function todayInTokyo(now: Date = new Date()): IsoDate {
  // en-CA は YYYY-MM-DD 形式で出る
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
