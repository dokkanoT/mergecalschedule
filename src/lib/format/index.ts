// 画面に出す日付・日数の書き方（SCREENS.md §7）。純粋関数。
// 日付は 11/19（木）、期間は 11/17〜11/20、日数は「n稼働日」。年は年をまたぐときだけ付ける。
import { type IsoDate, isoWeekday, isHoliday } from "@/lib/calendar";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** ISO 曜日（月=1 … 日=7）→「月」〜「日」 */
export function weekdayLabel(isoDay: number): string {
  const label = WEEKDAY_LABELS[isoDay - 1];
  if (!label) throw new RangeError(`曜日は 1〜7 で指定してください: ${isoDay}`);
  return label;
}

/** 曜日の選択肢（週の最終曜日用。月〜金） */
export const WORKDAY_OPTIONS = [1, 2, 3, 4, 5].map((value) => ({ value, label: `${weekdayLabel(value)}曜日` }));

function parts(date: IsoDate) {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) };
}

/**
 * "2026-11-19" → "11/19"。reference と年が違えば "2027/1/8"。
 * reference を省くと年を付けない。
 */
export function formatMonthDay(date: IsoDate, reference?: IsoDate): string {
  const { y, m, d } = parts(date);
  const withYear = reference !== undefined && parts(reference).y !== y;
  return withYear ? `${y}/${m}/${d}` : `${m}/${d}`;
}

/** "2026-11-19" → "11/19（木）" */
export function formatDateWithWeekday(date: IsoDate, reference?: IsoDate): string {
  return `${formatMonthDay(date, reference)}（${weekdayLabel(isoWeekday(date))}）`;
}

/** "2026-11-19" → "11月19日（木）"（ヘッダーの小見出し用） */
export function formatLongDate(date: IsoDate): string {
  const { m, d } = parts(date);
  return `${m}月${d}日（${weekdayLabel(isoWeekday(date))}）`;
}

/** 期間 "11/17〜11/20"。年をまたぐときは終わりに年を付ける（"12/28〜2027/1/8"） */
export function formatPeriod(start: IsoDate, end: IsoDate): string {
  return `${formatMonthDay(start)}〜${formatMonthDay(end, start)}`;
}

/** 3 → "3稼働日" */
export function formatWorkdays(n: number): string {
  return `${n}稼働日`;
}

/** 見出し用の曜日（祝日は「祝」） */
export function dayHeaderLabel(date: IsoDate): string {
  return isHoliday(date) ? "祝" : weekdayLabel(isoWeekday(date));
}
