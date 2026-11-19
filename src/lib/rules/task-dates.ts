// R0：タスクの予定日・実績日に休日（土日祝）は選べない
import { type IsoDate, isIsoDate, nonWorkdayReason } from "@/lib/calendar";
import type { RuleIssue } from "./types";

export type TaskDatesInput = {
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  actualStart?: IsoDate | null;
  actualEnd?: IsoDate | null;
};

const LABELS = {
  plannedStart: "予定開始日",
  plannedEnd: "予定終了日",
  actualStart: "実績開始日",
  actualEnd: "実績終了日",
} as const;

function checkDay(field: keyof typeof LABELS, value: string): RuleIssue | null {
  if (!isIsoDate(value)) {
    return { field, message: `${LABELS[field]}の日付が正しくありません。` };
  }
  const reason = nonWorkdayReason(value);
  if (reason) {
    return { field, message: `${LABELS[field]}（${value}）は${reason}です。稼働日（平日）を選んでください。` };
  }
  return null;
}

/** 予定日・実績日の形式、休日でないこと、開始 ≦ 終了 を確かめる */
export function validateTaskDates(input: TaskDatesInput): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const fields = ["plannedStart", "plannedEnd", "actualStart", "actualEnd"] as const;
  for (const field of fields) {
    const value = input[field];
    if (value == null || value === "") {
      if (field === "plannedStart" || field === "plannedEnd") {
        issues.push({ field, message: `${LABELS[field]}を入力してください。` });
      }
      continue;
    }
    const issue = checkDay(field, value);
    if (issue) issues.push(issue);
  }
  if (issues.length > 0) return issues;

  if (input.plannedStart > input.plannedEnd) {
    issues.push({ field: "plannedEnd", message: "予定終了日は予定開始日以降にしてください。" });
  }
  if (input.actualStart && input.actualEnd && input.actualStart > input.actualEnd) {
    issues.push({ field: "actualEnd", message: "実績終了日は実績開始日以降にしてください。" });
  }
  return issues;
}
