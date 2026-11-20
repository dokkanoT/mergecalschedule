import { describe, expect, it } from "vitest";
import {
  contentDisposition,
  progressCellCount,
  scheduleBuffer,
  scheduleCellKind,
  toArgb,
} from "@/lib/export/schedule-sheet";
import { chunkRows, fitColumnWidth, reportSummary } from "@/lib/export/report-summary";
import { renderFileName } from "@/lib/rules";

const buffer = scheduleBuffer({ deadline: "2027-01-08", bufferDays: 5 }); // 1/4〜1/8

describe("工程表のマスの塗り分け", () => {
  const task = { plannedStart: "2026-11-16", plannedEnd: "2026-11-20", progressPct: 80 }; // 5稼働日

  it("進捗の分（80% × 5日 = 4日）を濃く、残りを薄く", () => {
    expect(progressCellCount(task)).toBe(4);
    expect(scheduleCellKind("2026-11-16", task, buffer)).toBe("progress");
    expect(scheduleCellKind("2026-11-19", task, buffer)).toBe("progress");
    expect(scheduleCellKind("2026-11-20", task, buffer)).toBe("planned");
  });

  it("予定期間の外は塗らない、土日祝はグレー（11/23 勤労感謝の日）", () => {
    expect(scheduleCellKind("2026-11-24", task, buffer)).toBeNull();
    expect(scheduleCellKind("2026-11-21", task, buffer)).toBe("offday");
    expect(scheduleCellKind("2026-11-23", null, buffer)).toBe("offday");
  });

  it("期間中に土日を挟むと、進捗は稼働日で数える（金〜火の3日で 66% → 2日分 = 金・月）", () => {
    const t = { plannedStart: "2026-11-13", plannedEnd: "2026-11-17", progressPct: 66 };
    expect(scheduleCellKind("2026-11-13", t, buffer)).toBe("progress");
    expect(scheduleCellKind("2026-11-14", t, buffer)).toBe("offday");
    expect(scheduleCellKind("2026-11-16", t, buffer)).toBe("progress");
    expect(scheduleCellKind("2026-11-17", t, buffer)).toBe("planned");
  });

  it("0% は全部薄く、100% は全部濃く", () => {
    expect(scheduleCellKind("2026-11-16", { ...task, progressPct: 0 }, buffer)).toBe("planned");
    expect(scheduleCellKind("2026-11-20", { ...task, progressPct: 100 }, buffer)).toBe("progress");
  });

  it("予備期間（1/4〜1/8）は別の色。タスクがあればタスクの色が優先", () => {
    expect(scheduleCellKind("2027-01-04", null, buffer)).toBe("buffer");
    expect(scheduleCellKind("2026-12-31", null, buffer)).toBeNull();
    const late = { plannedStart: "2027-01-04", plannedEnd: "2027-01-05", progressPct: 0 };
    expect(scheduleCellKind("2027-01-04", late, buffer)).toBe("planned");
    expect(scheduleCellKind("2027-01-06", late, buffer)).toBe("buffer");
  });
});

describe("出力ファイル", () => {
  it("既定のテンプレートと、チーム固有の記号入りのテンプレート", () => {
    const ctx = { statusDate: "2026-11-20", projectName: "minebook", n: 2 };
    expect(renderFileName("{yyMMdd}_{project}工程表v{n}.xlsx", "xlsx", ctx)).toBe("261120_minebook工程表v2.xlsx");
    expect(renderFileName("{yyMMdd}b_{project}工程表v{n}", "xlsx", ctx)).toBe("261120b_minebook工程表v2.xlsx");
  });

  it("日本語のファイル名は filename* で送る", () => {
    const header = contentDisposition("261120_nomiメモ工程表v1.xlsx");
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent("261120_nomiメモ工程表v1.xlsx")}`);
    expect(header).toMatch(/filename="[\x20-\x7e]+\.xlsx"/);
    expect(contentDisposition("工程表.xlsx")).toContain('filename="download.xlsx"');
  });

  it("色を ARGB に", () => {
    expect(toArgb("#7c5cfa")).toBe("FF7C5CFA");
    expect(() => toArgb("red")).toThrow();
  });
});

describe("進捗レポートの数字", () => {
  const project = { deadline: "2026-12-11", bufferDays: 3 };
  const t = (id: string, start: string, end: string, progressPct: number) => ({
    id,
    name: id,
    assigneeName: "A",
    plannedStart: start,
    plannedEnd: end,
    progressPct,
  });
  const tasks = [
    t("done", "2026-11-09", "2026-11-13", 100), // 5日・完了
    t("late", "2026-11-16", "2026-11-20", 40), // 11/19 時点であるべき 80%
    t("ahead", "2026-11-16", "2026-11-20", 100),
    t("future", "2026-12-07", "2026-12-10", 0),
  ];
  const s = reportSummary(project, tasks, "2026-11-19");

  it("遅れタスクだけを、遅れ日数つきで拾う（完了・先行・未着手は入らない）", () => {
    expect(s.lateTasks.map((l) => l.task.id)).toEqual(["late"]);
    expect(s.lateTasks[0]).toMatchObject({ expectedPct: 80, delay: 2 });
  });

  it("全体進捗率は予定日数で重み付け（(5×100 + 5×40 + 5×100 + 4×0) / 19）", () => {
    expect(s.overallPct).toBe(Math.round((500 + 200 + 500) / 19));
    expect(s.expectedOverallPct).toBe(Math.round((500 + 400 + 400) / 19));
  });

  it("締切まで・バッファ残は稼働日で数える（11/23 祝日を除く）", () => {
    // 11/20〜12/11 の稼働日：11/20, 11/24〜27, 11/30〜12/4, 12/7〜11 = 1 + 4 + 5 + 5
    expect(s.workdaysToDeadline).toBe(15);
    expect(s.bufferLeft).toBe(1); // 12/10 の翌日〜12/11
    expect(s.buffer.status).toBe("warning");
  });

  it("タスクがなければバッファ残は出さない", () => {
    expect(reportSummary(project, [], "2026-11-19").bufferLeft).toBeNull();
  });

  it("ガントのページ分けと列の幅", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRows([], 10)).toEqual([[]]);
    expect(fitColumnWidth(600, 30)).toBe(14);
    expect(fitColumnWidth(600, 100)).toBe(6);
  });
});
