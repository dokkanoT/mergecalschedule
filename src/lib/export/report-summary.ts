// 進捗レポート（PDF）に出す数字の計算。純粋関数。遅れの判定は lib/progress（§4）の結果を使う。
import { addDays, type IsoDate, workdaysBetween } from "@/lib/calendar";
import {
  delayWorkdays,
  expectedProgressPct,
  overallProgressPct,
  type PlannedTask,
  progressStatus,
} from "@/lib/progress";
import { type BufferCheck, checkBuffer, lastPlannedEndOf } from "@/lib/rules";

type ReportTask = PlannedTask & { id: string; name: string; assigneeName: string; progressPct: number };

export type LateTask<T> = { task: T; expectedPct: number; delay: number };

export type ReportSummary<T> = {
  /** 全体進捗率（予定日数で重み付け、整数に四捨五入） */
  overallPct: number;
  /** 進捗管理日の時点であるべき全体進捗率（同じ重み付け） */
  expectedOverallPct: number;
  /** 進捗管理日の翌日から締切までの稼働日数（締切を過ぎていれば 0） */
  workdaysToDeadline: number;
  /** 最終タスクの予定終了日の翌日から締切までの稼働日数（= 残っているバッファ）。タスクがなければ null */
  bufferLeft: number | null;
  buffer: BufferCheck;
  /** 遅れているタスク（遅れ日数の多い順） */
  lateTasks: LateTask<T>[];
};

export function reportSummary<T extends ReportTask>(
  project: { deadline: IsoDate; bufferDays: number },
  tasks: readonly T[],
  statusDate: IsoDate,
): ReportSummary<T> {
  const lastEnd = lastPlannedEndOf(tasks);
  const expectedOverall = overallProgressPct(
    tasks.map((t) => ({ ...t, progressPct: expectedProgressPct(t, statusDate) })),
  );
  const lateTasks = tasks
    .filter((t) => t.progressPct < 100 && progressStatus(t, statusDate) === "behind")
    .map((task) => ({ task, expectedPct: Math.floor(expectedProgressPct(task, statusDate)), delay: delayWorkdays(task, statusDate) }))
    .sort((a, b) => b.delay - a.delay || a.task.plannedStart.localeCompare(b.task.plannedStart));

  const buffer = checkBuffer(project.deadline, project.bufferDays, lastEnd);
  return {
    overallPct: Math.round(overallProgressPct(tasks)),
    expectedOverallPct: Math.round(expectedOverall),
    workdaysToDeadline: workdaysBetween(addDays(statusDate, 1), project.deadline),
    bufferLeft: lastEnd === null ? null : buffer.remainingBufferWorkdays,
    buffer,
    lateTasks,
  };
}

/** ガントのページ分け：1ページに入る行数ごとに区切る（イナズマ線もページごとに描く） */
export function chunkRows<T>(rows: readonly T[], perPage: number): T[][] {
  if (perPage < 1) throw new RangeError(`1ページの行数は 1 以上にしてください: ${perPage}`);
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

/** ガントの1列の幅（pt）。使える幅に日数が収まるように、上限 maxWidth で縮める */
export function fitColumnWidth(availableWidth: number, dayCount: number, maxWidth = 14): number {
  if (dayCount <= 0) return maxWidth;
  return Math.min(maxWidth, availableWidth / dayCount);
}
