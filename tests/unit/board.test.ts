import { describe, expect, it } from "vitest";
import {
  type BoardMember,
  type BoardTask,
  boardSummary,
  buildMemberCard,
  filterMembers,
  freePeriod,
  memberTaskList,
  sortMemberCards,
  validateProgressUpdate,
} from "@/lib/board";

const TODAY = "2026-11-19"; // 木曜

const member = (userId: string, name: string, projectIds = ["p1"]): BoardMember => ({
  userId,
  name,
  title: null,
  projectIds,
});

let seq = 0;
const task = (start: string, end: string, progressPct: number, extra: Partial<BoardTask> = {}): BoardTask => ({
  id: `t${++seq}`,
  projectId: "p1",
  projectName: "minebook",
  projectColor: "#7C5CFA",
  projectIcon: "book-open",
  name: "タスク",
  deliverable: "成果物",
  plannedStart: start,
  plannedEnd: end,
  progressPct,
  visible: true,
  openHelpCount: 0,
  ...extra,
});

describe("カードの状態", () => {
  it("いまのタスクが予定どおりなら順調（11/16〜11/20 の4日目に 80%）", () => {
    const card = buildMemberCard(member("u1", "A"), [task("2026-11-16", "2026-11-20", 80)], TODAY);
    expect(card.status).toBe("ok");
    expect(card.delay).toBe(0);
    expect(card.remaining).toBe(2); // 11/19・11/20
  });

  it("あるべき率を下回れば遅れ、遅れ日数も出す（80% のはずが 60%）", () => {
    const card = buildMemberCard(member("u1", "A"), [task("2026-11-16", "2026-11-20", 60)], TODAY);
    expect(card.status).toBe("late");
    expect(card.delay).toBe(1);
  });

  it("終了予定日を過ぎて未完了のタスクがあれば、いまのタスクがなくても遅れ", () => {
    const card = buildMemberCard(member("u1", "A"), [task("2026-11-10", "2026-11-13", 90)], TODAY);
    expect(card.current).toBeNull();
    expect(card.overdue).toHaveLength(1);
    expect(card.status).toBe("late");
  });

  it("完了済みの過去タスクは遅れに数えない", () => {
    const card = buildMemberCard(member("u1", "A"), [task("2026-11-10", "2026-11-13", 100)], TODAY);
    expect(card.status).toBe("free");
  });

  it("未解決の困りごとがあれば、遅れより先に困りごとあり", () => {
    const card = buildMemberCard(
      member("u1", "A"),
      [task("2026-11-16", "2026-11-20", 60, { openHelpCount: 2 })],
      TODAY,
    );
    expect(card.status).toBe("help");
    expect(card.openHelpCount).toBe(2);
  });

  it("今日の担当タスクがなければ空き。次のタスクの前の稼働日までが空き期間", () => {
    const next = task("2026-11-24", "2026-11-27", 0); // 11/23 は祝日
    const card = buildMemberCard(member("u1", "A"), [next], TODAY);
    expect(card.status).toBe("free");
    expect(card.next?.id).toBe(next.id);
    expect(card.free).toEqual({ from: "2026-11-19", until: "2026-11-20" });
  });

  it("別プロジェクト（見る人がメンバーでない）のタスク中は状態を伏せ、困りごとも数えない", () => {
    const hidden = task("2026-11-16", "2026-11-20", 0, { visible: false, openHelpCount: 1 });
    const card = buildMemberCard(member("u1", "A"), [hidden], TODAY);
    expect(card.status).toBe("other");
    expect(card.delay).toBe(0);
    expect(card.openHelpCount).toBe(0);
  });

  it("期間中に土日を挟んでも稼働日で判定する（11/13 金〜11/17 火、11/16 月に 66% は順調）", () => {
    // 稼働日：11/13・11/16・11/17 の3日。11/16 までに 2日 → あるべき 66.66…%
    const card = buildMemberCard(member("u1", "A"), [task("2026-11-13", "2026-11-17", 66)], "2026-11-16");
    expect(card.status).toBe("ok");
    expect(card.remaining).toBe(2);
  });
});

