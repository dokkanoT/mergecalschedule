// メンバーカード（/board）の状態判定と並べ替え。純粋関数。
// 遅れの判定は lib/progress（CLAUDE.md §4）の結果を使う。
import { type IsoDate, previousWorkday, workdayOnOrAfter } from "@/lib/calendar";
import { currentTask, delayWorkdays, nextTask, progressStatus, remainingWorkdays } from "@/lib/progress";
import { validateCompletion, validateTaskDates } from "@/lib/rules";

/** 見る人がメンバーでないプロジェクトのタスクの表示名（§6） */
export const OTHER_PROJECT_LABEL = "別プロジェクトの予定";

export type BoardTask = {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  projectIcon: string;
  name: string;
  deliverable: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  progressPct: number;
  /** 見る人がそのプロジェクトのメンバーか。false なら名前などを伏せて「別プロジェクトの予定」と出す（§6） */
  visible: boolean;
  /** 未解決の困りごとの件数 */
  openHelpCount: number;
};

export type BoardMember = {
  userId: string;
  name: string;
  title: string | null;
  /** 見る人と共通のプロジェクト（フィルタ用） */
  projectIds: string[];
};

/**
 * カードの状態。
 * - help：未解決の困りごとがある
 * - late：いまのタスクが遅れている、または終了予定日を過ぎて未完了のタスクがある
 * - ok：いまのタスクが予定どおりか先行
 * - other：いまのタスクが、見る人がメンバーでないプロジェクトのもの（状態は伏せる）
 * - free：今日の担当タスクなし
 */
export type CardStatus = "help" | "late" | "ok" | "other" | "free";

/** 並び順：困りごとあり → 遅れ → 順調 → 別プロジェクト → 空き */
const STATUS_ORDER: Record<CardStatus, number> = { help: 0, late: 1, ok: 2, other: 3, free: 4 };

export type MemberCard = {
  member: BoardMember;
  status: CardStatus;
  /** 今日に予定期間が入っているタスク（R3 により高々1つ） */
  current: BoardTask | null;
  next: BoardTask | null;
  /** いまのタスクの遅れ（稼働日、小数第1位）。遅れていなければ 0 */
  delay: number;
  /** いまのタスクの終了予定まで残りの稼働日数（今日を含む） */
  remaining: number;
  /** 終了予定日を過ぎて未完了のタスク（見えるものだけ） */
  overdue: BoardTask[];
  /** いまのタスクがないとき、空いている期間。次の予定がなければ until は null */
  free: { from: IsoDate; until: IsoDate | null } | null;
  /** 未解決の困りごとの件数（見えるタスクのものだけ） */
  openHelpCount: number;
};

/** 予定が入っていない期間（今日から次のタスクの前日まで、稼働日で丸める） */
export function freePeriod(next: BoardTask | null, today: IsoDate): { from: IsoDate; until: IsoDate | null } | null {
  const from = workdayOnOrAfter(today);
  if (!next) return { from, until: null };
  const until = previousWorkday(next.plannedStart);
  return until < from ? null : { from, until };
}

/** 1人分のカード。tasks はそのメンバーの全プロジェクトのタスク */
export function buildMemberCard(member: BoardMember, tasks: readonly BoardTask[], today: IsoDate): MemberCard {
  const current = currentTask(tasks, today);
  const next = nextTask(tasks, today);
  const overdue = tasks
    .filter((t) => t.visible && t.plannedEnd < today && t.progressPct < 100)
    .sort((a, b) => a.plannedEnd.localeCompare(b.plannedEnd));
  const openHelpCount = tasks.reduce((sum, t) => sum + (t.visible ? t.openHelpCount : 0), 0);

  const currentVisible = current !== null && current.visible;
  const currentBehind = currentVisible && progressStatus(current, today) === "behind";

  let status: CardStatus;
  if (openHelpCount > 0) status = "help";
  else if (currentBehind || overdue.length > 0) status = "late";
  else if (current === null) status = "free";
  else status = currentVisible ? "ok" : "other";

  return {
    member,
    status,
    current,
    next,
    delay: currentVisible ? delayWorkdays(current, today) : 0,
    remaining: current ? remainingWorkdays(current, today) : 0,
    overdue,
    free: current === null ? freePeriod(next, today) : null,
    openHelpCount,
  };
}

/** 困りごとあり → 遅れ → 順調 → 別プロジェクト → 空き。同じ状態の中では名前順 */
export function sortMemberCards(cards: readonly MemberCard[]): MemberCard[] {
  return [...cards].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.member.name.localeCompare(b.member.name, "ja"),
  );
}

/** ヘッダーの集計ピル（困りごと・遅れ・空きの人数） */
export function boardSummary(cards: readonly MemberCard[]) {
  return {
    help: cards.filter((c) => c.status === "help").length,
    late: cards.filter((c) => c.status === "late" || (c.status === "help" && isLate(c))).length,
    free: cards.filter((c) => c.current === null).length,
  };
}

/** 困りごとありのカードでも、遅れていれば遅れに数える */
function isLate(card: MemberCard): boolean {
  return card.delay > 0 || card.overdue.length > 0;
}

/** フィルタ：projectId が null なら全員、あればそのプロジェクトのメンバーだけ */
export function filterMembers<T extends { projectIds: string[] }>(members: readonly T[], projectId: string | null): T[] {
  return projectId === null ? [...members] : members.filter((m) => m.projectIds.includes(projectId));
}

/** 担当タスク一覧（カードを押したときのリスト）。開始日の早い順 */
export function memberTaskList<T extends { plannedStart: IsoDate; plannedEnd: IsoDate }>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.plannedEnd.localeCompare(b.plannedEnd));
}

// ---------------------------------------------------------------------------
// 自分のカードからの「進捗を更新」（member は自分のタスクの進捗率・実績日・成果物 URL・メモだけ直せる §6）
// ---------------------------------------------------------------------------

export type ProgressUpdateInput = {
  progressPct: number;
  actualStart: IsoDate | null;
  actualEnd: IsoDate | null;
  deliverableUrl: string | null;
  completionNote: string | null;
};

export type ProgressUpdateField = "progressPct" | "actualStart" | "actualEnd" | "deliverableUrl";

/** 入力チェック。予定日は変えないので、実績日（R0：休日不可・開始 ≦ 終了・未来日不可）と完了条件（R1）だけを見る */
export function validateProgressUpdate(
  input: ProgressUpdateInput,
  planned: { plannedStart: IsoDate; plannedEnd: IsoDate },
  today: IsoDate,
): Partial<Record<ProgressUpdateField, string>> {
  const issues = [
    ...validateTaskDates({ ...planned, actualStart: input.actualStart, actualEnd: input.actualEnd }),
    ...validateCompletion(input),
  ];
  const errors: Partial<Record<ProgressUpdateField, string>> = {};
  for (const issue of issues) {
    const field = issue.field as ProgressUpdateField;
    if (field in errors || !["progressPct", "actualStart", "actualEnd", "deliverableUrl"].includes(field)) continue;
    errors[field] = issue.message;
  }
  if (!errors.actualStart && input.actualStart && input.actualStart > today) {
    errors.actualStart = "実績開始日に今日より後の日は入れられません。";
  }
  if (!errors.actualEnd && input.actualEnd && input.actualEnd > today) {
    errors.actualEnd = "実績終了日に今日より後の日は入れられません。";
  }
  if (!errors.actualEnd && input.actualEnd && !input.actualStart) {
    errors.actualStart ??= "実績終了日を入れるときは、実績開始日も入力してください。";
  }
  return errors;
}
