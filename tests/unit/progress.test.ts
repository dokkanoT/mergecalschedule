import { describe, expect, it } from "vitest";
import {
  compareProgress,
  currentTask,
  delayWorkdays,
  expectedProgressPct,
  lightningOffset,
  lightningPoints,
  nextTask,
  offsetToGridPosition,
  overallProgressPct,
  plannedWorkdays,
  progressStatus,
  remainingWorkdays,
} from "@/lib/progress";

// 11/30(月)〜12/04(金) の 5 稼働日タスク
const week = { plannedStart: "2026-11-30", plannedEnd: "2026-12-04" };
// 11/26(木)〜12/01(火)：間に土日を挟む 4 稼働日タスク
const overWeekend = { plannedStart: "2026-11-26", plannedEnd: "2026-12-01" };
// 1日タスク
const oneDay = { plannedStart: "2026-12-02", plannedEnd: "2026-12-02" };

describe("expectedProgressPct（あるべき進捗率）", () => {
  it("開始前は 0", () => {
    expect(expectedProgressPct(week, "2026-11-27")).toBe(0);
  });

  it("期間中：1日目の終わりで 20%、3日目で 60%", () => {
    expect(expectedProgressPct(week, "2026-11-30")).toBe(20);
    expect(expectedProgressPct(week, "2026-12-02")).toBe(60);
  });

  it("終了日で 100、終了後も 100", () => {
    expect(expectedProgressPct(week, "2026-12-04")).toBe(100);
    expect(expectedProgressPct(week, "2026-12-10")).toBe(100);
  });

  it("1日タスク：前日 0、当日 100", () => {
    expect(expectedProgressPct(oneDay, "2026-12-01")).toBe(0);
    expect(expectedProgressPct(oneDay, "2026-12-02")).toBe(100);
  });

  it("期間中に土日を挟む：土日は進まない（金曜 50%、土日も 50%、月曜 75%）", () => {
    expect(plannedWorkdays(overWeekend)).toBe(4);
    expect(expectedProgressPct(overWeekend, "2026-11-27")).toBe(50);
    expect(expectedProgressPct(overWeekend, "2026-11-28")).toBe(50);
    expect(expectedProgressPct(overWeekend, "2026-11-29")).toBe(50);
    expect(expectedProgressPct(overWeekend, "2026-11-30")).toBe(75);
  });
});

describe("遅れ判定", () => {
  it("開始前：0% なら予定どおり、進めていれば先行", () => {
    expect(progressStatus({ ...week, progressPct: 0 }, "2026-11-27")).toBe("on_track");
    expect(progressStatus({ ...week, progressPct: 10 }, "2026-11-27")).toBe("ahead");
  });

  it("期間中：あるべき 60% に対して 40% は遅れ、60% は予定どおり、80% は先行", () => {
    expect(progressStatus({ ...week, progressPct: 40 }, "2026-12-02")).toBe("behind");
    expect(progressStatus({ ...week, progressPct: 60 }, "2026-12-02")).toBe("on_track");
    expect(progressStatus({ ...week, progressPct: 80 }, "2026-12-02")).toBe("ahead");
  });

  it("終了後：100% 未満は遅れ、100% は予定どおり", () => {
    expect(progressStatus({ ...week, progressPct: 90 }, "2026-12-07")).toBe("behind");
    expect(progressStatus({ ...week, progressPct: 100 }, "2026-12-07")).toBe("on_track");
  });

  it("1日タスク：当日に 0% なら遅れ", () => {
    expect(progressStatus({ ...oneDay, progressPct: 0 }, "2026-12-02")).toBe("behind");
  });

  it("土日を挟む：日曜の時点で 50% なら予定どおり", () => {
    expect(progressStatus({ ...overWeekend, progressPct: 50 }, "2026-11-29")).toBe("on_track");
  });

  it("割り切れない率でも、同じ値なら予定どおり（3 日タスクの 1 日目 = 33.33…%）", () => {
    const threeDays = { plannedStart: "2026-11-30", plannedEnd: "2026-12-02" };
    const expected = expectedProgressPct(threeDays, "2026-11-30");
    expect(compareProgress(expected, expected)).toBe("on_track");
    expect(progressStatus({ ...threeDays, progressPct: 33 }, "2026-11-30")).toBe("behind");
    expect(progressStatus({ ...threeDays, progressPct: 34 }, "2026-11-30")).toBe("ahead");
  });

  it("遅れ日数（稼働日、切り上げ）", () => {
    expect(delayWorkdays({ ...week, progressPct: 40 }, "2026-12-02")).toBe(1); // 3日分 − 2日分
    expect(delayWorkdays({ ...week, progressPct: 0 }, "2026-12-04")).toBe(5);
    expect(delayWorkdays({ ...week, progressPct: 50 }, "2026-12-02")).toBe(1); // 0.5 日 → 1
    expect(delayWorkdays({ ...week, progressPct: 80 }, "2026-12-02")).toBe(0); // 先行
  });
});

