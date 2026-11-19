import { describe, expect, it } from "vitest";
import {
  bufferPeriod,
  checkBuffer,
  countOpenHelpRequests,
  describeConflict,
  duplicateForMembers,
  findOverlaps,
  formatYyMMdd,
  HELP_BODY_MAX,
  isParallelTaskViolation,
  isStatusDay,
  lastPlannedEndOf,
  periodsOverlap,
  renderFileName,
  sanitizeFileName,
  statusDaysBetween,
  suggestNextFreeStart,
  validateCompletion,
  validateDeliverable,
  validateHelpBody,
  validateProjectSettings,
  validateTask,
  validateTaskDates,
  type ScheduledTask,
} from "@/lib/rules";
import {
  colorLabelOf,
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  isProjectColor,
  isProjectIcon,
  PROJECT_COLORS,
  tintOf,
} from "@/lib/project-style";

// ---------------------------------------------------------------------------
// R0：タスクの日付
// ---------------------------------------------------------------------------
describe("validateTaskDates（R0）", () => {
  it("平日どうしなら問題なし", () => {
    expect(validateTaskDates({ plannedStart: "2026-11-24", plannedEnd: "2026-11-27" })).toEqual([]);
  });

  it("祝日（2026-11-23 勤労感謝の日）を開始日にすると拒否", () => {
    const issues = validateTaskDates({ plannedStart: "2026-11-23", plannedEnd: "2026-11-27" });
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("plannedStart");
    expect(issues[0].message).toContain("勤労感謝の日");
    expect(issues[0].message).toContain("11/23（月）");
  });

  it("土日を開始日・終了日にすると拒否", () => {
    const issues = validateTaskDates({ plannedStart: "2026-11-28", plannedEnd: "2026-11-29" });
    expect(issues.map((i) => i.field)).toEqual(["plannedStart", "plannedEnd"]);
    expect(issues[0].message).toContain("土曜日");
    expect(issues[1].message).toContain("日曜日");
  });

  it("実績日の休日も拒否", () => {
    const issues = validateTaskDates({
      plannedStart: "2026-11-24",
      plannedEnd: "2026-11-27",
      actualStart: "2026-11-23",
    });
    expect(issues.map((i) => i.field)).toEqual(["actualStart"]);
  });

  it("開始 > 終了は拒否", () => {
    const issues = validateTaskDates({ plannedStart: "2026-11-27", plannedEnd: "2026-11-24" });
    expect(issues.map((i) => i.field)).toEqual(["plannedEnd"]);
  });

  it("予定日の未入力・不正な日付は拒否", () => {
    expect(validateTaskDates({ plannedStart: "", plannedEnd: "2026-11-24" })[0].field).toBe("plannedStart");
    expect(validateTaskDates({ plannedStart: "2026-11-24", plannedEnd: "2026-02-30" })[0].field).toBe("plannedEnd");
  });
});

