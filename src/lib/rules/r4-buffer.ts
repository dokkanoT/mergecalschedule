// R4：締切日に完成する計画は NG（バッファ）。バッファ日数は稼働日で数える（R0）。
// 締切日とバッファ日数は利用者がプロジェクトごとに入力する。コードに固定値を書かない。
import {
  addDays,
  addWorkdays,
  type IsoDate,
  previousWorkday,
  workdayOnOrBefore,
  workdaysBetween,
} from "@/lib/calendar";

export type BufferPeriod = {
  /** 予備期間の初日（稼働日） */
  start: IsoDate;
  /** 予備期間の最終日（= 締切日） */
  end: IsoDate;
  /** 最終タスクがこの日までに終われば OK（予備期間の前日の稼働日） */
  latestPlannedEnd: IsoDate;
};

/**
 * 予備期間：締切日以前の最後の bufferDays 稼働日。
 * 例：締切 2027-01-08(金)、バッファ 5 → 予備期間 01-04(月)〜01-08、最終タスクは 2026-12-31(木) までに終える（01-01 は元日）。
 */
export function bufferPeriod(deadline: IsoDate, bufferDays: number): BufferPeriod {
  if (!Number.isInteger(bufferDays) || bufferDays < 1) {
    throw new RangeError(`バッファ日数は 1 以上の整数で指定してください: ${bufferDays}`);
  }
  const lastWorkday = workdayOnOrBefore(deadline);
  const start = addWorkdays(lastWorkday, -(bufferDays - 1));
  return { start, end: deadline, latestPlannedEnd: previousWorkday(start) };
}

export type BufferCheck =
  | { status: "no_tasks"; period: BufferPeriod; remainingBufferWorkdays: number }
  | { status: "ok"; period: BufferPeriod; remainingBufferWorkdays: number }
  | {
      status: "warning";
      period: BufferPeriod;
      remainingBufferWorkdays: number;
      /** バッファに食い込んだ稼働日数 */
      overrunWorkdays: number;
      message: string;
    };

/**
 * 最終タスクの予定終了日がバッファに食い込んでいないかを判定する（警告。保存は止めない）。
 * remainingBufferWorkdays は「最終タスクの翌日〜締切日」の稼働日数（バッファ残）。
 */
export function checkBuffer(
  deadline: IsoDate,
  bufferDays: number,
  lastPlannedEnd: IsoDate | null,
): BufferCheck {
  const period = bufferPeriod(deadline, bufferDays);
  if (lastPlannedEnd === null) {
    return { status: "no_tasks", period, remainingBufferWorkdays: workdaysBetween(period.start, deadline) };
  }
  const remainingBufferWorkdays = workdaysBetween(addDays(lastPlannedEnd, 1), deadline);
  if (lastPlannedEnd <= period.latestPlannedEnd) {
    return { status: "ok", period, remainingBufferWorkdays };
  }
  const overrunWorkdays = workdaysBetween(addDays(period.latestPlannedEnd, 1), lastPlannedEnd);
  return {
    status: "warning",
    period,
    remainingBufferWorkdays,
    overrunWorkdays,
    message:
      lastPlannedEnd > deadline
        ? `最終タスクの終了予定（${lastPlannedEnd}）が締切日（${deadline}）を過ぎています。`
        : `最終タスクの終了予定（${lastPlannedEnd}）がバッファに${overrunWorkdays}稼働日食い込んでいます。${period.latestPlannedEnd} までに終える計画にしてください。`,
  };
}

/** 全タスクの予定終了日のうち最も遅い日（タスクがなければ null） */
export function lastPlannedEndOf(tasks: readonly { plannedEnd: IsoDate }[]): IsoDate | null {
  return tasks.reduce<IsoDate | null>((max, t) => (max === null || t.plannedEnd > max ? t.plannedEnd : max), null);
}
