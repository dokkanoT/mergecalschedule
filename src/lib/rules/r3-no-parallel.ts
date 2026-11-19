// R3：1人が2つ以上のタスクを並列処理しない（プロジェクト横断）
// 予定期間 [plannedStart, plannedEnd] は両端を含む。重なりは暦日で判定する（休日をまたいでも重なれば重複）。
import { addWorkdays, type IsoDate, nextWorkday, workdayOnOrAfter } from "@/lib/calendar";

export type ScheduledTask = {
  id: string;
  assigneeId: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
};

export type TaskCandidate = {
  /** 既存タスクの更新なら、そのタスク自身の id（自分とは衝突させない） */
  id?: string | null;
  assigneeId: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
};

/** 2つの期間（両端含む）が1日でも重なるか */
export function periodsOverlap(
  a: { plannedStart: IsoDate; plannedEnd: IsoDate },
  b: { plannedStart: IsoDate; plannedEnd: IsoDate },
): boolean {
  // "YYYY-MM-DD" は文字列の大小比較がそのまま日付の前後になる
  return a.plannedStart <= b.plannedEnd && b.plannedStart <= a.plannedEnd;
}

/** candidate と重なる、同じ担当者の既存タスク（開始日順）。サーバーの findOverlaps と UI の両方から使う */
export function findOverlaps<T extends ScheduledTask>(candidate: TaskCandidate, existing: readonly T[]): T[] {
  return existing
    .filter(
      (t) =>
        t.assigneeId === candidate.assigneeId &&
        t.id !== candidate.id &&
        periodsOverlap(t, candidate),
    )
    .sort((a, b) => (a.plannedStart < b.plannedStart ? -1 : a.plannedStart > b.plannedStart ? 1 : 0));
}

/**
 * 「次の空き日」：from 以降で、durationWorkdays 稼働日のタスクを、その担当者の既存タスクと重ねずに置ける最初の開始日。
 * existing は同じ担当者のタスクを渡す（他の担当者のタスクが混ざっていても無視する）。
 */
export function suggestNextFreeStart(
  assigneeId: string,
  existing: readonly ScheduledTask[],
  from: IsoDate,
  durationWorkdays: number,
  excludeTaskId?: string | null,
): IsoDate {
  if (!Number.isInteger(durationWorkdays) || durationWorkdays < 1) {
    throw new RangeError(`期間は 1 稼働日以上の整数で指定してください: ${durationWorkdays}`);
  }
  let start = workdayOnOrAfter(from);
  // 既存タスクは有限なので、衝突のたびに後ろへずらせば必ず終わる
  for (;;) {
    const end = addWorkdays(start, durationWorkdays - 1);
    const conflicts = findOverlaps(
      { id: excludeTaskId, assigneeId, plannedStart: start, plannedEnd: end },
      existing,
    );
    if (conflicts.length === 0) return start;
    const latestEnd = conflicts.reduce((max, t) => (t.plannedEnd > max ? t.plannedEnd : max), conflicts[0].plannedEnd);
    start = nextWorkday(latestEnd);
  }
}

export type ConflictView = {
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  /** 見る人がそのプロジェクトのメンバーでなければ null（名前を見せない） */
  projectName: string | null;
  taskName: string | null;
};

/** 衝突の説明文。メンバーでないプロジェクトのタスクは「別プロジェクトの予定」とだけ出す（§6 権限） */
export function describeConflict(c: ConflictView): string {
  const period = `${c.plannedStart}〜${c.plannedEnd}`;
  if (c.projectName === null || c.taskName === null) {
    return `別プロジェクトの予定（${period}）と期間が重なっています。`;
  }
  return `「${c.projectName}」の「${c.taskName}」（${period}）と期間が重なっています。`;
}

/** DB の排他制約違反（23P01 / no_parallel_tasks）を日本語のメッセージに変えるときの文言 */
export const PARALLEL_TASK_MESSAGE =
  "この担当者は同じ期間に別のタスクを持っています。1人が同時に持てるタスクは1つだけです。";

/** DB エラーが R3 の排他制約違反か */
export function isParallelTaskViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (e.code === "23P01" && (e.constraint === undefined || e.constraint === "no_parallel_tasks")) {
    return true;
  }
  // Drizzle は元のエラーを cause に包むことがある
  return e.cause !== undefined && e.cause !== error && isParallelTaskViolation(e.cause);
}