describe("空き期間", () => {
  it("次の予定がなければ終わりなし", () => {
    expect(freePeriod(null, TODAY)).toEqual({ from: TODAY, until: null });
  });
  it("土曜に見ると月曜から", () => {
    expect(freePeriod(null, "2026-11-21")).toEqual({ from: "2026-11-24", until: null }); // 11/23 は祝日
  });
  it("次のタスクがすぐ始まるなら空き期間なし（土曜に見て、火曜開始）", () => {
    expect(freePeriod(task("2026-11-24", "2026-11-25", 0), "2026-11-21")).toBeNull();
  });
});

describe("並べ替え・集計・フィルタ", () => {
  const cards = [
    buildMemberCard(member("u1", "た"), [], TODAY), // 空き
    buildMemberCard(member("u2", "さ"), [task("2026-11-16", "2026-11-20", 80)], TODAY), // 順調
    buildMemberCard(member("u3", "か"), [task("2026-11-16", "2026-11-20", 60)], TODAY), // 遅れ
    buildMemberCard(member("u4", "あ"), [task("2026-11-16", "2026-11-20", 80)], TODAY), // 順調
    buildMemberCard(member("u5", "な"), [task("2026-11-16", "2026-11-20", 60, { openHelpCount: 1 })], TODAY), // 困りごと（遅れも）
  ];

  it("困りごとあり → 遅れ → 順調 → 空き、同じ状態は名前順", () => {
    expect(sortMemberCards(cards).map((c) => c.member.name)).toEqual(["な", "か", "あ", "さ", "た"]);
  });

  it("集計：困りごとありの人が遅れていれば遅れにも数える", () => {
    expect(boardSummary(cards)).toEqual({ help: 1, late: 2, free: 1 });
  });

  it("プロジェクトで絞る", () => {
    const members = [member("u1", "A", ["p1"]), member("u2", "B", ["p2"]), member("u3", "C", ["p1", "p2"])];
    expect(filterMembers(members, null)).toHaveLength(3);
    expect(filterMembers(members, "p2").map((m) => m.userId)).toEqual(["u2", "u3"]);
  });

  it("担当タスク一覧は開始日の早い順", () => {
    const a = task("2026-11-24", "2026-11-25", 0);
    const b = task("2026-11-16", "2026-11-20", 0);
    expect(memberTaskList([a, b]).map((t) => t.id)).toEqual([b.id, a.id]);
  });
});

describe("進捗の更新の入力チェック", () => {
  const planned = { plannedStart: "2026-11-16", plannedEnd: "2026-11-20" };
  const input = { progressPct: 50, actualStart: null, actualEnd: null, deliverableUrl: null, completionNote: null };

  it("ふつうの更新は通る", () => {
    expect(validateProgressUpdate({ ...input, actualStart: "2026-11-16" }, planned, TODAY)).toEqual({});
  });
  it("完了（100%）には成果物の URL かメモが要る", () => {
    expect(validateProgressUpdate({ ...input, progressPct: 100 }, planned, TODAY).deliverableUrl).toMatch("完了");
    expect(validateProgressUpdate({ ...input, progressPct: 100, completionNote: "PR #12" }, planned, TODAY)).toEqual({});
  });
  it("実績日に休日（11/23 勤労感謝の日）・未来の日は入れられない", () => {
    expect(validateProgressUpdate({ ...input, actualStart: "2026-11-23" }, planned, "2026-11-24").actualStart).toMatch("勤労感謝の日");
    expect(validateProgressUpdate({ ...input, actualStart: "2026-11-20" }, planned, TODAY).actualStart).toMatch("今日より後");
  });
  it("実績終了日だけは入れられない・開始より前の終了は入れられない", () => {
    expect(validateProgressUpdate({ ...input, actualEnd: "2026-11-18" }, planned, TODAY).actualStart).toMatch("実績開始日も");
    expect(
      validateProgressUpdate({ ...input, actualStart: "2026-11-18", actualEnd: "2026-11-17" }, planned, TODAY).actualEnd,
    ).toMatch("以降");
  });
  it("進捗率は 0〜100 の整数", () => {
    expect(validateProgressUpdate({ ...input, progressPct: 101 }, planned, TODAY).progressPct).toBeDefined();
    expect(validateProgressUpdate({ ...input, progressPct: 12.5 }, planned, TODAY).progressPct).toBeDefined();
  });
});
