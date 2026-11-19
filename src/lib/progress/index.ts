// 遅れ判定とイナズマ線（CLAUDE.md §4）。日数はすべて稼働日（R0）。
// メンバーカードの「遅れ」バッジ、ガント、PDF はすべてここの関数の結果を使う。
import {
  addWorkdays,
  type IsoDate,
  workdayOnOrAfter,
  workdaysBetween,
} from "@/lib/calendar";

export type PlannedTask = {
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
};

export type ProgressStatus = "behind" | "on_track" | "ahead";

/** 浮動小数の誤差で「予定どおり」が「遅れ」にならないための許容幅（%） */
const EPSILON = 1e-9;

/** 予定日数 D（稼働日、両端含む） */
export function plannedWorkdays(task: PlannedTask): number {
  return workdaysBetween(task.plannedStart, task.plannedEnd);
}

/**
 * 進捗管理日 S における「あるべき進捗率」（0〜100）。
 * expected = clamp(workdaysBetween(plannedStart, S) / D, 0, 1) × 100。S が開始前なら 0。
 */
export function expectedProgressPct(task: PlannedTask, statusDate: IsoDate): number {
  if (statusDate < task.plannedStart) return 0;
  const d = plannedWorkdays(task);
  if (d === 0) return 100; // 予定期間に稼働日がない（DB 制約上は起きない）
  const elapsed = workdaysBetween(task.plannedStart, statusDate);
  return Math.min(Math.max(elapsed / d, 0), 1) * 100;
}

/** 実際の進捗率とあるべき進捗率を比べる。下回れば遅れ、上回れば先行 */
export function compareProgress(progressPct: number, expectedPct: number): ProgressStatus {
  if (progressPct < expectedPct - EPSILON) return "behind";
  if (progressPct > expectedPct + EPSILON) return "ahead";
  return "on_track";
}

export function progressStatus(task: PlannedTask & { progressPct: number }, statusDate: IsoDate): ProgressStatus {
  return compareProgress(task.progressPct, expectedProgressPct(task, statusDate));
}

/**
 * 遅れ日数（稼働日、切り上げ）。遅れていなければ 0。
 * あるべき位置と実際の位置（どちらも D × 率）の差。
 */
export function delayWorkdays(task: PlannedTask & { progressPct: number }, statusDate: IsoDate): number {
  const d = plannedWorkdays(task);
  const gap = ((expectedProgressPct(task, statusDate) - task.progressPct) / 100) * d;
  return gap > EPSILON ? Math.ceil(gap - EPSILON) : 0;
}

/** イナズマ線の点：planned_start から D × progress_pct / 100 稼働日進んだ位置（稼働日のオフセット、小数あり） */
export function lightningOffset(task: PlannedTask & { progressPct: number }): number {
  return (plannedWorkdays(task) * task.progressPct) / 100;
}

export type GridPosition = {
  /** その位置が入る日のマス */
  date: IsoDate;
  /** マスの中の位置（0 = その日の始まり、1 = その日の終わり） */
  fraction: number;
};

/**
 * 稼働日オフセットを、ガントの日付マス上の位置に変える。
 * オフセット k（k ≥ 1 の整数）は「k 稼働日目の終わり」。0 は開始日の始まり。
 * こうすると「予定どおり」の点が、進捗管理日の縦線（その日の終わり）とちょうど重なる。
 */
export function offsetToGridPosition(plannedStart: IsoDate, offset: number): GridPosition {
  const first = workdayOnOrAfter(plannedStart);
  if (offset <= 0) return { date: first, fraction: 0 };
  const whole = Math.ceil(offset - EPSILON) - 1; // 何稼働日目のマスか（0 始まり）
  return { date: addWorkdays(first, whole), fraction: offset - whole };
}

export type LightningPoint<T> = {
  task: T;
  position: GridPosition;
  status: ProgressStatus;
};

/**
 * イナズマ線の点の列。tasks はガントの上から順に渡す（この順につなぐ）。
 * 進捗管理日より左の点は遅れ、右は先行。
 */
export function lightningPoints<T extends PlannedTask & { progressPct: number }>(
  tasks: readonly T[],
  statusDate: IsoDate,
): LightningPoint<T>[] {
  return tasks.map((task) => ({
    task,
    position: offsetToGridPosition(task.plannedStart, lightningOffset(task)),
    status: progressStatus(task, statusDate),
  }));
}

/** プロジェクト全体の進捗率（予定日数で重み付けした平均、0〜100）。タスクがなければ 0 */
export function overallProgressPct(tasks: readonly (PlannedTask & { progressPct: number })[]): number {
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    const d = plannedWorkdays(t);
    total += d;
    done += (d * t.progressPct) / 100;
  }
  return total === 0 ? 0 : (done / total) * 100;
}

// ---------------------------------------------------------------------------
// メンバーカード用
// ---------------------------------------------------------------------------

/** today に予定期間が入っているタスク（R3 により、1人につき高々1つ） */
export function currentTask<T extends PlannedTask>(tasks: readonly T[], today: IsoDate): T | null {
  return tasks.find((t) => t.plannedStart <= today && today <= t.plannedEnd) ?? null;
}

/** today より後に始まるタスクのうち最も早いもの */
export function nextTask<T extends PlannedTask>(tasks: readonly T[], today: IsoDate): T | null {
  return tasks
    .filter((t) => t.plannedStart > today)
    .reduce<T | null>((min, t) => (min === null || t.plannedStart < min.plannedStart ? t : min), null);
}

/** 終了予定まで残りの稼働日数（today と終了日を含む）。終了日を過ぎていれば 0 */
export function remainingWorkdays(task: PlannedTask, today: IsoDate): number {
  return workdaysBetween(today, task.plannedEnd);
}
