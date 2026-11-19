import { describe, expect, it } from "vitest";
import {
  barOf,
  COLUMN_WIDTH,
  columnOf,
  describeLightning,
  ganttDays,
  ganttRange,
  ganttRows,
  lightningVertices,
  ROW_HEIGHT,
  statusDateOptions,
} from "@/lib/gantt";

const task = (id: string, phaseId: string, start: string, end: string, progressPct: number, name = id) => ({
  id,
  phaseId,
  name,
  plannedStart: start,
  plannedEnd: end,
  progressPct,
});

describe("表示範囲と列", () => {
  it("最初のタスクの週の月曜から、締切の週の日曜まで", () => {
    const r = ganttRange({ tasks: [task("a", "p", "2026-11-25", "2026-11-27", 0)], deadline: "2027-01-08", statusDate: "2026-11-27" });
    expect(r).toEqual({ start: "2026-11-23", end: "2027-01-10" });
  });

  it("土日祝の列を休みにする（11/23 は祝日）", () => {
    const days = ganttDays("2026-11-23", "2026-11-29");
    expect(days.map((d) => d.offday)).toEqual([true, false, false, false, false, true, true]);
    expect(days[0].holiday).toBe("勤労感謝の日");
  });

  it("バーは開始日の列から、両端を含む幅", () => {
    expect(columnOf("2026-11-23", "2026-11-25")).toBe(2);
    expect(barOf("2026-11-23", "2026-11-25", "2026-11-27")).toEqual({ left: 2 * COLUMN_WIDTH, width: 3 * COLUMN_WIDTH });
  });

  it("進捗管理日の選択肢：次の週の最終日・今日・それ以前の週の最終日（新しい順）", () => {
    const opts = statusDateOptions({ rangeStart: "2026-11-09", today: "2026-11-19", weekEndWeekday: 5 });
    expect(opts.map((o) => o.date)).toEqual(["2026-11-20", "2026-11-19", "2026-11-13"]);
    expect(opts[1].label).toContain("今日");
    expect(opts[0].isWeekEnd && opts[2].isWeekEnd).toBe(true);
  });

  it("今日が週の最終日なら、今日が一番新しい", () => {
    const opts = statusDateOptions({ rangeStart: "2026-11-16", today: "2026-11-20", weekEndWeekday: 5 });
    expect(opts.map((o) => o.date)).toEqual(["2026-11-20"]);
    expect(opts[0].label).toBe("11/20（金）（今日） 週の最終日");
  });
});

describe("イナズマ線", () => {
  const nodes = [
    { id: "g", parentId: null, level: "goal" as const, name: "目的" },
    { id: "p", parentId: "g", level: "phase" as const, name: "フェーズ" },
  ];
  // 進捗管理日 11/25(水)。範囲の初日 11/23(月)、縦線は 11/25 の終わり = 3 列目の終わり
  const statusDate = "2026-11-25";
  const start = "2026-11-23";
  const lineX = 3 * COLUMN_WIDTH;

  it("行は 目的 → フェーズ → タスク の順", () => {
    const rows = ganttRows(nodes, [task("a", "p", "2026-11-24", "2026-11-26", 0)]);
    expect(rows.map((r) => r.kind)).toEqual(["goal", "phase", "task"]);
  });

  it("目的・フェーズ・完了・未着手は縦線の上。遅れは左、先行は右", () => {
    const rows = ganttRows(nodes, [
      task("late", "p", "2026-11-24", "2026-11-26", 0), // 11/24〜26 の 3日。あるべき 66%、実際 0% → 開始日の始まり
      task("ahead", "p", "2026-11-24", "2026-11-27", 100 * 3 / 4), // 4日中 3日分 → 11/26 の終わり
      task("done", "p", "2026-11-24", "2026-11-24", 100),
      task("future", "p", "2026-11-30", "2026-12-01", 0),
    ]);
    const v = lightningVertices(rows, statusDate, start);
    expect(v.map((p) => p.y)).toEqual([0, 1, 2, 3, 4, 5].map((i) => i * ROW_HEIGHT + ROW_HEIGHT / 2));
    expect(v[0]).toMatchObject({ x: lineX, status: "line" });
    expect(v[1]).toMatchObject({ x: lineX, status: "line" });
    expect(v[2]).toMatchObject({ x: 1 * COLUMN_WIDTH, status: "behind" });
    expect(v[3]).toMatchObject({ x: 4 * COLUMN_WIDTH, status: "ahead" });
    expect(v[4]).toMatchObject({ x: lineX, status: "line" });
    expect(v[5]).toMatchObject({ x: lineX, status: "line" });
  });

  it("読み上げ文：遅れ日数と先行のタスク名", () => {
    const text = describeLightning(
      [task("a", "p", "2026-11-24", "2026-11-26", 0, "画面設計"), task("b", "p", "2026-11-24", "2026-11-27", 75, "実装")],
      statusDate,
    );
    expect(text).toContain("遅れ：画面設計（約2日）");
    expect(text).toContain("先行：実装");
  });

  it("全部予定どおりならそう書く", () => {
    expect(describeLightning([task("a", "p", "2026-11-24", "2026-11-26", 66)], statusDate)).toContain("すべてのタスクが予定どおり");
  });
});
