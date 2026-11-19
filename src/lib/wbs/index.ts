// WBS 編集画面の純粋関数（並べ替え・ルールチェック欄）。
import { type IsoDate, nonWorkdaysBetween } from "@/lib/calendar";
import { formatDateWithWeekday, formatMonthDay, formatWorkdays, weekdayLabel } from "@/lib/format";
import { nextStatusDay } from "@/lib/projects/form";
import { checkBuffer, findOverlaps, lastPlannedEndOf } from "@/lib/rules";

export type MoveDirection = "up" | "down";

/**
 * 並び順の中で id を1つ上か下へ動かした、新しい並び（id の配列）。
 * 先頭を上へ・末尾を下へ・見つからない、のときは null（動かさない）。
 */
export function moveInOrder(ids: readonly string[], id: string, direction: MoveDirection): string[] | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** 期間の稼働日の補足。「○/○・○/○ は土日祝のため数えない」 */
export function offdayNote(start: IsoDate, end: IsoDate): string | null {
  if (start > end) return null;
  const offdays = nonWorkdaysBetween(start, end);
  if (offdays.length === 0) return null;
  const shown = offdays.length <= 4 ? offdays.map((d) => formatMonthDay(d)).join("・") : `${offdays.length}日`;
  return `${shown} は土日祝のため数えない`;
}

export type RuleCheckItem = {
  key: "deliverable" | "assignee" | "parallel" | "buffer" | "meeting";
  title: string;
  ok: boolean;
  description: string;
};

type SummaryTask = {
  id: string;
  assigneeId: string;
  deliverable: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
};

/**
 * ルールチェック欄（上から 成果物・担当者は1人・並列なし・バッファ・進捗共有）。
 * 画面に R1〜R5 の番号は出さない（SCREENS.md §7）。
 */
export function summarizeRules(input: {
  tasks: readonly SummaryTask[];
  deadline: IsoDate;
  bufferDays: number;
  weekEndWeekday: number;
  today: IsoDate;
}): RuleCheckItem[] {
  const { tasks, deadline, bufferDays, weekEndWeekday, today } = input;
  const n = tasks.length;

  const missing = tasks.filter((t) => t.deliverable.trim() === "").length;
  const deliverable: RuleCheckItem = {
    key: "deliverable",
    title: "成果物",
    ok: missing === 0,
    description:
      n === 0
        ? "タスクは成果物の単位で作ります。成果物がないタスクは保存できません。"
        : missing === 0
          ? `登録済み${n}件はすべて成果物を入力済み。`
          : `${missing}件のタスクに成果物がありません。`,
  };

  const unassigned = tasks.filter((t) => t.assigneeId.trim() === "").length;
  const assignee: RuleCheckItem = {
    key: "assignee",
    title: "担当者は1人",
    ok: unassigned === 0,
    description:
      n === 0
        ? "1タスクの担当者は1人。複数人でやるときは「メンバー分複製」で分けます。"
        : unassigned === 0
          ? `${n}件すべて担当者が1人です。`
          : `${unassigned}件のタスクに担当者がいません。`,
  };

  const overlapping = new Set<string>();
  for (const t of tasks) {
    for (const o of findOverlaps(t, tasks)) overlapping.add(o.id);
  }
  const parallel: RuleCheckItem = {
    key: "parallel",
    title: "並列なし",
    ok: overlapping.size === 0,
    description:
      overlapping.size === 0
        ? "同じ人が同時に持つタスクはありません（ほかのプロジェクトも含めて保存時に確認）。"
        : `${overlapping.size}件のタスクで、同じ人の期間が重なっています。`,
  };

  const check = checkBuffer(deadline, bufferDays, lastPlannedEndOf(tasks));
  const deadlineLabel = formatMonthDay(deadline, today);
  const buffer: RuleCheckItem =
    check.status === "warning"
      ? {
          key: "buffer",
          title: "バッファ",
          ok: false,
          description: `最終タスクが ${formatMonthDay(lastPlannedEndOf(tasks)!, today)} 終了で、予備期間に${formatWorkdays(check.overrunWorkdays)}食い込んでいます。${formatDateWithWeekday(check.period.latestPlannedEnd, today)} までに終える計画にしてください。`,
        }
      : {
          key: "buffer",
          title: "バッファ",
          ok: true,
          description:
            check.status === "no_tasks"
              ? `締切 ${deadlineLabel}。最終タスクは ${formatDateWithWeekday(check.period.latestPlannedEnd, today)} までに終えます（予備 ${formatWorkdays(bufferDays)}）。`
              : `最終タスクは ${formatMonthDay(lastPlannedEndOf(tasks)!, today)} 終了。締切 ${deadlineLabel} まで予備 ${formatWorkdays(check.remainingBufferWorkdays)}を確保。`,
        };

  const meeting: RuleCheckItem = {
    key: "meeting",
    title: "進捗共有",
    ok: true,
    description: `毎週${weekdayLabel(weekEndWeekday)}曜日に進捗を共有。次は ${formatDateWithWeekday(nextStatusDay(today, weekEndWeekday), today)}。`,
  };

  return [deliverable, assignee, parallel, buffer, meeting];
}