// ---------------------------------------------------------------------------
// R1：成果物
// ---------------------------------------------------------------------------
describe("R1 成果物", () => {
  it("成果物が空・空白だけなら拒否", () => {
    expect(validateDeliverable("")).toHaveLength(1);
    expect(validateDeliverable("   ")).toHaveLength(1);
    expect(validateDeliverable(null)).toHaveLength(1);
    expect(validateDeliverable("テスト結果報告書")).toEqual([]);
  });

  it("完了（100%）には URL かメモが必要", () => {
    expect(validateCompletion({ progressPct: 100 })).toHaveLength(1);
    expect(validateCompletion({ progressPct: 100, deliverableUrl: " ", completionNote: "" })).toHaveLength(1);
    expect(validateCompletion({ progressPct: 100, deliverableUrl: "https://github.com/x/y/pull/1" })).toEqual([]);
    expect(validateCompletion({ progressPct: 100, completionNote: "Discord で共有済み" })).toEqual([]);
  });

  it("完了でなければ URL もメモもなくてよい", () => {
    expect(validateCompletion({ progressPct: 99 })).toEqual([]);
  });

  it("進捗率は 0〜100 の整数", () => {
    expect(validateCompletion({ progressPct: -1 })).toHaveLength(1);
    expect(validateCompletion({ progressPct: 101, completionNote: "x" })).toHaveLength(1);
    expect(validateCompletion({ progressPct: 50.5 })).toHaveLength(1);
  });

  it("URL は http(s) のみ", () => {
    expect(validateCompletion({ progressPct: 10, deliverableUrl: "javascript:alert(1)" })).toHaveLength(1);
    expect(validateCompletion({ progressPct: 10, deliverableUrl: "ftp://example.com" })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// R2：担当者
// ---------------------------------------------------------------------------
describe("R2 担当者", () => {
  it("担当者なしは拒否（validateTask にまとめて出る）", () => {
    const issues = validateTask({
      name: "画面設計",
      deliverable: "画面遷移図",
      assigneeId: null,
      plannedStart: "2026-11-24",
      plannedEnd: "2026-11-27",
      progressPct: 0,
    });
    expect(issues.map((i) => i.field)).toEqual(["assigneeId"]);
  });

  it("担当者なし・成果物なし・休日をまとめて返す", () => {
    const issues = validateTask({
      name: " ",
      deliverable: "",
      assigneeId: "",
      plannedStart: "2026-11-23",
      plannedEnd: "2026-11-27",
      progressPct: 0,
    });
    expect(issues.map((i) => i.field)).toEqual(["name", "deliverable", "assigneeId", "plannedStart"]);
  });

  it("メンバー分複製：人数分のタスクができ、担当者は1人ずつ", () => {
    const tasks = duplicateForMembers<{ name: string; assigneeId: string }>({ name: "環境構築" }, [
      "u1",
      "u2",
      "u1",
      " ",
    ]);
    expect(tasks).toEqual([
      { name: "環境構築", assigneeId: "u1" },
      { name: "環境構築", assigneeId: "u2" },
    ]);
  });

  it("メンバー分複製：1人も選ばなければエラー", () => {
    expect(() => duplicateForMembers({ name: "x" }, [])).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// R3：並列禁止（プロジェクト横断）
// ---------------------------------------------------------------------------
describe("R3 並列禁止", () => {
  // u1 が minebook で 11/24(火)〜11/27(金)、nomiメモ で 12/01(火)〜12/03(木)
  const existing: (ScheduledTask & { projectId: string })[] = [
    { id: "t1", projectId: "minebook", assigneeId: "u1", plannedStart: "2026-11-24", plannedEnd: "2026-11-27" },
    { id: "t2", projectId: "nomi", assigneeId: "u1", plannedStart: "2026-12-01", plannedEnd: "2026-12-03" },
    { id: "t3", projectId: "minebook", assigneeId: "u2", plannedStart: "2026-11-24", plannedEnd: "2026-12-04" },
  ];

  it("同じプロジェクト内で重なる", () => {
    const hits = findOverlaps({ assigneeId: "u1", plannedStart: "2026-11-25", plannedEnd: "2026-11-26" }, existing);
    expect(hits.map((t) => t.id)).toEqual(["t1"]);
  });

  it("別プロジェクト間で重なる（nomiメモのタスクを入れようとして minebook と衝突）", () => {
    const hits = findOverlaps({ assigneeId: "u1", plannedStart: "2026-11-26", plannedEnd: "2026-11-30" }, existing);
    expect(hits.map((t) => [t.id, t.projectId])).toEqual([["t1", "minebook"]]);
  });

  it("端の日が1日だけ重なる（11/27）", () => {
    const hits = findOverlaps({ assigneeId: "u1", plannedStart: "2026-11-27", plannedEnd: "2026-11-30" }, existing);
    expect(hits.map((t) => t.id)).toEqual(["t1"]);
  });

  it("隣接（11/30 開始）は重ならない", () => {
    expect(findOverlaps({ assigneeId: "u1", plannedStart: "2026-11-30", plannedEnd: "2026-11-30" }, existing)).toEqual([]);
  });

  it("土日をまたぐ期間どうしでも、暦日で重なれば重複（金〜月 と 月〜火 は月曜で重なる）", () => {
    // 11/27(金)〜11/30(月) と 11/30(月)〜12/01(火) は 11/30 で重なる
    expect(periodsOverlap(
      { plannedStart: "2026-11-27", plannedEnd: "2026-11-30" },
      { plannedStart: "2026-11-30", plannedEnd: "2026-12-01" },
    )).toBe(true);
  });

  it("複数のタスクと重なれば開始日順にすべて返す", () => {
    const hits = findOverlaps({ assigneeId: "u1", plannedStart: "2026-11-20", plannedEnd: "2026-12-02" }, existing);
    expect(hits.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("担当者が違えば重なってもよい", () => {
    expect(findOverlaps({ assigneeId: "u3", plannedStart: "2026-11-24", plannedEnd: "2026-11-27" }, existing)).toEqual([]);
  });

  it("自分自身の更新は除外する", () => {
    expect(
      findOverlaps({ id: "t1", assigneeId: "u1", plannedStart: "2026-11-24", plannedEnd: "2026-11-26" }, existing),
    ).toEqual([]);
  });

  it("自分自身の更新でも、別のタスクに重ねれば衝突", () => {
    const hits = findOverlaps({ id: "t1", assigneeId: "u1", plannedStart: "2026-11-24", plannedEnd: "2026-12-01" }, existing);
    expect(hits.map((t) => t.id)).toEqual(["t2"]);
  });

  describe("次の空き日", () => {
    it("空いていれば希望日のまま", () => {
      expect(suggestNextFreeStart("u1", existing, "2026-11-30", 1)).toBe("2026-11-30");
    });

    it("希望日が休日なら次の稼働日", () => {
      expect(suggestNextFreeStart("u3", existing, "2026-11-23", 1)).toBe("2026-11-24");
    });

    it("衝突したら、衝突タスクの翌稼働日から探す", () => {
      // 11/25 から 2 日 → t1 と衝突 → 11/30(月) から 2 日だと 12/01 で t2 と衝突 → 12/04(金) から
      expect(suggestNextFreeStart("u1", existing, "2026-11-25", 2)).toBe("2026-12-04");
    });

    it("隙間に収まるなら隙間に入れる（1日なら 11/30）", () => {
      expect(suggestNextFreeStart("u1", existing, "2026-11-25", 1)).toBe("2026-11-30");
    });

    it("自分自身は除外して探す", () => {
      expect(suggestNextFreeStart("u1", existing, "2026-11-24", 4, "t1")).toBe("2026-11-24");
    });

    it("期間 0 以下はエラー", () => {
      expect(() => suggestNextFreeStart("u1", existing, "2026-11-24", 0)).toThrow(RangeError);
    });
  });

  it("衝突の説明：メンバーなら名前、メンバーでなければ「別プロジェクトの予定」", () => {
    expect(
      describeConflict({ plannedStart: "2026-11-24", plannedEnd: "2026-11-27", projectName: "minebook", taskName: "API 設計" }),
    ).toBe("「minebook」の「API 設計」（2026-11-24〜2026-11-27）と期間が重なっています。");
    expect(
      describeConflict({ plannedStart: "2026-11-24", plannedEnd: "2026-11-27", projectName: null, taskName: null }),
    ).toBe("別プロジェクトの予定（2026-11-24〜2026-11-27）と期間が重なっています。");
  });

  it("DB の排他制約違反（23P01）を見分ける。Drizzle が包んだエラーでも", () => {
    expect(isParallelTaskViolation({ code: "23P01", constraint: "no_parallel_tasks" })).toBe(true);
    expect(isParallelTaskViolation(new Error("wrap", { cause: { code: "23P01", constraint: "no_parallel_tasks" } }))).toBe(true);
    expect(isParallelTaskViolation({ code: "23514", constraint: "tasks_planned_range" })).toBe(false);
    expect(isParallelTaskViolation({ code: "23P01", constraint: "other_exclusion" })).toBe(false);
    expect(isParallelTaskViolation(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R4：バッファ
// ---------------------------------------------------------------------------
describe("R4 バッファ", () => {
  // minebook・nomiメモの締切 2027-01-08(金)、バッファ 5 稼働日
  // → 予備期間 01-04(月)〜01-08。01-01 は元日なので、最終タスクは 2026-12-31(木) までに終える
  it("予備期間は締切日以前の最後の N 稼働日", () => {
    expect(bufferPeriod("2027-01-08", 5)).toEqual({
      start: "2027-01-04",
      end: "2027-01-08",
      latestPlannedEnd: "2026-12-31",
    });
  });

  it("ちょうど境界の日（12/31 終了）は OK", () => {
    const r = checkBuffer("2027-01-08", 5, "2026-12-31");
    expect(r.status).toBe("ok");
    expect(r.remainingBufferWorkdays).toBe(5);
  });

  it("1稼働日超過（01-04 終了）は警告", () => {
    const r = checkBuffer("2027-01-08", 5, "2027-01-04");
    expect(r.status).toBe("warning");
    if (r.status !== "warning") throw new Error("unreachable");
    expect(r.overrunWorkdays).toBe(1);
    expect(r.remainingBufferWorkdays).toBe(4);
    expect(r.message).toContain("2026-12-31 までに");
  });

  it("間に土日を挟む：締切 12/08(火)・バッファ 3 → 予備期間 12/04(金)〜12/08、最終は 12/03 まで", () => {
    expect(bufferPeriod("2026-12-08", 3)).toEqual({
      start: "2026-12-04",
      end: "2026-12-08",
      latestPlannedEnd: "2026-12-03",
    });
    expect(checkBuffer("2026-12-08", 3, "2026-12-03").status).toBe("ok");
    const r = checkBuffer("2026-12-08", 3, "2026-12-07");
    expect(r.status).toBe("warning");
    if (r.status !== "warning") throw new Error("unreachable");
    expect(r.overrunWorkdays).toBe(2); // 12/04(金) と 12/07(月)。土日は数えない
  });

  it("締切が休日なら、その前の稼働日から数える（締切 12/06(日)・バッファ 2 → 12/03〜）", () => {
    expect(bufferPeriod("2026-12-06", 2)).toEqual({
      start: "2026-12-03",
      end: "2026-12-06",
      latestPlannedEnd: "2026-12-02",
    });
  });

  it("締切を過ぎていれば、その旨の警告", () => {
    const r = checkBuffer("2027-01-08", 5, "2027-01-12");
    expect(r.status).toBe("warning");
    if (r.status !== "warning") throw new Error("unreachable");
    expect(r.message).toContain("締切日");
    expect(r.remainingBufferWorkdays).toBe(0);
  });

  it("タスクがなければ no_tasks", () => {
    expect(checkBuffer("2027-01-08", 5, null).status).toBe("no_tasks");
  });

  it("バッファ 0 日以下はエラー", () => {
    expect(() => bufferPeriod("2027-01-08", 0)).toThrow(RangeError);
  });

  it("最終タスクの予定終了日", () => {
    expect(lastPlannedEndOf([{ plannedEnd: "2026-12-01" }, { plannedEnd: "2026-12-24" }, { plannedEnd: "2026-11-30" }])).toBe(
      "2026-12-24",
    );
    expect(lastPlannedEndOf([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R5：会議体・ファイル名
// ---------------------------------------------------------------------------
describe("R5 会議体", () => {
  it("進捗共有日は週の最終日（既定は金曜）", () => {
    expect(isStatusDay("2026-11-27")).toBe(true);
    expect(isStatusDay("2026-11-26")).toBe(false);
  });

  it("金曜が祝日の週は木曜が進捗共有日（2027-01-01 元日 → 2026-12-31）", () => {
    expect(isStatusDay("2026-12-31")).toBe(true);
    expect(isStatusDay("2027-01-01")).toBe(false);
  });

  it("期間内の進捗共有日の一覧", () => {
    expect(statusDaysBetween("2026-11-20", "2027-01-08")).toEqual([
      "2026-11-20",
      "2026-11-27",
      "2026-12-04",
      "2026-12-11",
      "2026-12-18",
      "2026-12-25",
      "2026-12-31",
      "2027-01-08",
    ]);
  });

  it("yyMMdd", () => {
    expect(formatYyMMdd("2026-11-27")).toBe("261127");
  });

  it("既定のテンプレート", () => {
    expect(
      renderFileName("{yyMMdd}_{project}工程表v{n}.xlsx", "xlsx", { statusDate: "2026-11-27", projectName: "minebook", n: 1 }),
    ).toBe("261127_minebook工程表v1.xlsx");
  });

  it("チーム固有の記号を含むテンプレート（記号は解釈しない）", () => {
    expect(
      renderFileName("{yyMMdd}b_{project}工程表v{n}.xlsx", "xlsx", { statusDate: "2026-11-27", projectName: "minebook", n: 2 }),
    ).toBe("261127b_minebook工程表v2.xlsx");
    expect(
      renderFileName("{yyMMdd}f_進捗レポート.pdf", "pdf", { statusDate: "2026-11-27", projectName: "minebook", n: 1 }),
    ).toBe("261127f_進捗レポート.pdf");
  });

  it("ファイル名に使えない文字は _ に置き換える（プロジェクト名に含まれていても）", () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
    expect(
      renderFileName("{yyMMdd}_{project}.pdf", "pdf", { statusDate: "2026-11-27", projectName: "nomi/メモ", n: 1 }),
    ).toBe("261127_nomi_メモ.pdf");
  });

  it("拡張子がなければ付ける", () => {
    expect(renderFileName("{project}工程表", "xlsx", { statusDate: "2026-11-27", projectName: "nomiメモ", n: 1 })).toBe(
      "nomiメモ工程表.xlsx",
    );
  });

  it("未解決の困りごとの件数", () => {
    expect(countOpenHelpRequests([{ resolvedAt: null }, { resolvedAt: new Date() }, { resolvedAt: null }])).toBe(2);
  });
});

describe("プロジェクト設定", () => {
  const valid = {
    name: "minebook",
    color: "#1F9D6B",
    icon: "book-open",
    deadline: "2027-01-08",
    bufferDays: 5,
    weekEndWeekday: 5,
    xlsxFileNameTemplate: "{yyMMdd}_{project}工程表v{n}.xlsx",
    pdfFileNameTemplate: "{yyMMdd}_{project}進捗レポート.pdf",
  };

  it("正しい入力なら問題なし", () => {
    expect(validateProjectSettings(valid)).toEqual([]);
  });

  it("バッファ 0・週の最終曜日が土曜・締切なし・テンプレート空は拒否", () => {
    const issues = validateProjectSettings({
      ...valid,
      deadline: "",
      bufferDays: 0,
      weekEndWeekday: 6,
      pdfFileNameTemplate: " ",
    });
    expect(issues.map((i) => i.field)).toEqual(["deadline", "bufferDays", "weekEndWeekday", "pdfFileNameTemplate"]);
  });

  it("色は 6 色のパレットだけ、アイコンは一覧にあるものだけ", () => {
    const issues = validateProjectSettings({ ...valid, color: "#22c55e", icon: "skull" });
    expect(issues.map((i) => i.field)).toEqual(["color", "icon"]);
    expect(validateProjectSettings({ ...valid, color: "#7c5cfa" }).map((i) => i.field)).toEqual(["color"]);
  });
});

describe("プロジェクトの色とアイコン", () => {
  it("6 色すべてに薄い色と名前がある", () => {
    expect(PROJECT_COLORS).toHaveLength(6);
    for (const c of PROJECT_COLORS) {
      expect(tintOf(c.color)).toMatch(/^#[0-9A-F]{6}$/);
      expect(colorLabelOf(c.color)).toBe(c.label);
    }
  });

  it("既定は紫とカレンダー", () => {
    expect(DEFAULT_PROJECT_COLOR).toBe("#7C5CFA");
    expect(tintOf(DEFAULT_PROJECT_COLOR)).toBe("#F1EDFF");
    expect(isProjectIcon(DEFAULT_PROJECT_ICON)).toBe(true);
    expect(DEFAULT_PROJECT_ICON).toBe("calendar");
  });

  it("パレットにない色は薄い色なし", () => {
    expect(isProjectColor("#3b82f6")).toBe(false);
    expect(tintOf("#3b82f6")).toBeNull();
  });
});

describe("R5 困りごと", () => {
  it("空・空白だけは出せない", () => {
    expect(validateHelpBody("")).toHaveLength(1);
    expect(validateHelpBody("  \n ")).toHaveLength(1);
  });
  it("500 文字まで", () => {
    expect(validateHelpBody("あ".repeat(HELP_BODY_MAX))).toEqual([]);
    expect(validateHelpBody("あ".repeat(HELP_BODY_MAX + 1))[0]?.message).toMatch("500");
  });
});