describe("イナズマ線", () => {
  it("点の位置 = D × 進捗率（稼働日）", () => {
    expect(lightningOffset({ ...week, progressPct: 0 })).toBe(0);
    expect(lightningOffset({ ...week, progressPct: 60 })).toBe(3);
    expect(lightningOffset({ ...overWeekend, progressPct: 50 })).toBe(2);
  });

  it("オフセットをマスの位置に：0 は開始日の始まり、整数 k は k 稼働日目の終わり", () => {
    expect(offsetToGridPosition("2026-11-30", 0)).toEqual({ date: "2026-11-30", fraction: 0 });
    expect(offsetToGridPosition("2026-11-30", 1)).toEqual({ date: "2026-11-30", fraction: 1 });
    expect(offsetToGridPosition("2026-11-30", 2.5)).toEqual({ date: "2026-12-02", fraction: 0.5 });
    expect(offsetToGridPosition("2026-11-30", 5)).toEqual({ date: "2026-12-04", fraction: 1 });
  });

  it("土日を挟む：2 稼働日目の終わりは金曜の終わり（土日のマスには入らない）", () => {
    expect(offsetToGridPosition("2026-11-26", 2)).toEqual({ date: "2026-11-27", fraction: 1 });
    expect(offsetToGridPosition("2026-11-26", 2.5)).toEqual({ date: "2026-11-30", fraction: 0.5 });
  });

  it("予定どおりの点は、進捗管理日の終わり（縦線）に乗る", () => {
    const pos = offsetToGridPosition(week.plannedStart, lightningOffset({ ...week, progressPct: 60 }));
    expect(pos).toEqual({ date: "2026-12-02", fraction: 1 });
  });

  it("上から順に点を作り、遅れ・先行を付ける", () => {
    const points = lightningPoints(
      [
        { id: "a", ...week, progressPct: 40 },
        { id: "b", ...overWeekend, progressPct: 100 },
      ],
      "2026-12-02",
    );
    expect(points.map((p) => [p.task.id, p.position.date, p.position.fraction, p.status])).toEqual([
      ["a", "2026-12-01", 1, "behind"],
      ["b", "2026-12-01", 1, "on_track"],
    ]);
  });
});

describe("プロジェクト全体の進捗率", () => {
  it("予定日数で重み付けする", () => {
    // 5 日 × 100% + 4 日 × 0% + 1 日 × 50% = 5.5 / 10
    expect(
      overallProgressPct([
        { ...week, progressPct: 100 },
        { ...overWeekend, progressPct: 0 },
        { ...oneDay, progressPct: 50 },
      ]),
    ).toBeCloseTo(55);
  });

  it("タスクがなければ 0", () => {
    expect(overallProgressPct([])).toBe(0);
  });
});

describe("メンバーカード用", () => {
  const tasks = [
    { id: "a", ...overWeekend },
    { id: "b", ...oneDay },
    { id: "c", plannedStart: "2026-12-07", plannedEnd: "2026-12-08" },
  ];

  it("今日のタスクと次のタスク", () => {
    expect(currentTask(tasks, "2026-11-30")?.id).toBe("a");
    expect(nextTask(tasks, "2026-11-30")?.id).toBe("b");
  });

  it("担当タスクがない日は空き", () => {
    expect(currentTask(tasks, "2026-12-03")).toBeNull();
    expect(nextTask(tasks, "2026-12-08")).toBeNull();
  });

  it("終了予定まで残り稼働日（今日と終了日を含む）", () => {
    expect(remainingWorkdays(overWeekend, "2026-11-27")).toBe(3); // 金・月・火
    expect(remainingWorkdays(overWeekend, "2026-12-02")).toBe(0);
  });
});
