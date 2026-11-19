// ガントチャートとイナズマ線の描画用の計算（純粋関数）。点の位置そのものは lib/progress の結果を使う。
import {
  addDays,
  diffDays,
  holidayName,
  type IsoDate,
  isoWeekday,
  isWorkday,
} from "@/lib/calendar";
import { formatDateWithWeekday } from "@/lib/format";
import {
  delayWorkdays,
  type GridPosition,
  type LightningPoint,
  lightningPoints,
  type PlannedTask,
  statusLinePosition,
} from "@/lib/progress";
import { nextStatusDay } from "@/lib/projects/form";
import { statusDaysBetween } from "@/lib/rules";

/** 1日の列の幅（px）と行の高さ（px）。SCREENS.md §5-2 */
export const COLUMN_WIDTH = 40;
export const ROW_HEIGHT = 48;

export type GanttDay = { date: IsoDate; offday: boolean; holiday: string | null };

/**
 * 表示する日付の範囲：最初のタスク・進捗管理日のうち早い方の週の月曜から、
 * 締切日・最後のタスク・進捗管理日のうち遅い方の週の日曜まで。
 */
export function ganttRange(input: {
  tasks: readonly PlannedTask[];
  deadline: IsoDate;
  statusDate: IsoDate;
}): { start: IsoDate; end: IsoDate } {
  let first = input.statusDate;
  let last = input.deadline > input.statusDate ? input.deadline : input.statusDate;
  for (const t of input.tasks) {
    if (t.plannedStart < first) first = t.plannedStart;
    if (t.plannedEnd > last) last = t.plannedEnd;
  }
  return {
    start: addDays(first, 1 - isoWeekday(first)),
    end: addDays(last, 7 - isoWeekday(last)),
  };
}

export function ganttDays(start: IsoDate, end: IsoDate): GanttDay[] {
  const days: GanttDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({ date: d, offday: !isWorkday(d), holiday: holidayName(d) });
  }
  return days;
}

/** 範囲の初日から数えた列番号（0 始まり） */
export function columnOf(rangeStart: IsoDate, date: IsoDate): number {
  return diffDays(rangeStart, date);
}

/** マス上の位置 → x 座標（px） */
export function xOf(rangeStart: IsoDate, position: GridPosition, columnWidth = COLUMN_WIDTH): number {
  return (columnOf(rangeStart, position.date) + position.fraction) * columnWidth;
}

/** 期間（両端含む）のバーの左端と幅（px） */
export function barOf(rangeStart: IsoDate, start: IsoDate, end: IsoDate, columnWidth = COLUMN_WIDTH) {
  return { left: columnOf(rangeStart, start) * columnWidth, width: (diffDays(start, end) + 1) * columnWidth };
}

/**
 * 進捗管理日の選択肢：次の進捗共有日（今日より後なら）・今日・範囲の中で今日以前の進捗共有日。新しい順。
 * 次の進捗共有日を入れるのは、週の最終日の前日に、その日の見込みを確かめられるようにするため。
 */
export function statusDateOptions(input: {
  rangeStart: IsoDate;
  today: IsoDate;
  weekEndWeekday: number;
}): { date: IsoDate; label: string; isWeekEnd: boolean }[] {
  const next = nextStatusDay(input.today, input.weekEndWeekday);
  const weekEnds = [...statusDaysBetween(input.rangeStart, input.today, input.weekEndWeekday), next];
  const dates = [...new Set([input.today, ...weekEnds])].sort().reverse();
  return dates.map((date) => ({
    date,
    isWeekEnd: weekEnds.includes(date),
    label: `${formatDateWithWeekday(date)}${date === input.today ? "（今日）" : ""}${weekEnds.includes(date) ? " 週の最終日" : ""}`,
  }));
}

/** 選べる進捗管理日の上限（次の進捗共有日） */
export function latestSelectableStatusDate(today: IsoDate, weekEndWeekday: number): IsoDate {
  return nextStatusDay(today, weekEndWeekday);
}

// ---------------------------------------------------------------------------
// 行（目的・フェーズ・タスク）とイナズマ線
// ---------------------------------------------------------------------------

export type GanttNode = { id: string; parentId: string | null; level: "goal" | "phase"; name: string };

export type GanttRow<T> =
  | { kind: "goal"; id: string; name: string }
  | { kind: "phase"; id: string; name: string }
  | { kind: "task"; id: string; task: T };

/** WBS の並び（目的 → その下のフェーズ → その下のタスク）で、表示する行を平らに並べる */
export function ganttRows<T extends { id: string; phaseId: string }>(
  nodes: readonly GanttNode[],
  tasks: readonly T[],
): GanttRow<T>[] {
  const rows: GanttRow<T>[] = [];
  for (const goal of nodes.filter((n) => n.level === "goal")) {
    rows.push({ kind: "goal", id: goal.id, name: goal.name });
    for (const phase of nodes.filter((n) => n.level === "phase" && n.parentId === goal.id)) {
      rows.push({ kind: "phase", id: phase.id, name: phase.name });
      for (const task of tasks.filter((t) => t.phaseId === phase.id)) {
        rows.push({ kind: "task", id: task.id, task });
      }
    }
  }
  return rows;
}

export type LightningVertex = { x: number; y: number; status: "behind" | "on_track" | "ahead" | "line" };

/**
 * イナズマ線の頂点（上の行から順）。タスクの行は lib/progress の点、目的・フェーズの行は進捗管理日の縦線の上。
 * y は行の中央。
 */
export function lightningVertices<T extends PlannedTask & { id: string; progressPct: number; phaseId: string }>(
  rows: readonly GanttRow<T>[],
  statusDate: IsoDate,
  rangeStart: IsoDate,
): LightningVertex[] {
  const tasks = rows.flatMap((r) => (r.kind === "task" ? [r.task] : []));
  const points = new Map(lightningPoints(tasks, statusDate).map((p) => [p.task.id, p]));
  const lineX = xOf(rangeStart, statusLinePosition(statusDate));
  return rows.map((row, i) => {
    const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
    if (row.kind !== "task") return { x: lineX, y, status: "line" };
    const p = points.get(row.id) as LightningPoint<T>;
    return { x: p.onStatusLine ? lineX : xOf(rangeStart, p.position), y, status: p.onStatusLine ? "line" : p.status };
  });
}

/** イナズマ線の読み上げ用の文（SVG の aria-label）。遅れ・先行しているタスクを文章にする */
export function describeLightning<T extends PlannedTask & { name: string; progressPct: number }>(
  tasks: readonly T[],
  statusDate: IsoDate,
): string {
  const points = lightningPoints(tasks, statusDate);
  const behind = points.filter((p) => !p.onStatusLine && p.status === "behind");
  const ahead = points.filter((p) => !p.onStatusLine && p.status === "ahead");
  const head = `${formatDateWithWeekday(statusDate)}時点のイナズマ線。`;
  if (behind.length === 0 && ahead.length === 0) return `${head}すべてのタスクが予定どおりです。`;
  const parts: string[] = [];
  if (behind.length > 0) {
    parts.push(`遅れ：${behind.map((p) => `${p.task.name}（約${delayWorkdays(p.task, statusDate)}日）`).join("、")}`);
  }
  if (ahead.length > 0) parts.push(`先行：${ahead.map((p) => p.task.name).join("、")}`);
  return `${head}${parts.join("。")}。`;
}
