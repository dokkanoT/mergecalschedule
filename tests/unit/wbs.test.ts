import { describe, expect, it } from "vitest";
import { nonWorkdaysBetween } from "@/lib/calendar";
import { moveInOrder, offdayNote, summarizeRules } from "@/lib/wbs";

describe("並べ替え（↑↓）", () => {
  const ids = ["a", "b", "c"];
  it("上へ・下へ入れ替える", () => {
    expect(moveInOrder(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });
  it("先頭を上へ・末尾を下へ・ない id は動かさない", () => {
    expect(moveInOrder(ids, "a", "up")).toBeNull();
    expect(moveInOrder(ids, "c", "down")).toBeNull();
    expect(moveInOrder(ids, "x", "up")).toBeNull();
  });
});

describe("期間内の休み", () => {
  it("土日と祝日（11/23 勤労感謝の日）を拾う", () => {
    expect(nonWorkdaysBetween("2026-11-20", "2026-11-24")).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]);
    expect(offdayNote("2026-11-20", "2026-11-24")).toBe("11/21・11/22・11/23 は土日祝のため数えない");
  });
  it("休みがなければ補足なし", () => {
    expect(offdayNote("2026-11-24", "2026-11-27")).toBeNull();
  });
});

describe("ルールチェック欄", () => {
  const base = {
    deadline: "2027-01-08",
    bufferDays: 5,
    weekEndWeekday: 5,
    today: "2026-11-19",
  };
  const task = (id: string, assigneeId: string, start: string, end: string) => ({
    id,
    assigneeId,
    deliverable: "成果物",
    plannedStart: start,
    plannedEnd: end,
  });

  it("問題がなければすべて OK。バッファ残と次の進捗共有日を出す", () => {
    const items = summarizeRules({ ...base, tasks: [task("a", "u1", "2026-11-24", "2026-12-03")] });
    expect(items.map((i) => [i.key, i.ok])).toEqual([
      ["deliverable", true],
      ["assignee", true],
      ["parallel", true],
      ["buffer", true],
      ["meeting", true],
    ]);
    expect(items[3].description).toContain("12/3 終了");
    expect(items[4].description).toContain("11/20（金）");
  });

  it("バッファに食い込むと NG（境界：12/31 は OK、1/4 は NG）", () => {
    expect(summarizeRules({ ...base, tasks: [task("a", "u1", "2026-12-28", "2026-12-31")] })[3].ok).toBe(true);
    const ng = summarizeRules({ ...base, tasks: [task("a", "u1", "2026-12-28", "2027-01-04")] })[3];
    expect(ng.ok).toBe(false);
    expect(ng.description).toContain("1稼働日食い込んで");
  });

  it("同じ人の期間が重なると並列なしが NG", () => {
    const items = summarizeRules({
      ...base,
      tasks: [task("a", "u1", "2026-11-24", "2026-11-26"), task("b", "u1", "2026-11-26", "2026-11-27")],
    });
    expect(items[2].ok).toBe(false);
  });
});
